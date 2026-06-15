/**
 * McpBridge — HTTP+SSE client to standalone MCP Service
 *
 * Replaces mcpServer.ts (subprocess spawn + IPC stdin/stdout).
 * Extension now communicates with MCP Service via HTTP:
 *   - GET  /api/events  → SSE stream for real-time diff proposals
 *   - POST /api/resolve → Send Accept/Reject decision
 *   - GET  /health      → Health check
 *   - GET  /api/pending → Poll pending diffs (fallback)
 */

import * as vscode from "vscode";
import * as fs from "fs";

export class McpBridge {
  private baseUrl: string;
  private outputChannel: vscode.OutputChannel;
  private sseController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;

  // Pending diffs — tracked locally for diff editor management
  private pendingDiffs = new Map<
    string,
    { filepath: string; new_content: string }
  >();

  // Callback: notify webview of new diff proposal
  private onDiffProposal:
    | ((payload: {
        diffId: string;
        filepath: string;
        new_content: string;
      }) => void)
    | null = null;

  constructor() {
    // MCP Service URL — read from env or default
    // In code-server container: MCP service runs on host, accessed via docker gateway
    // In local dev: MCP service runs on localhost
    const mcpUrl = process.env.MCP_SERVICE_URL || "";
    this.baseUrl = mcpUrl || this.discoverMcpUrl();
    this.outputChannel = vscode.window.createOutputChannel("Hermes MCP Bridge");
  }

  /**
   * Auto-discover MCP service URL based on environment
   */
  private discoverMcpUrl(): string {
    // Option 1: Explicit env var (set in docker-compose or systemd)
    if (process.env.MCP_SERVICE_URL) {
      return process.env.MCP_SERVICE_URL;
    }

    // Option 2: Inside Docker container — use host.docker.internal or gateway
    // LSIO containers use bridge networking, host is accessible via 172.17.0.1
    if (fs.existsSync("/.dockerenv")) {
      const mcpPort = process.env.MCP_PORT || "56007";
      return `http://172.17.0.1:${mcpPort}`;
    }

    // Option 3: Local development — localhost
    return "http://127.0.0.1:56007";
  }

  /**
   * Set callback for when MCP service sends a diff proposal
   */
  public onDiff(
    callback: (payload: {
      diffId: string;
      filepath: string;
      new_content: string;
    }) => void
  ) {
    this.onDiffProposal = callback;
  }

  /**
   * Start SSE connection to MCP service for real-time events
   */
  public async start(): Promise<void> {
    this.log(`Connecting to MCP Service at ${this.baseUrl}`);

    // Initial health check
    const healthy = await this.healthCheck();
    if (!healthy) {
      this.log("MCP Service not reachable — will retry in background");
      this.scheduleReconnect();
      return;
    }

    // Fetch any already-pending diffs (in case extension restarted)
    await this.fetchPendingDiffs();

    // Start SSE stream
    this.connectSSE();
  }

  /**
   * Health check — GET /health
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        this.log(
          `Health OK — sessions: ${data.activeSessions}, pending: ${data.pendingDiffs}`
        );
        return true;
      }
      return false;
    } catch (e: any) {
      this.log(`Health check failed: ${e.message}`);
      return false;
    }
  }

  /**
   * Fetch currently pending diffs — GET /api/pending
   */
  private async fetchPendingDiffs(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pending`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return;

      const data = (await response.json()) as {
        pending: Array<{
          diffId: string;
          filepath: string;
          new_content: string;
        }>;
      };

      for (const diff of data.pending) {
        this.handleDiffProposal(diff);
      }
    } catch (e: any) {
      this.log(`Failed to fetch pending diffs: ${e.message}`);
    }
  }

  /**
   * Connect to SSE stream — GET /api/events
   */
  private connectSSE(): void {
    this.sseController = new AbortController();

    this.log("Opening SSE connection...");

    fetch(`${this.baseUrl}/api/events`, {
      signal: this.sseController.signal,
      headers: { Accept: "text/event-stream" },
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        this.connected = true;
        this.log("SSE connected");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            this.handleSSEMessage(part);
          }
        }

        // Stream ended — reconnect
        this.connected = false;
        this.log("SSE stream ended");
        this.scheduleReconnect();
      })
      .catch((e: any) => {
        if (e.name === "AbortError") return; // intentional disconnect
        this.connected = false;
        this.log(`SSE error: ${e.message}`);
        this.scheduleReconnect();
      });
  }

  /**
   * Parse and handle an SSE message block
   */
  private handleSSEMessage(block: string): void {
    let event = "message";
    let data = "";

    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) {
        event = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        data = line.slice(6);
      } else if (line.startsWith(":")) {
        // Comment (heartbeat) — ignore
        return;
      }
    }

    if (!data) return;

    try {
      const payload = JSON.parse(data);

      switch (event) {
        case "diffProposal":
          this.handleDiffProposal(payload);
          break;

        case "diffResolved":
          this.handleDiffResolved(payload);
          break;

        case "connected":
          this.log("SSE handshake confirmed");
          break;

        default:
          this.log(`Unknown SSE event: ${event}`);
      }
    } catch (e: any) {
      this.log(`Failed to parse SSE data: ${e.message}`);
    }
  }

  /**
   * Handle incoming diff proposal — open diff editor & notify webview
   */
  private async handleDiffProposal(payload: {
    diffId: string;
    filepath: string;
    new_content: string;
  }): Promise<void> {
    this.log(`Diff proposal: ${payload.filepath} (${payload.diffId})`);

    // Store locally
    this.pendingDiffs.set(payload.diffId, {
      filepath: payload.filepath,
      new_content: payload.new_content,
    });

    // Open VS Code diff editor
    try {
      let originalUri = vscode.Uri.file(payload.filepath);

      // Create file → use empty virtual URI
      if (!fs.existsSync(payload.filepath)) {
        originalUri = vscode.Uri.parse(
          `hermes-draft:${payload.filepath}?content=`
        );
      }

      const draftUri = vscode.Uri.parse(
        `hermes-draft:${payload.filepath}?content=${encodeURIComponent(payload.new_content)}`
      );

      await vscode.commands.executeCommand(
        "vscode.diff",
        originalUri,
        draftUri,
        `Propose: ${payload.filepath.split("/").pop()}`
      );
    } catch (e: any) {
      this.log(`Failed to open diff editor: ${e.message}`);
    }

    // Notify webview via callback
    if (this.onDiffProposal) {
      this.onDiffProposal(payload);
    }
  }

  /**
   * Handle diff resolved event (from SSE — may come from another Extension instance)
   */
  private handleDiffResolved(payload: {
    diffId: string;
    decision: string;
    filepath: string;
  }): void {
    this.log(`Diff resolved: ${payload.diffId} → ${payload.decision}`);
    this.pendingDiffs.delete(payload.diffId);

    const filename = payload.filepath.split("/").pop() || "file";
    if (payload.decision === "accept") {
      vscode.window.showInformationMessage(
        `Hermes: Applied changes to ${filename}`
      );
    } else {
      vscode.window.showWarningMessage(
        `Hermes: Rejected changes to ${filename}`
      );
    }

    vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  }

  /**
   * Send Accept/Reject decision to MCP service — POST /api/resolve
   * Called from webview via ChatViewProvider
   */
  public async resolveDiff(
    diffId: string,
    decision: "accept" | "reject"
  ): Promise<void> {
    this.log(`Resolving diff: ${diffId} → ${decision}`);

    try {
      const response = await fetch(`${this.baseUrl}/api/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffId, decision }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      this.pendingDiffs.delete(diffId);
      this.log(`Diff ${diffId} resolved successfully`);
    } catch (e: any) {
      this.log(`Failed to resolve diff: ${e.message}`);
      vscode.window.showErrorMessage(
        `Hermes: Failed to resolve diff — ${e.message}`
      );
    }
  }

  /**
   * Schedule reconnect with exponential backoff
   */
  private scheduleReconnect(delayMs = 5000): void {
    if (this.reconnectTimer) return;

    this.log(`Reconnecting in ${delayMs / 1000}s...`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      const healthy = await this.healthCheck();
      if (healthy) {
        this.connectSSE();
      } else {
        // Exponential backoff, max 30s
        this.scheduleReconnect(Math.min(delayMs * 2, 30000));
      }
    }, delayMs);
  }

  /**
   * Stop SSE connection and cleanup
   */
  public stop(): void {
    if (this.sseController) {
      this.sseController.abort();
      this.sseController = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connected = false;
    this.log("MCP Bridge stopped");
  }

  /**
   * Check if SSE is connected
   */
  public isConnected(): boolean {
    return this.connected;
  }

  private log(message: string) {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
  }
}

// Singleton
export const mcpBridge = new McpBridge();
