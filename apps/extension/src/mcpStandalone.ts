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
 *   GET  /health — health check
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
  // Write JSON line to stdout — Extension Host reads this
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
// MCP Server setup
// ─────────────────────────────────────────────

const mcpServer = new Server(
  { name: "hermes-ide-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

// List tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
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
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
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

// ─────────────────────────────────────────────
// Hono HTTP router
// ─────────────────────────────────────────────

const app = new Hono();
app.use("/*", cors());

app.get("/health", (c) =>
  c.json({ status: "ok", mcp: true, server: "hermes-ide-mcp", runtime: "bun" })
);

app.all("/mcp", async (c) => {
  return transport.handleRequest(c.req.raw);
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

const PORT = parseInt(process.env.MCP_PORT || "51600", 10);

await mcpServer.connect(transport);

Bun.serve({
  port: PORT,
  idleTimeout: 120,
  fetch: app.fetch,
});

ipcSend({ type: "ready", port: PORT });
log(`Hermes IDE MCP Server running on http://localhost:${PORT}`);
