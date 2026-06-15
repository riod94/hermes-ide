/**
 * Standalone MCP Server — runs as a separate Bun process
 * Spawned by Extension Host via `bun run mcpStandalone.ts`
 *
 * Communication with Extension Host:
 *   stdout → Extension Host: JSON lines (diffProposal, diffResult, ready, log)
 *   stdin  ← Extension Host: JSON lines (resolveDiff)
 *
 * HTTP endpoints (Bun.serve + Hono):
 *   POST /mcp  — MCP Streamable HTTP (Hermes Agent connects here)
 *   GET  /mcp  — SSE stream (long-lived server-to-client notifications)
 *   DELETE /mcp — Session termination
 *   GET  /health — health check
 *
 * Architecture: Multi-session capable.
 *   Each initialize request creates a new MCP Server + Transport pair.
 *   Sessions are tracked by session ID and cleaned up on close.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createInterface } from "readline";

// ─────────────────────────────────────────────
// IPC helpers — communicate with Extension Host via stdio
// ─────────────────────────────────────────────

function ipcSend(msg: Record<string, unknown>) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function log(message: string) {
  ipcSend({ type: "log", message });
}

// ─────────────────────────────────────────────
// Pending diff resolvers — blocks agent until user Accept/Reject
// ─────────────────────────────────────────────

const pendingDiffResolvers = new Map<
  string,
  { resolve: (value: "accept" | "reject") => void }
>();

// ─────────────────────────────────────────────
// Listen for commands from Extension Host via stdin
// ─────────────────────────────────────────────

const rl = createInterface({ input: process.stdin });
rl.on("line", (line: string) => {
  try {
    const msg = JSON.parse(line);
    if (msg.type === "resolveDiff") {
      const pending = pendingDiffResolvers.get(msg.diffId);
      if (pending) {
        pending.resolve(msg.decision);
        pendingDiffResolvers.delete(msg.diffId);
        log(`Diff ${msg.diffId} resolved: ${msg.decision}`);
      } else {
        log(`No pending diff found for id: ${msg.diffId}`);
      }
    }
  } catch (e: any) {
    log(`Failed to parse stdin message: ${e.message}`);
  }
});

// ─────────────────────────────────────────────
// Tool handlers factory — shared across all sessions
// ─────────────────────────────────────────────

function registerToolHandlers(server: Server) {
  // List tools
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

  // Handle tool calls
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

    // Send diff proposal to Extension Host via stdout
    ipcSend({
      type: "diffProposal",
      diffId,
      filepath,
      new_content,
    });

    // BLOCK: wait until Extension Host sends resolveDiff via stdin
    const decision = await new Promise<"accept" | "reject">((resolve) => {
      pendingDiffResolvers.set(diffId, { resolve });
    });

    // Notify Extension Host of the result
    ipcSend({
      type: "diffResult",
      diffId,
      decision,
      filepath,
      new_content,
    });

    if (decision === "accept") {
      // Write file to disk (Bun native)
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
// Session management — one Server+Transport per client session
// ─────────────────────────────────────────────

interface McpSession {
  server: Server;
  transport: WebStandardStreamableHTTPServerTransport;
  createdAt: number;
}

const sessions = new Map<string, McpSession>();

/**
 * Create a new MCP session (Server + Transport).
 * Called on every initialize request from a new client.
 */
function createSession(): McpSession {
  const server = new Server(
    { name: "hermes-ide-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sessionId: string) => {
      log(`Session initialized: ${sessionId}`);
      const session: McpSession = { server, transport, createdAt: Date.now() };
      sessions.set(sessionId, session);
    },
  });

  registerToolHandlers(server);

  return { server, transport, createdAt: Date.now() };
}

/**
 * Clean up a session by ID
 */
async function destroySession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    try {
      await session.transport.close();
      await session.server.close();
    } catch {
      // ignore cleanup errors
    }
    sessions.delete(sessionId);
    log(`Session destroyed: ${sessionId}`);
  }
}

// ─────────────────────────────────────────────
// Hono HTTP router
// ─────────────────────────────────────────────

const app = new Hono();
app.use("/*", cors());

app.get("/health", (c) =>
  c.json({
    status: "ok",
    mcp: true,
    server: "hermes-ide-mcp",
    runtime: "bun",
    activeSessions: sessions.size,
  })
);

app.all("/mcp", async (c) => {
  const req = c.req.raw;

  // Extract session ID from request header
  const sessionId = req.headers.get("mcp-session-id");

  // POST without session ID and is initialize → create new session
  if (req.method === "POST" && !sessionId) {
    // Could be an initialize request — create a fresh session
    const { server, transport } = createSession();
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  // POST/GET/DELETE with session ID → route to existing session
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Invalid session ID. Session may have expired.",
          },
          id: null,
        },
        404
      );
    }

    // DELETE = close session
    if (req.method === "DELETE") {
      const response = await session.transport.handleRequest(req);
      await destroySession(sessionId);
      return response;
    }

    return session.transport.handleRequest(req);
  }

  // POST without session ID that isn't initialize — also create new session
  // (the transport will handle validation of the actual JSON-RPC content)
  if (req.method === "POST") {
    const { server, transport } = createSession();
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  // GET/DELETE without session ID
  return c.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message:
          "Bad Request: GET and DELETE requests require a valid mcp-session-id header.",
      },
      id: null,
    },
    400
  );
});

// ─────────────────────────────────────────────
// Session cleanup — remove stale sessions every 5 minutes
// ─────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      log(`Cleaning up stale session: ${id}`);
      destroySession(id);
    }
  }
}, 5 * 60 * 1000);

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

const PORT = parseInt(process.env.MCP_PORT || "51600", 10);

Bun.serve({
  port: PORT,
  idleTimeout: 120,
  fetch: app.fetch,
});

ipcSend({ type: "ready", port: PORT });
log(`Hermes IDE MCP Server running on http://localhost:${PORT}`);
