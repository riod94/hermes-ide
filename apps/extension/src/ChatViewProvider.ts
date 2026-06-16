import * as vscode from 'vscode';
import * as fs from 'fs';
import { HermesClient } from './HermesClient';
import { mcpBridge } from './McpBridge';
import { hostPathToContainer } from './pathMapper';

// TextDocumentContentProvider for hermes-draft
class HermesDraftProvider implements vscode.TextDocumentContentProvider {
  private _drafts = new Map<string, string>();
  
  public setDraft(filepath: string, content: string) {
    this._drafts.set(filepath, content);
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    const filepath = uri.path;
    
    // Check query param first (from MCP bridge)
    const params = new URLSearchParams(uri.query);
    const contentFromQuery = params.get('content');
    if (contentFromQuery) {
      return contentFromQuery;
    }

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
          this._handleResolveDiff(data.value);
          break;
        case 'clearChat':
          this.hermesClient.resetConversation();
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
      }
    });

    // Register command handler to receive events from MCP Bridge
    vscode.commands.registerCommand('hermes.showDiffControls', (payload: {
      diffId: string;
      filepath: string;
      new_content: string;
    }) => {
      this._showDiffInWebview(payload);
    });
  }

  /** Send a message to the webview */
  public postMessage(message: unknown) {
    this._view?.webview.postMessage(message);
  }

  /** Send pending diff to Webview UI */
  private _showDiffInWebview(payload: { diffId: string; filepath: string; new_content: string }) {
    this.postMessage({
      type: 'showPendingDiff',
      diff: {
        id: payload.diffId,
        filepath: payload.filepath,
        original_content: '',
        new_content: payload.new_content,
      },
    });
  }

  /** Handle opening Diff view in VS Code */
  private async _handleOpenDiff(payload: { filepath: string, originalContent: string, newContent: string }) {
    try {
      const containerPath = hostPathToContainer(payload.filepath);
      
      // If file doesn't exist yet (new file), use empty virtual doc as original
      let originalUri: vscode.Uri;
      if (fs.existsSync(containerPath)) {
        originalUri = vscode.Uri.file(containerPath);
      } else {
        originalUri = vscode.Uri.parse(`hermes-draft:${containerPath}?content=`);
      }
      
      draftProvider.setDraft(containerPath, payload.newContent);
      const draftUri = vscode.Uri.parse(`hermes-draft:${containerPath}?content=${encodeURIComponent(payload.newContent)}`);
      
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        draftUri,
        `Review Draft: ${containerPath.split('/').pop()}`,
        { preview: true }
      );
    } catch (e) {
      console.error('[Hermes] Failed to open diff', e);
      vscode.window.showErrorMessage('Hermes: Failed to open Diff view.');
    }
  }

  /** Handle user Approve/Reject — resolve via MCP Bridge HTTP */
  private async _handleResolveDiff(payload: { diffId: string, action: 'approve' | 'reject', filepath?: string, newContent?: string }) {
    try {
      // Map webview "approve" → MCP "accept"
      const decision = payload.action === 'approve' ? 'accept' : 'reject';
      await mcpBridge.resolveDiff(payload.diffId, decision);

      const filename = payload.filepath?.split('/').pop() || 'file';
      if (payload.action === 'approve') {
        vscode.window.showInformationMessage(`Hermes: Approved changes to ${filename}`);
      } else {
        vscode.window.showWarningMessage(`Hermes: Rejected changes to ${filename}`);
      }
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    } catch (e) {
      console.error('[Hermes] Failed to resolve diff', e);
      vscode.window.showErrorMessage('Hermes: Failed to resolve diff.');
    }
  }

  /** Handle incoming chat message from user */
  private async _handleChatMessage(text: string) {
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

    const responseId = `msg-${Date.now()}-assistant`;
    
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

    let fullContent = '';
    try {
      await this._hermesClient.streamChat(text, contextString, (chunk: string) => {
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

    this.postMessage({
      type: 'updateMessage',
      id: responseId,
      content: fullContent,
      status: 'done'
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'index.css')
    );

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
