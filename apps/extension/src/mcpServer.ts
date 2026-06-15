import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import * as vscode from "vscode";

export class MCPServerManager {
  private mcpServer: Server;
  private transport: WebStandardStreamableHTTPServerTransport;
  private app: Hono;
  private httpServer: ReturnType<typeof Bun.serve> | null = null;
  private port: number = 51600;

  // Menyimpan resolver untuk Promise yang mem-block agent sampai user Accept/Reject
  private pendingDiffResolvers: Map<
    string,
    { resolve: (value: "accept" | "reject") => void }
  > = new Map();

  constructor() {
    this.mcpServer = new Server(
      { name: "hermes-ide-mcp", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    this.transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    this.app = new Hono();
    this.setupRoutes();
    this.setupTools();
  }

  private setupRoutes() {
    // CORS — Hermes Agent connect dari localhost
    this.app.use("/*", cors());

    // Health check
    this.app.get("/health", (c) =>
      c.json({ status: "ok", mcp: true, server: "hermes-ide-mcp" })
    );

    // MCP Streamable HTTP endpoint — semua method (GET untuk SSE, POST untuk messages, DELETE untuk close)
    this.app.all("/mcp", async (c) => {
      return this.transport.handleRequest(c.req.raw);
    });
  }

  private setupTools() {
    // List tools — Milestone 2: expose ide_propose_diff
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
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

    // Handle tool call
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== "ide_propose_diff") {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      const { filepath, new_content } = request.params.arguments as {
        filepath: string;
        new_content: string;
      };

      try {
        const originalUri = vscode.Uri.file(filepath);

        // Baca file asli; jika belum ada, treat sebagai file baru
        let originalContent = "";
        try {
          const doc = await vscode.workspace.openTextDocument(originalUri);
          originalContent = doc.getText();
        } catch {
          console.log(`File ${filepath} not found, treating as new file.`);
        }

        // Buat draft URI untuk diff view
        const draftUri = vscode.Uri.parse(
          `hermes-draft:${filepath}?content=${encodeURIComponent(new_content)}`
        );

        // ID unik untuk melacak diff
        const diffId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Buka diff editor
        await vscode.commands.executeCommand(
          "vscode.diff",
          originalUri,
          draftUri,
          `Propose: ${filepath.split("/").pop()}`
        );

        // Kirim info ke Webview agar render tombol Accept/Reject
        vscode.commands.executeCommand("hermes.showDiffControls", {
          diffId,
          filepath,
          new_content,
        });

        // BLOCK agent: Promise tidak resolve sampai user klik Accept/Reject
        const decision = await new Promise<"accept" | "reject">((resolve) => {
          this.pendingDiffResolvers.set(diffId, { resolve });
        });

        if (decision === "accept") {
          // Tulis file ke disk
          await vscode.workspace.fs.writeFile(
            originalUri,
            Buffer.from(new_content, "utf-8")
          );

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
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  /**
   * Dipanggil dari extension command ketika user klik Accept atau Reject di UI
   */
  public resolveDiff(diffId: string, decision: "accept" | "reject") {
    const pending = this.pendingDiffResolvers.get(diffId);
    if (pending) {
      pending.resolve(decision);
      this.pendingDiffResolvers.delete(diffId);
    } else {
      console.warn(`No pending diff found for id: ${diffId}`);
    }
  }

  public async start() {
    // Connect MCP Server ke transport
    await this.mcpServer.connect(this.transport);

    // Start Bun HTTP server dengan Hono sebagai handler
    this.httpServer = Bun.serve({
      port: this.port,
      idleTimeout: 120, // SSE streams butuh idle timeout panjang
      fetch: this.app.fetch,
    });

    console.log(`Hermes IDE MCP Server running on http://localhost:${this.port}`);
  }

  public stop() {
    this.httpServer?.stop();
    this.mcpServer.close();
  }
}

// Singleton instance — diakses dari extension.ts dan ChatViewProvider
export const mcpServerManager = new MCPServerManager();
