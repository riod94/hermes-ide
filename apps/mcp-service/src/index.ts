/**
 * Hermes MCP Service — Standalone Bun Process
 * Managed by systemd, independent of code-server/Extension Host.
 *
 * Responsibilities:
 *   1. MCP Streamable HTTP server (Hermes Gateway connects here)
 *   2. Internal REST API (Extension polls/pushes diff decisions)
 *   3. SSE push stream (real-time notifications to Extension)
 *
 * HTTP endpoints:
 *   POST   /mcp           — MCP protocol (Hermes Gateway)
 *   GET    /mcp           — MCP SSE stream
 *   DELETE /mcp           — MCP session close
 *   GET    /health        — Health check
 *   GET    /api/pending   — Extension polls pending diff proposals
 *   POST   /api/resolve   — Extension sends Accept/Reject
 *   GET    /api/events    — SSE push stream to Extension
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Hono } from "hono";
import { cors } from "hono/cors";

// ─────────────────────────────────────────────
// Logging — stdout for journalctl
// ─────────────────────────────────────────────

function log(message: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${message}`);
}

// ─────────────────────────────────────────────
// Pending diff state — shared between MCP tool handler and Extension API
// ─────────────────────────────────────────────

interface PendingDiff {
  diffId: string;
  filepath: string;
  new_content: string;
  createdAt: number;
  resolve: (decision: "accept" | "reject") => void;
}

const pendingDiffs = new Map<string, PendingDiff>();

// SSE clients subscribed to real-time events
const sseClients = new Set<ReadableStreamDefaultController>();

/**
 * Broadcast an event to all connected SSE clients (Extension instances)
 */
function broadcastEvent(event: string, data: Record<string, unknown>) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const controller of sseClients) {
    try {
      controller.enqueue(new TextEncoder().encode(payload));
    } catch {
      // Client disconnected — will be cleaned up
      sseClients.delete(controller);
    }
  }
}

// ─────────────────────────────────────────────
// MCP Tool handlers — shared across all sessions
// ─────────────────────────────────────────────

function registerToolHandlers(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "ide_propose_diff",
        description:
          "Propose file changes to the human developer. Opens a Diff view in the IDE. Execution pauses until the human approves or rejects. ALWAYS use this tool instead of terminal commands (sed/echo/patch) for file editing.",
        inputSchema: {
          type: "object" as const,
          properties: {
            filepath: {
              type: "string",
              description: "Absolute path to the file to modify or create",
            },
            new_content: {
              type: "string",
              description: "The proposed new full content for the file",
            },
          },
          required: ["filepath", "new_content"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "ide_propose_diff") {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const { filepath, new_content } = request.params.arguments as {
      filepath: string;
      new_content: string;
    };

    const diffId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    log(`Tool call: ide_propose_diff for ${filepath} (diffId: ${diffId})`);

    // BLOCK: wait until Extension sends decision via POST /api/resolve
    const decision = await new Promise<"accept" | "reject">((resolve) => {
      const pending: PendingDiff = {
        diffId,
        filepath,
        new_content,
        createdAt: Date.now(),
        resolve,
      };
      pendingDiffs.set(diffId, pending);

      // Broadcast to all SSE-connected Extension instances
      broadcastEvent("diffProposal", {
        diffId,
        filepath,
        new_content,
      });

      log(`Diff proposal queued, waiting for user decision... (${pendingDiffs.size} pending)`);
    });

    log(`Diff ${diffId} resolved: ${decision}`);

    if (decision === "accept") {
      // Write file to disk
      await Bun.write(filepath, new_content);
      return {
        content: [
          {
            type: "text" as const,
            text: `Success: User accepted changes to ${filepath}. File written.`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text" as const,
            text: `Rejected: User rejected changes to ${filepath}.`,
          },
        ],
        isError: true,
      };
    }
  });
}

// ─────────────────────────────────────────────
// MCP Session management
// ─────────────────────────────────────────────

interface McpSession {
  server: Server;
  transport: WebStandardStreamableHTTPServerTransport;
  createdAt: number;
}

const sessions = new Map<string, McpSession>();

function createSession(): McpSession {
  const server = new Server(
    { name: "hermes-ide-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sessionId: string) => {
      log(`MCP session initialized: ${sessionId}`);
      sessions.set(sessionId, { server, transport, createdAt: Date.now() });
    },
  });

  registerToolHandlers(server);

  return { server, transport, createdAt: Date.now() };
}

async function destroySession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    try {
      await session.transport.close();
      await session.server.close();
    } catch {
      // ignore
    }
    sessions.delete(sessionId);
    log(`MCP session destroyed: ${sessionId}`);
  }
}

// ─────────────────────────────────────────────
// Hono HTTP router
// ─────────────────────────────────────────────

const app = new Hono();
app.use("/*", cors());

// ── Health ───────────────────────────────────

app.get("/health", (c) =>
  c.json({
    status: "ok",
    server: "hermes-ide-mcp",
    version: "1.0.0",
    runtime: "bun",
    activeSessions: sessions.size,
    pendingDiffs: pendingDiffs.size,
    sseClients: sseClients.size,
    uptime: Math.floor(process.uptime()),
  })
);

// ── MCP Protocol ─────────────────────────────

app.all("/mcp", async (c) => {
  const req = c.req.raw;
  const sessionId = req.headers.get("mcp-session-id");

  // POST without session → new session
  if (req.method === "POST" && !sessionId) {
    const { server, transport } = createSession();
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  // With session → route to existing
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json(
        {
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid session ID. Session may have expired." },
          id: null,
        },
        404
      );
    }

    if (req.method === "DELETE") {
      const response = await session.transport.handleRequest(req);
      await destroySession(sessionId);
      return response;
    }

    return session.transport.handleRequest(req);
  }

  // POST without session (non-initialize) → also create session
  if (req.method === "POST") {
    const { server, transport } = createSession();
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  return c.json(
    {
      jsonrpc: "2.0",
      error: { code: -32600, message: "GET/DELETE require mcp-session-id header." },
      id: null,
    },
    400
  );
});

// ── Internal API: Extension ↔ MCP Service ────

/**
 * GET /api/pending — Extension polls for pending diff proposals
 * Returns array of {diffId, filepath, new_content, createdAt}
 */
app.get("/api/pending", (c) => {
  const pending = Array.from(pendingDiffs.values()).map((d) => ({
    diffId: d.diffId,
    filepath: d.filepath,
    new_content: d.new_content,
    createdAt: d.createdAt,
  }));
  return c.json({ pending });
});

/**
 * POST /api/resolve — Extension sends Accept/Reject decision
 * Body: { diffId: string, decision: "accept" | "reject" }
 */
app.post("/api/resolve", async (c) => {
  const body = await c.req.json<{ diffId: string; decision: "accept" | "reject" }>();

  if (!body.diffId || !body.decision) {
    return c.json({ error: "Missing diffId or decision" }, 400);
  }

  const pending = pendingDiffs.get(body.diffId);
  if (!pending) {
    return c.json({ error: `No pending diff found: ${body.diffId}` }, 404);
  }

  // Resolve the blocking Promise in the MCP tool handler
  pending.resolve(body.decision);
  pendingDiffs.delete(body.diffId);

  log(`Diff resolved via API: ${body.diffId} → ${body.decision}`);

  // Broadcast resolution to other SSE clients
  broadcastEvent("diffResolved", {
    diffId: body.diffId,
    decision: body.decision,
    filepath: pending.filepath,
  });

  return c.json({ ok: true, diffId: body.diffId, decision: body.decision });
});

/**
 * GET /api/events — SSE stream for real-time push to Extension
 * Events: diffProposal, diffResolved
 */
app.get("/api/events", (c) => {
  const stream = new ReadableStream({
    start(controller) {
      sseClients.add(controller);
      log(`SSE client connected (total: ${sseClients.size})`);

      // Send initial heartbeat
      controller.enqueue(
        new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify({ status: "ok" })}\n\n`)
      );

      // Send any currently pending diffs so Extension catches up
      for (const diff of pendingDiffs.values()) {
        const payload = `event: diffProposal\ndata: ${JSON.stringify({
          diffId: diff.diffId,
          filepath: diff.filepath,
          new_content: diff.new_content,
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(payload));
      }
    },
    cancel() {
      // Controller will be cleaned up on next broadcast attempt
      log(`SSE client disconnected (remaining: ${sseClients.size - 1})`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// ─────────────────────────────────────────────
// Stale session cleanup — every 5 minutes
// ─────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      log(`Cleaning up stale MCP session: ${id}`);
      destroySession(id);
    }
  }
}, 5 * 60 * 1000);

// Stale diff cleanup — diffs pending > 10 minutes are auto-rejected
const DIFF_TTL_MS = 10 * 60 * 1000; // 10 min

setInterval(() => {
  const now = Date.now();
  for (const [id, diff] of pendingDiffs) {
    if (now - diff.createdAt > DIFF_TTL_MS) {
      log(`Auto-rejecting stale diff: ${id} (${diff.filepath})`);
      diff.resolve("reject");
      pendingDiffs.delete(id);
      broadcastEvent("diffResolved", {
        diffId: id,
        decision: "reject",
        filepath: diff.filepath,
        reason: "timeout",
      });
    }
  }
}, 60 * 1000);

// ─────────────────────────────────────────────
// SSE heartbeat — keep connections alive
// ─────────────────────────────────────────────

setInterval(() => {
  const payload = new TextEncoder().encode(`: heartbeat\n\n`);
  for (const controller of sseClients) {
    try {
      controller.enqueue(payload);
    } catch {
      sseClients.delete(controller);
    }
  }
}, 30 * 1000);

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

const PORT = parseInt(process.env.MCP_PORT || "51600", 10);
const PROFILE = process.env.MCP_PROFILE || "unknown";

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1", // localhost only — Nginx proxies from outside
  idleTimeout: 120,
  fetch: app.fetch,
});

log(`Hermes MCP Service started`);
log(`  Profile : ${PROFILE}`);
log(`  Port    : ${PORT}`);
log(`  Bind    : 127.0.0.1:${PORT}`);
log(`  MCP     : http://127.0.0.1:${PORT}/mcp`);
log(`  Health  : http://127.0.0.1:${PORT}/health`);
log(`  Events  : http://127.0.0.1:${PORT}/api/events`);
