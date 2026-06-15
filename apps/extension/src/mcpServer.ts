/**
 * MCPServerManager — spawn manager for standalone Bun MCP server
 *
 * Runs in Extension Host (Node.js). Spawns `bun run mcpStandalone.ts`
 * as a child process and communicates via stdin/stdout JSON lines.
 *
 * This file is bundled by esbuild into extension.js (Node.js compatible).
 */

import * as vscode from "vscode";
import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import { join } from "path";

export class MCPServerManager {
  private child: ChildProcess | null = null;
  private outputChannel: vscode.OutputChannel;

  // Pending diff resolvers — for bridging resolveDiff from webview to child process
  private pendingDiffs = new Map<
    string,
    { filepath: string; new_content: string }
  >();

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Hermes MCP");
  }

  /**
   * Start the standalone Bun MCP server as a child process
   */
  public async start(extensionPath: string): Promise<void> {
    const standaloneScript = join(extensionPath, "dist", "mcpStandalone.js");

    this.outputChannel.appendLine(
      `Starting MCP server: bun run ${standaloneScript}`
    );

    // Spawn bun process
    this.child = spawn("bun", ["run", standaloneScript], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        MCP_PORT: "51600",
      },
    });

    if (!this.child.stdout || !this.child.stdin) {
      throw new Error("Failed to create stdio pipes for MCP server");
    }

    // Listen for JSON lines from stdout
    const rl = createInterface({ input: this.child.stdout });
    rl.on("line", (line: string) => {
      this.handleChildMessage(line);
    });

    // Log stderr
    if (this.child.stderr) {
      const errRl = createInterface({ input: this.child.stderr });
      errRl.on("line", (line: string) => {
        this.outputChannel.appendLine(`[MCP stderr] ${line}`);
      });
    }

    // Handle process exit
    this.child.on("exit", (code, signal) => {
      this.outputChannel.appendLine(
        `MCP server exited (code: ${code}, signal: ${signal})`
      );
      this.child = null;
    });

    this.child.on("error", (err) => {
      this.outputChannel.appendLine(`MCP server error: ${err.message}`);
      vscode.window.showErrorMessage(
        `Hermes MCP Server failed: ${err.message}. Is 'bun' installed?`
      );
      this.child = null;
    });

    // Wait for "ready" signal (timeout 15s)
    await this.waitForReady(15000);
  }

  /**
   * Wait until child sends { type: "ready" }
   */
  private waitForReady(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("MCP server did not send ready signal in time"));
      }, timeoutMs);

      const checkReady = (line: string) => {
        try {
          const msg = JSON.parse(line);
          if (msg.type === "ready") {
            clearTimeout(timeout);
            this.outputChannel.appendLine(
              `MCP server ready on port ${msg.port}`
            );
            // Remove this one-time listener — ongoing listening is in start()
            resolve();
          }
        } catch {
          // ignore parse errors during wait
        }
      };

      if (this.child?.stdout) {
        // Tap into the same stream — readline in start() will also get these
        this.child.stdout.on("data", (chunk: Buffer) => {
          const lines = chunk.toString().split("\n").filter(Boolean);
          for (const line of lines) {
            checkReady(line);
          }
        });
      }
    });
  }

  /**
   * Handle a JSON line message from the child process
   */
  private handleChildMessage(line: string) {
    try {
      const msg = JSON.parse(line);

      switch (msg.type) {
        case "diffProposal":
          this.handleDiffProposal(msg);
          break;

        case "diffResult":
          this.handleDiffResult(msg);
          break;

        case "log":
          this.outputChannel.appendLine(`[MCP] ${msg.message}`);
          break;

        case "ready":
          // Already handled in waitForReady, but log it
          this.outputChannel.appendLine(`[MCP] Server ready on port ${msg.port}`);
          break;

        default:
          this.outputChannel.appendLine(
            `[MCP] Unknown message type: ${msg.type}`
          );
      }
    } catch {
      // Non-JSON output — log as-is
      if (line.trim()) {
        this.outputChannel.appendLine(`[MCP stdout] ${line}`);
      }
    }
  }

  /**
   * Child process sent a diff proposal — open diff editor & notify webview
   */
  private async handleDiffProposal(msg: {
    diffId: string;
    filepath: string;
    new_content: string;
  }) {
    this.outputChannel.appendLine(
      `Diff proposal: ${msg.filepath} (${msg.diffId})`
    );

    // Store for later reference
    this.pendingDiffs.set(msg.diffId, {
      filepath: msg.filepath,
      new_content: msg.new_content,
    });

    // Open VS Code diff editor
    try {
      const originalUri = vscode.Uri.file(msg.filepath);

      // Create draft URI for diff view
      const draftUri = vscode.Uri.parse(
        `hermes-draft:${msg.filepath}?content=${encodeURIComponent(msg.new_content)}`
      );

      await vscode.commands.executeCommand(
        "vscode.diff",
        originalUri,
        draftUri,
        `Propose: ${msg.filepath.split("/").pop()}`
      );
    } catch (e: any) {
      this.outputChannel.appendLine(`Failed to open diff editor: ${e.message}`);
    }

    // Notify webview to show Accept/Reject controls
    vscode.commands.executeCommand("hermes.showDiffControls", {
      diffId: msg.diffId,
      filepath: msg.filepath,
      new_content: msg.new_content,
    });
  }

  /**
   * Child process confirmed diff result — show notification
   */
  private handleDiffResult(msg: {
    diffId: string;
    decision: string;
    filepath: string;
  }) {
    const filename = msg.filepath.split("/").pop() || "file";

    if (msg.decision === "accept") {
      vscode.window.showInformationMessage(
        `Hermes: Applied changes to ${filename}`
      );
    } else {
      vscode.window.showWarningMessage(
        `Hermes: Rejected changes to ${filename}`
      );
    }

    // Close diff editor
    vscode.commands.executeCommand("workbench.action.closeActiveEditor");

    this.pendingDiffs.delete(msg.diffId);
  }

  /**
   * Called from extension command when user clicks Accept/Reject in webview
   * Sends decision to child process via stdin
   */
  public resolveDiff(diffId: string, decision: "accept" | "reject") {
    if (!this.child?.stdin) {
      this.outputChannel.appendLine(
        "Cannot resolve diff: MCP server not running"
      );
      return;
    }

    this.child.stdin.write(
      JSON.stringify({ type: "resolveDiff", diffId, decision }) + "\n"
    );

    this.outputChannel.appendLine(`Sent resolveDiff: ${diffId} → ${decision}`);
  }

  /**
   * Stop the child process
   */
  public stop() {
    if (this.child) {
      this.child.kill("SIGTERM");
      this.child = null;
      this.outputChannel.appendLine("MCP server stopped");
    }
  }

  /**
   * Check if the server is running
   */
  public isRunning(): boolean {
    return this.child !== null && !this.child.killed;
  }
}

// Singleton
export const mcpServerManager = new MCPServerManager();
