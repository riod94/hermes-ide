import * as vscode from 'vscode';
import * as fs from 'fs';
import { HermesClient } from './HermesClient';
import { mcpBridge } from './McpBridge';
import { hostPathToContainer } from './pathMapper';
import { SessionManager, type SessionMessage } from './SessionManager';

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
  private _sessionManager: SessionManager;
  private _extensionUri: vscode.Uri;

  // Track current messages for session save
  private _currentMessages: SessionMessage[] = [];

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._extensionUri = _context.extensionUri;
    this._hermesClient = new HermesClient();
    this._sessionManager = new SessionManager(_context);
  }

  /** Expose HermesClient for external access */
  public get hermesClient(): HermesClient {
    return this._hermesClient;
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
          this._hermesClient.resetConversation();
          break;
        case 'copyCode':
          vscode.env.clipboard.writeText(data.value);
          vscode.window.showInformationMessage('Code copied to clipboard');
          break;
        case 'ready':
          console.log('[Hermes] Webview ready');
          this._handleWebviewReady();
          break;
        case 'openDiff':
          this._handleOpenDiff(data.value);
          break;
        // Session management messages
        case 'newSession':
          this._handleNewSession();
          break;
        case 'loadSession':
          this._handleLoadSession(data.value);
          break;
        case 'deleteSession':
          this._handleDeleteSession(data.value);
          break;
        case 'getSessions':
          this._sendSessionsList();
          break;
        case 'renameSession':
          this._handleRenameSession(data.value);
          break;
        // Model management messages
        case 'getModels':
          this._handleGetModels();
          break;
        case 'setModel':
          this._handleSetModel(data.value);
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

  // ───────────────── Session Management ─────────────────

  /** Handle webview ready — restore active session */
  private async _handleWebviewReady() {
    const session = await this._sessionManager.getOrCreateActiveSession(
      this._hermesClient.getConversationId()
    );

    // Restore conversation ID on HermesClient
    this._hermesClient.setConversationId(session.conversationId);
    this._currentMessages = [...session.messages];

    // Restore persisted model
    const savedModel = this._context.globalState.get<string>('hermes.activeModel');
    if (savedModel) {
      this._hermesClient.setModel(savedModel);
    }

    // Send session data to webview
    this.postMessage({
      type: 'sessionLoaded',
      session: {
        id: session.id,
        title: session.title,
        messages: session.messages,
      },
    });

    // Send sessions list
    this._sendSessionsList();

    // Fetch and send models
    this._handleGetModels();
  }

  /** Create new session (save current first) */
  private async _handleNewSession() {
    // Save current session before creating new
    const activeId = this._sessionManager.getActiveSessionId();
    if (activeId && this._currentMessages.length > 0) {
      await this._sessionManager.saveSession(
        activeId,
        this._currentMessages,
        this._hermesClient.getConversationId()
      );
    }

    // Reset client
    this._hermesClient.resetConversation();
    this._currentMessages = [];

    // Create new session
    const session = await this._sessionManager.createSession(
      this._hermesClient.getConversationId()
    );

    // Clear webview and notify
    this.postMessage({ type: 'clearMessages' });
    this.postMessage({
      type: 'activeSession',
      session: { id: session.id, title: session.title },
    });

    this._sendSessionsList();
  }

  /** Load an existing session */
  private async _handleLoadSession(data: { id: string }) {
    // Save current session before switching
    const activeId = this._sessionManager.getActiveSessionId();
    if (activeId && activeId !== data.id && this._currentMessages.length > 0) {
      await this._sessionManager.saveSession(
        activeId,
        this._currentMessages,
        this._hermesClient.getConversationId()
      );
    }

    const session = this._sessionManager.loadSession(data.id);
    if (!session) {
      vscode.window.showWarningMessage('Session not found');
      return;
    }

    // Set active
    await this._sessionManager.setActiveSessionId(data.id);
    this._hermesClient.setConversationId(session.conversationId);
    this._currentMessages = [...session.messages];

    // Send to webview
    this.postMessage({
      type: 'sessionLoaded',
      session: {
        id: session.id,
        title: session.title,
        messages: session.messages,
      },
    });

    this._sendSessionsList();
  }

  /** Delete a session */
  private async _handleDeleteSession(data: { id: string }) {
    const activeId = this._sessionManager.getActiveSessionId();
    await this._sessionManager.deleteSession(data.id);

    // If deleted active session, create new one
    if (activeId === data.id) {
      this._hermesClient.resetConversation();
      this._currentMessages = [];
      const session = await this._sessionManager.createSession(
        this._hermesClient.getConversationId()
      );
      this.postMessage({ type: 'clearMessages' });
      this.postMessage({
        type: 'activeSession',
        session: { id: session.id, title: session.title },
      });
    }

    this._sendSessionsList();
  }

  /** Rename a session */
  private async _handleRenameSession(data: { id: string; title: string }) {
    await this._sessionManager.renameSession(data.id, data.title);
    this._sendSessionsList();

    // If renaming active session, update header
    if (this._sessionManager.getActiveSessionId() === data.id) {
      this.postMessage({
        type: 'activeSession',
        session: { id: data.id, title: data.title },
      });
    }
  }

  /** Send sessions list to webview */
  private _sendSessionsList() {
    const sessions = this._sessionManager.listSessions();
    const activeId = this._sessionManager.getActiveSessionId();
    this.postMessage({
      type: 'sessionsUpdated',
      sessions,
      activeSessionId: activeId,
    });
  }

  /** Auto-save current session (called after message changes) */
  private async _autoSaveSession() {
    const activeId = this._sessionManager.getActiveSessionId();
    if (!activeId) return;
    await this._sessionManager.saveSession(
      activeId,
      this._currentMessages,
      this._hermesClient.getConversationId()
    );
  }

  // ───────────────── Model Management ─────────────────

  /** Fetch models from upstream and send to webview */
  private async _handleGetModels() {
    const modelList = await this._hermesClient.fetchModels();
    const currentModel = this._hermesClient.getModel();
    this.postMessage({
      type: 'modelsLoaded',
      models: modelList,
      activeModel: currentModel,
    });
  }

  /** Set model on HermesClient and persist to globalState */
  private async _handleSetModel(data: { id: string }) {
    this._hermesClient.setModel(data.id);
    await this._context.globalState.update('hermes.activeModel', data.id);
    this.postMessage({
      type: 'modelChanged',
      model: data.id,
    });
  }

  // ───────────────── Diff Handling ─────────────────

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

  // ───────────────── Chat Message Handling ─────────────────

  /** Handle incoming chat message from user */
  private async _handleChatMessage(text: string) {
    // Track user message
    const userMsg: SessionMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    this._currentMessages.push(userMsg);

    this.postMessage({
      type: 'addMessage',
      message: {
        ...userMsg,
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

    // Track assistant message and auto-save
    this._currentMessages.push({
      id: responseId,
      role: 'assistant',
      content: fullContent,
      timestamp: Date.now(),
    });

    await this._autoSaveSession();

    // Also update sessions list (preview/count changed)
    this._sendSessionsList();
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
