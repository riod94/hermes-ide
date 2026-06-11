import * as vscode from 'vscode';

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
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'chatMessage':
          vscode.window.showInformationMessage(`Hermes received: ${data.value}`);
          break;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Placeholder HTML. Phase 4 will replace this with the built Svelte webview-ui dist.
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hermes Chat</title>
  <style>
    body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-foreground); }
    input { width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); box-sizing: border-box; }
    button { margin-top: 10px; width: 100%; padding: 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
  </style>
</head>
<body>
  <h2>Hermes AI</h2>
  <div id="chat-container" style="height: 300px; overflow-y: auto; margin-bottom: 10px; border: 1px solid var(--vscode-panel-border); padding: 5px;"></div>
  
  <input type="text" id="chat-input" placeholder="Ask Hermes something..." />
  <button id="send-btn">Send</button>

  <script>
    const vscode = acquireVsCodeApi();
    
    document.getElementById('send-btn').addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      const text = input.value;
      if (!text) return;

      const container = document.getElementById('chat-container');
      container.innerHTML += '<p><b>You:</b> ' + text + '</p>';
      
      vscode.postMessage({
        type: 'chatMessage',
        value: text
      });
      
      input.value = '';
    });
  </script>
</body>
</html>`;
  }
}
