import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'hermes.chatView';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri,
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
      }
    });
  }

  /** Send a message to the webview */
  public postMessage(message: unknown) {
    this._view?.webview.postMessage(message);
  }

  /** Handle incoming chat message from user */
  private _handleChatMessage(text: string) {
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

    // Simulate agent response (Phase 5 will connect to real Hermes gateway)
    const responseId = `msg-${Date.now()}-assistant`;
    this.postMessage({
      type: 'addMessage',
      message: {
        id: responseId,
        role: 'assistant',
        content: `Echo: "${text}"\n\n_Hermes gateway not connected yet. This is a Phase 4 placeholder response._`,
        timestamp: Date.now(),
        status: 'done',
      },
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Resolve paths to built webview-ui assets (bundled inside extension)
    const webviewDistPath = path.join(this._extensionUri.fsPath, 'webview-dist');

    // Read built assets
    let scriptContent = '';
    let styleContent = '';

    const jsPath = path.join(webviewDistPath, 'index.js');
    const cssPath = path.join(webviewDistPath, 'index.css');

    if (fs.existsSync(jsPath)) {
      scriptContent = fs.readFileSync(jsPath, 'utf-8');
    }
    if (fs.existsSync(cssPath)) {
      styleContent = fs.readFileSync(cssPath, 'utf-8');
    }

    // Use nonce for Content Security Policy
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src 'unsafe-inline' ${webview.cspSource};
                 script-src 'nonce-${nonce}';
                 font-src ${webview.cspSource};
                 img-src ${webview.cspSource} https: data:;">
  <title>Hermes Chat</title>
  <style nonce="${nonce}">${styleContent}</style>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}">${scriptContent}</script>
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
