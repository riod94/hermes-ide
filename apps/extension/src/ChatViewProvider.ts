import * as vscode from 'vscode';
import { HermesClient } from './HermesClient';

// TextDocumentContentProvider for hermes-draft
class HermesDraftProvider implements vscode.TextDocumentContentProvider {
  private _drafts = new Map<string, string>();
  
  public setDraft(filepath: string, content: string) {
    this._drafts.set(filepath, content);
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    // uri is something like hermes-draft:/path/to/file
    const filepath = uri.path;
    return this._drafts.get(filepath) || '';
  }
}

export const draftProvider = new HermesDraftProvider();

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'hermes.chatView';
  private _view?: vscode.WebviewView;
  private _hermesClient: HermesClient;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._hermesClient = new HermesClient();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'webview-dist'),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'chatMessage':
          this._handleChatMessage(data.value);
          break;
        case 'resolveDiff':
          if (data.action === "approve") {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(vscode.Uri.file(data.filepath), new vscode.Range(0, 0, 99999, 99999), data.newContent);
            vscode.workspace.applyEdit(edit).then(success => {
              if (success) {
                vscode.window.showInformationMessage("Diff Applied!");
                // optionally close diff tab
              }
            });
          }
          break;
        case 'clearChat':
          // Future: persist clear state
          break;
        case 'copyCode':
          vscode.env.clipboard.writeText(data.value);
          vscode.window.showInformationMessage('Code copied to clipboard');
          break;
        case 'ready':
          console.log('[Hermes] Webview ready');
          break;
        case 'openDiff':
          this._handleOpenDiff(data.value);
          break;
        case 'resolveDiff':
          this._handleResolveDiff(data.value);
          break;
      }
    });
  }

  /** Send a message to the webview */
  public postMessage(message: unknown) {
    this._view?.webview.postMessage(message);
  }

  /** Handle opening Diff view in VS Code */
  private async _handleOpenDiff(payload: { filepath: string, originalContent: string, newContent: string }) {
    try {
      const originalUri = vscode.Uri.file(payload.filepath);
      
      // Provide a virtual doc for the proposed changes
      draftProvider.setDraft(payload.filepath, payload.newContent);
      const draftUri = vscode.Uri.parse(`hermes-draft:${payload.filepath}`);
      
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        draftUri,
        `Review Draft: ${payload.filepath.split('/').pop()}`,
        { preview: true }
      );
    } catch (e) {
      console.error('[Hermes] Failed to open diff', e);
      vscode.window.showErrorMessage('Hermes: Failed to open Diff view.');
    }
  }

  /** Handle user Approve/Reject action on diff */
  private async _handleResolveDiff(payload: { diffId: string, action: 'approve' | 'reject', filepath?: string, newContent?: string }) {
    try {
      // If approved, write to real file system first
      if (payload.action === 'approve' && payload.filepath && payload.newContent !== undefined) {
        const fileUri = vscode.Uri.file(payload.filepath);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(fileUri, encoder.encode(payload.newContent));
        vscode.window.showInformationMessage(`Hermes: Applied changes to ${payload.filepath.split('/').pop()}`);
        
        // Close the diff tab automatically
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      }

      // Notify the MCP Interceptor
      const res = await globalThis.fetch(`http://host.docker.internal:51500/api/diffs/${payload.diffId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: payload.action })
      });

      if (!res.ok) {
        throw new Error(`Failed to resolve on Interceptor API. Status: ${res.status}`);
      }
    } catch (e) {
      console.error('[Hermes] Failed to resolve diff', e);
      vscode.window.showErrorMessage('Hermes: Failed to notify agent about diff resolution.');
    }
  }

  /** Handle incoming chat message from user */
  private async _handleChatMessage(text: string) {
    // Add user message to webview
    this.postMessage({
      type: 'addMessage',
      message: {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
        status: 'done',
      },
    });

    // Generate unique ID for assistant response
    const responseId = `msg-${Date.now()}-assistant`;
    
    // Create initial empty response
    this.postMessage({
      type: 'addMessage',
      message: {
        id: responseId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'streaming',
      },
    });

    // Gather VS Code Context
    const editor = vscode.window.activeTextEditor;
    let contextString = '';
    
    if (editor) {
      const doc = editor.document;
      const selections = editor.selections;
      const selectedText = selections.map(s => doc.getText(s)).join('\n').trim();
      
      contextString += `Active File: ${vscode.workspace.asRelativePath(doc.uri)}\n`;
      if (selectedText) {
        contextString += `Selected Code:\n\`\`\`\n${selectedText}\n\`\`\`\n`;
      }
      
      // Get active diagnostics (linter errors) for current file
      const diagnostics = vscode.languages.getDiagnostics(doc.uri);
      if (diagnostics.length > 0) {
        const errors = diagnostics
          .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
          .map(d => `- Line ${d.range.start.line + 1}: ${d.message}`)
          .join('\n');
        
        if (errors) {
          contextString += `Current Linter Errors:\n${errors}\n`;
        }
      }
    }

    // Call Hermes API
    let fullContent = '';
    try {
      await this._hermesClient.streamChat(text, contextString, (chunk: string) => {
        // CEGATAN: Tangkap perintah "__HERMES_PROPOSE_DIFF__" dari Client
        if (chunk === "__HERMES_PROPOSE_DIFF__") {
          // Beri tahu Svelte UI untuk merender alert Diff!
          this.postMessage({
            type: 'triggerDiff',
            filepath: editor?.document.uri.fsPath || "workspace-file",
            // Ideally LLM akan memberikan isi diff-nya, tapi untuk saat ini:
            // kita hardcode dummy diff sebagai proof of concept
            originalContent: editor?.document.getText() || "",
            newContent: (editor?.document.getText() || "") + "\n// Proposed by Hermes"
          });
          return;
        }

        fullContent += chunk;
        this.postMessage({
          type: 'updateMessage',
          id: responseId,
          content: fullContent,
          status: 'streaming',
        });
      });
    } catch (e: any) {
      console.error(e);
      fullContent += `\n\nError: ${e.message}`;
    }

    // Finalize message status
    this.postMessage({
      type: 'updateMessage',
      id: responseId,
      content: fullContent,
      status: 'done'
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Use webview URIs for external script/style loading (standard VS Code approach)
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'index.css')
    );

    // Use nonce for Content Security Policy
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}';
                 font-src ${webview.cspSource};
                 img-src ${webview.cspSource} https: data:;
                 trusted-types svelte-trusted-html;">
  <title>Hermes Chat</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
