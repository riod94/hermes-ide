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

  // AbortController for stopping streaming generation
  private _streamAbortController: AbortController | null = null;

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
          this._handleChatMessage(data.value, data.attachments);
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
        // Context attachment messages (@ mentions)
        case 'pickFile':
          this._handlePickFile();
          break;
        case 'pickFolder':
          this._handlePickFolder();
          break;
        case 'pickTerminal':
          this._handlePickTerminal();
          break;
        case 'pickRules':
          this._handlePickRules();
          break;
        case 'pickUrl':
          this._handlePickUrl();
          break;
        case 'pickAttachment':
          this._handlePickAttachment();
          break;
        case 'pickImage':
          this._handlePickImage();
          break;
        case 'localFileAttached':
          this._handleLocalFileAttached(data.file);
          break;
        case 'retryMessage':
          this._handleRetryMessage();
          break;
        case 'stopGeneration':
          this._handleStopGeneration();
          break;
        case 'unsendMessage':
          this._handleUnsendMessage(data.messageId);
          break;
        case 'showWarning':
          vscode.window.showWarningMessage(data.value);
          break;
        case 'checkpointAction':
          this._handleCheckpointAction(data.action, data.checkpoint);
          break;
        case 'openLink':
          if (data.value) {
            vscode.env.openExternal(vscode.Uri.parse(data.value));
          }
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

    // Register "Add Selection to Chat" command (Ctrl+L / Cmd+L)
    vscode.commands.registerCommand('hermes.addToChat', async () => {
      await this._handleAddToChat();
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

    // Fetch and send skills
    this._handleGetSkills();
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

  /** Fetch and send skills list to webview */
  private async _handleGetSkills() {
    const skillList = await this._hermesClient.fetchSkills();
    this.postMessage({
      type: 'skillsLoaded',
      skills: skillList,
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

  // ───────────────── Context Attachments (@mentions) ─────────────────

  /** Handle @file pick — QuickPick to search files in workspace */
  private async _handlePickFile() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    // Find all files in workspace (excluding common noise)
    const files = await vscode.workspace.findFiles(
      '**/*',
      '{**/node_modules/**,**/dist/**,**/.git/**,**/vendor/**,**/bun.lock,**/*.vsix}',
      500
    );

    const items = files.map(uri => {
      const relativePath = vscode.workspace.asRelativePath(uri);
      const fileName = uri.path.split('/').pop() || 'file';
      return {
        label: `📄 ${fileName}`,
        description: relativePath,
        uri,
        relativePath,
        fileName,
      };
    }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Search and select a file to attach as context…',
      matchOnDescription: true,
    });

    if (!selected) return;

    this.postMessage({
      type: 'attachmentAdded',
      attachment: {
        type: 'file',
        name: selected.fileName,
        path: selected.relativePath,
      },
    });
  }

  /** Handle @folder pick — QuickPick to search folders in workspace */
  private async _handlePickFolder() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    // Find all directories by searching for any file then extracting unique dirs
    const files = await vscode.workspace.findFiles(
      '**/*',
      '{**/node_modules/**,**/dist/**,**/.git/**,**/vendor/**}',
      1000
    );

    // Extract unique directories
    const dirSet = new Set<string>();
    for (const uri of files) {
      const rel = vscode.workspace.asRelativePath(uri);
      const parts = rel.split('/');
      // Build all parent dirs
      for (let i = 1; i < parts.length; i++) {
        dirSet.add(parts.slice(0, i).join('/'));
      }
    }

    const items = Array.from(dirSet)
      .sort()
      .map(dirPath => ({
        label: `📁 ${dirPath.split('/').pop()}`,
        description: dirPath,
        dirPath,
      }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Search and select a folder to attach as context…',
      matchOnDescription: true,
    });

    if (!selected) return;

    // List files in selected folder
    const folderUri = vscode.Uri.joinPath(workspaceFolder.uri, selected.dirPath);
    const folderName = selected.dirPath.split('/').pop() || 'folder';

    try {
      const entries = await vscode.workspace.fs.readDirectory(folderUri);
      const fileList = entries
        .filter(([, type]) => type === vscode.FileType.File)
        .map(([name]) => ({
          name,
          path: `${selected.dirPath}/${name}`,
        }));

      this.postMessage({
        type: 'folderFilesAdded',
        folderName,
        folderPath: selected.dirPath,
        files: fileList,
      });
    } catch {
      this.postMessage({
        type: 'folderFilesAdded',
        folderName,
        folderPath: selected.dirPath,
        files: [],
      });
    }
  }

  /** Handle @terminal pick — list active terminals and capture their content */
  private async _handlePickTerminal() {
    const terminals = vscode.window.terminals;
    if (terminals.length === 0) {
      vscode.window.showWarningMessage('No active terminals found');
      return;
    }

    const items = terminals.map((term, idx) => ({
      label: `⬛ ${term.name}`,
      description: `Terminal ${idx + 1}`,
      terminal: term,
      index: idx,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a terminal to attach its output…',
    });

    if (!selected) return;

    // Use shellIntegration to read recent output if available
    const term = selected.terminal;
    let terminalContent = '';

    try {
      // VS Code 1.93+ shellIntegration API
      if ((term as any).shellIntegration) {
        const shellIntegration = (term as any).shellIntegration;
        // Try to read recent commands
        if (shellIntegration.executeCommand) {
          // Fallback: read via clipboard workaround
          terminalContent = await this._readTerminalViaClipboard(term);
        } else if (shellIntegration.cwd) {
          terminalContent = `[Terminal: ${term.name}] CWD: ${shellIntegration.cwd.fsPath}`;
        }
      }

      // Fallback: select all text from terminal via clipboard
      if (!terminalContent) {
        terminalContent = await this._readTerminalViaClipboard(term);
      }
    } catch (e) {
      console.error('[Hermes] Failed to read terminal output', e);
      terminalContent = `[Terminal: ${term.name}] (could not capture output)`;
    }

    // Truncate to 10KB
    if (terminalContent.length > 10240) {
      terminalContent = terminalContent.slice(-10240) + '\n... (truncated, showing last ~10KB)';
    }

    this.postMessage({
      type: 'attachmentAdded',
      attachment: {
        type: 'terminal',
        name: term.name,
        path: `terminal://${term.name}`,
        content: terminalContent,
      },
    });
  }

  /** Read terminal content via clipboard (select all → copy → restore) */
  private async _readTerminalViaClipboard(terminal: vscode.Terminal): Promise<string> {
    // Save current clipboard
    const savedClipboard = await vscode.env.clipboard.readText();

    try {
      // Focus the terminal, select all, copy
      terminal.show(false);
      await new Promise(r => setTimeout(r, 100));
      await vscode.commands.executeCommand('workbench.action.terminal.selectAll');
      await new Promise(r => setTimeout(r, 100));
      await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
      await new Promise(r => setTimeout(r, 100));
      // Clear selection
      await vscode.commands.executeCommand('workbench.action.terminal.clearSelection');

      const content = await vscode.env.clipboard.readText();

      // Restore original clipboard
      await vscode.env.clipboard.writeText(savedClipboard);

      return content || `[Terminal: ${terminal.name}] (empty or no output)`;
    } catch {
      // Restore clipboard on failure
      await vscode.env.clipboard.writeText(savedClipboard);
      return `[Terminal: ${terminal.name}] (could not capture output)`;
    }
  }

  /** Handle @rules pick — scan for project guidelines/rules files */
  private async _handlePickRules() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    // Known rules/guidelines file patterns
    const rulePatterns = [
      '.cursorrules',
      '.cursorignore',
      'AGENTS.md',
      'CLAUDE.md',
      'COPILOT.md',
      'RULES.md',
      'CONVENTIONS.md',
      'GUIDELINES.md',
      'CONTRIBUTING.md',
      'CODING_STANDARDS.md',
      '.editorconfig',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.json',
      '.eslintrc.yml',
      '.prettierrc',
      '.prettierrc.js',
      '.prettierrc.json',
      'eslint.config.js',
      'eslint.config.mjs',
      'biome.json',
      'biome.jsonc',
      '.stylelintrc',
      '.stylelintrc.json',
    ];

    // Search for matching files
    const foundFiles: Array<{ label: string; description: string; relativePath: string; uri: vscode.Uri }> = [];

    for (const pattern of rulePatterns) {
      const matches = await vscode.workspace.findFiles(
        `**/${pattern}`,
        '{**/node_modules/**,**/dist/**,**/.git/**,**/vendor/**}',
        5
      );
      for (const uri of matches) {
        const relativePath = vscode.workspace.asRelativePath(uri);
        foundFiles.push({
          label: `📏 ${pattern}`,
          description: relativePath,
          relativePath,
          uri,
        });
      }
    }

    if (foundFiles.length === 0) {
      vscode.window.showInformationMessage('No project rules/guidelines files found');
      return;
    }

    // Deduplicate by relativePath
    const unique = Array.from(
      new Map(foundFiles.map(f => [f.relativePath, f])).values()
    ).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const selected = await vscode.window.showQuickPick(unique, {
      placeHolder: 'Select a rules/guidelines file to attach…',
      canPickMany: true,
    });

    if (!selected || selected.length === 0) return;

    for (const item of selected) {
      this.postMessage({
        type: 'attachmentAdded',
        attachment: {
          type: 'rules',
          name: item.relativePath.split('/').pop() || item.relativePath,
          path: item.relativePath,
        },
      });
    }
  }

  /** Handle @url pick — InputBox for URL, fetch content server-side */
  private async _handlePickUrl() {
    const url = await vscode.window.showInputBox({
      placeHolder: 'https://example.com/docs/api',
      prompt: 'Enter a URL to fetch and attach as context',
      validateInput: (value) => {
        if (!value) return 'URL is required';
        try {
          const parsed = new URL(value);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return 'Only http:// and https:// URLs are supported';
          }
          return null;
        } catch {
          return 'Invalid URL format';
        }
      },
    });

    if (!url) return;

    // Show progress while fetching
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fetching ${url}…`,
        cancellable: false,
      },
      async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);

          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'HermesIDE/1.0',
              'Accept': 'text/html, text/plain, application/json, */*',
            },
            redirect: 'follow',
          });
          clearTimeout(timeout);

          if (!response.ok) {
            vscode.window.showWarningMessage(`Failed to fetch URL: ${response.status} ${response.statusText}`);
            return;
          }

          const contentType = response.headers.get('content-type') || '';
          const rawBody = await response.text();
          let extractedText: string;

          if (contentType.includes('text/html')) {
            extractedText = this._stripHtmlToText(rawBody);
          } else if (contentType.includes('application/json')) {
            // Pretty-print JSON
            try {
              extractedText = JSON.stringify(JSON.parse(rawBody), null, 2);
            } catch {
              extractedText = rawBody;
            }
          } else {
            // Plain text, markdown, etc.
            extractedText = rawBody;
          }

          // Truncate to 10KB
          if (extractedText.length > 10240) {
            extractedText = extractedText.slice(0, 10240) + '\n... (truncated, content too large)';
          }

          // Derive a short display name from the URL
          const parsedUrl = new URL(url);
          const displayName = parsedUrl.hostname + (parsedUrl.pathname !== '/' ? parsedUrl.pathname : '');
          const shortName = displayName.length > 50 ? displayName.slice(0, 47) + '…' : displayName;

          this.postMessage({
            type: 'attachmentAdded',
            attachment: {
              type: 'url',
              name: shortName,
              path: url,
              content: extractedText,
            },
          });
        } catch (e: any) {
          if (e.name === 'AbortError') {
            vscode.window.showWarningMessage('URL fetch timed out (15s limit)');
          } else {
            vscode.window.showWarningMessage(`Failed to fetch URL: ${e.message}`);
          }
        }
      }
    );
  }

  /** Strip HTML tags and extract readable text */
  private _stripHtmlToText(html: string): string {
    // Remove script and style blocks entirely
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

    // Convert common block elements to newlines
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|h[1-6]|li|tr|blockquote|pre|section|article)[^>]*>/gi, '\n')
      .replace(/<hr[^>]*>/gi, '\n---\n');

    // Strip all remaining tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode common HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

    // Collapse excessive whitespace
    text = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    return text;
  }

  /** Handle [+] attachment button — QuickPick menu for file or image */
  private async _handlePickAttachment() {
    const options = [
      { label: '📄 File', description: 'Attach a file as text context', id: 'file' },
      { label: '🖼️ Image', description: 'Attach an image for vision analysis', id: 'image' },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'What would you like to attach?',
    });

    if (!selected) return;

    if (selected.id === 'file') {
      this._handlePickFile();
    } else if (selected.id === 'image') {
      this._handlePickImage();
    }
  }

  /** Handle image pick — QuickPick to search image files in workspace, encode base64 */
  private async _handlePickImage() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    // Find image files in workspace
    const imageFiles = await vscode.workspace.findFiles(
      '**/*.{png,jpg,jpeg,gif,webp,svg,bmp,ico}',
      '{**/node_modules/**,**/dist/**,**/.git/**,**/vendor/**}',
      200
    );

    if (imageFiles.length === 0) {
      vscode.window.showInformationMessage('No image files found in workspace');
      return;
    }

    const items = imageFiles.map(uri => {
      const relativePath = vscode.workspace.asRelativePath(uri);
      const fileName = uri.path.split('/').pop() || 'image';
      return {
        label: `🖼️ ${fileName}`,
        description: relativePath,
        uri,
        relativePath,
        fileName,
      };
    }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Search and select an image to attach…',
      matchOnDescription: true,
    });

    if (!selected) return;

    try {
      const fileContent = await vscode.workspace.fs.readFile(selected.uri);
      const fileSizeKB = fileContent.byteLength / 1024;

      // Limit to 2MB
      if (fileContent.byteLength > 2 * 1024 * 1024) {
        vscode.window.showWarningMessage(`Image too large (${(fileSizeKB / 1024).toFixed(1)}MB). Max 2MB.`);
        return;
      }

      // Convert to base64
      const base64 = Buffer.from(fileContent).toString('base64');

      // Determine MIME type
      const ext = selected.fileName.split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'bmp': 'image/bmp',
        'ico': 'image/x-icon',
      };
      const mimeType = mimeMap[ext] || 'image/png';

      this.postMessage({
        type: 'attachmentAdded',
        attachment: {
          type: 'image',
          name: selected.fileName,
          path: selected.relativePath,
          base64Data: base64,
          mimeType,
        },
      });

      vscode.window.showInformationMessage(`Attached image: ${selected.fileName} (${fileSizeKB.toFixed(0)}KB)`);
    } catch (e) {
      console.error('[Hermes] Failed to read image', e);
      vscode.window.showWarningMessage('Failed to read image file');
    }
  }

  /** Handle local file uploaded from browser file picker */
  private _handleLocalFileAttached(file: {
    name: string;
    fileType: 'file' | 'image';
    content?: string;
    base64Data?: string;
    mimeType?: string;
    size: number;
  }) {
    const sizeLabel = file.size > 1024
      ? `${(file.size / 1024).toFixed(0)}KB`
      : `${file.size}B`;

    if (file.fileType === 'image') {
      this.postMessage({
        type: 'attachmentAdded',
        attachment: {
          type: 'image',
          name: file.name,
          path: `(uploaded) ${file.name}`,
          base64Data: file.base64Data,
          mimeType: file.mimeType,
        },
      });
      vscode.window.showInformationMessage(`Attached image: ${file.name} (${sizeLabel})`);
    } else {
      this.postMessage({
        type: 'attachmentAdded',
        attachment: {
          type: 'file',
          name: file.name,
          path: `(uploaded) ${file.name}`,
          content: file.content,
        },
      });
      vscode.window.showInformationMessage(`Attached file: ${file.name} (${sizeLabel})`);
    }
  }

  // ───────────────── Chat Message Handling ─────────────────

  /** Retry the last failed message */
  /** Stop ongoing streaming generation */
  private _handleStopGeneration() {
    if (this._streamAbortController) {
      this._streamAbortController.abort();
      this._streamAbortController = null;
    }
  }

  private async _handleRetryMessage() {
    // Find the last user message in history
    let lastUserMsg: SessionMessage | undefined;
    let lastUserIdx = -1;
    for (let i = this._currentMessages.length - 1; i >= 0; i--) {
      if (this._currentMessages[i].role === 'user') {
        lastUserMsg = this._currentMessages[i];
        lastUserIdx = i;
        break;
      }
    }

    if (!lastUserMsg) return;

    // Remove the error assistant message(s) after last user message
    this._currentMessages = this._currentMessages.slice(0, lastUserIdx + 1);

    // Clear error messages from webview and re-send
    this.postMessage({ type: 'clearLastError' });

    // Re-send the same message (without attachments since context was already built)
    // We call _handleChatMessage again which will rebuild context
    await this._handleChatMessage(lastUserMsg.content);
  }

  /** Handle checkpoint approve/revise action from webview */
  private async _handleCheckpointAction(action: string, checkpointNumber: number) {
    const responseText = action === 'approve'
      ? 'approve'
      : `revise checkpoint ${checkpointNumber}`;

    // Send as a regular chat message from user
    await this._handleChatMessage(responseText);
  }

  /** Add selected text from editor/terminal to chat input (Ctrl+Shift+L / Cmd+Shift+L) */
  private async _handleAddToChat() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      // Try terminal selection
      await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
      const clipboard = await vscode.env.clipboard.readText();
      if (clipboard && clipboard.trim()) {
        this._insertSelectionToChat(clipboard.trim(), 'terminal');
      }
      return;
    }

    const doc = editor.document;
    const selections = editor.selections;

    // Gather selected text from all selections (multi-cursor support)
    const selectedTexts = selections
      .map(sel => doc.getText(sel))
      .filter(t => t.trim().length > 0);

    if (selectedTexts.length === 0) {
      // No selection — select the entire current line
      const line = doc.lineAt(editor.selection.active.line);
      const lineText = line.text.trim();
      if (lineText) {
        const relPath = vscode.workspace.asRelativePath(doc.uri);
        const lineNum = line.lineNumber + 1;
        const col = editor.selection.active.character + 1;
        this._insertSelectionToChat(lineText, 'editor', relPath, lineNum, lineNum, col, col + lineText.length);
      }
      return;
    }

    const combined = selectedTexts.join('\n');
    const relPath = vscode.workspace.asRelativePath(doc.uri);
    const startLine = selections[0].start.line + 1;
    const startCol = selections[0].start.character + 1;
    const endLine = selections[selections.length - 1].end.line + 1;
    const endCol = selections[selections.length - 1].end.character + 1;

    this._insertSelectionToChat(combined, 'editor', relPath, startLine, endLine, startCol, endCol);
  }

  /** Send selection as an attachment chip to webview */
  private _insertSelectionToChat(
    text: string,
    source: 'editor' | 'terminal',
    filePath?: string,
    startLine?: number,
    endLine?: number,
    startCol?: number,
    endCol?: number
  ) {
    // Build label and line range
    let chipName: string;
    let lineRange: string;

    if (source === 'terminal') {
      chipName = 'Terminal Selection';
      lineRange = '';
    } else {
      const fileName = filePath ? filePath.split('/').pop() || filePath : 'untitled';
      if (startLine && endLine && startLine !== endLine) {
        lineRange = `L${startLine}:C${startCol || 1}-L${endLine}:C${endCol || 1}`;
        chipName = `${fileName} ${lineRange}`;
      } else if (startLine) {
        lineRange = `L${startLine}`;
        chipName = `${fileName} ${lineRange}`;
      } else {
        lineRange = '';
        chipName = fileName;
      }
    }

    // Ensure Hermes sidebar is visible
    vscode.commands.executeCommand('hermes.chatView.focus');

    // Send as attachment chip (not raw text)
    this.postMessage({
      type: 'attachmentAdded',
      attachment: {
        type: 'selection',
        name: chipName,
        path: filePath || 'terminal',
        content: text,
        lineRange: lineRange,
      },
    });
  }

  /** Unsend a user message — rollback conversation and populate input for editing */
  private async _handleUnsendMessage(messageId: string) {
    // Find the message index in history
    const msgIdx = this._currentMessages.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return;

    const unsendMsg = this._currentMessages[msgIdx];
    if (unsendMsg.role !== 'user') return;

    // Remove this message and everything after it (including assistant response)
    this._currentMessages = this._currentMessages.slice(0, msgIdx);

    // Also reset conversation history on HermesClient — rebuild from remaining messages
    this._hermesClient.resetConversation();

    // Tell webview to remove messages from this index onwards
    this.postMessage({ type: 'removeMessages', fromIndex: msgIdx });

    // Populate the input with the unsent message text + restore attachments
    this.postMessage({
      type: 'populateInput',
      text: unsendMsg.content,
      attachments: unsendMsg.attachments?.map(a => ({
        type: a.type,
        name: a.name,
        path: a.path,
        content: a.content,
        base64Data: a.base64Data,
        mimeType: a.mimeType,
      })) || [],
    });

    // Auto-save the trimmed session
    await this._autoSaveSession();
  }

  /** Handle incoming chat message from user */
  private async _handleChatMessage(text: string, attachments?: Array<{ type: string; name: string; path: string; content?: string; base64Data?: string; mimeType?: string }>) {
    // Track user message (include attachments metadata for display)
    const userMsg: SessionMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    };
    this._currentMessages.push(userMsg);

    // Send user message with attachment info for bubble display
    this.postMessage({
      type: 'addMessage',
      message: {
        ...userMsg,
        status: 'done',
        attachments: attachments?.map(a => ({
          type: a.type,
          name: a.name,
          path: a.path,
          // Don't send base64/content to webview display — too heavy
        })) || undefined,
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

    // Inject attachment context from @file / @folder / @terminal / @rules mentions
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === 'file') {
          // If content is already pre-loaded (e.g. from local upload), use it directly
          if (att.content) {
            const truncated = att.content.length > 10240
              ? att.content.slice(0, 10240) + '\n... (truncated, file too large)'
              : att.content;
            contextString += `\nAttached File: ${att.name}\n\`\`\`\n${truncated}\n\`\`\`\n`;
          } else {
            try {
              const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
              if (workspaceFolder) {
                const fileUri = vscode.Uri.joinPath(workspaceFolder, att.path);
                const fileContent = await vscode.workspace.fs.readFile(fileUri);
                const textContent = new TextDecoder().decode(fileContent);
                // Limit file content to ~10KB to avoid overwhelming context
                const truncated = textContent.length > 10240
                  ? textContent.slice(0, 10240) + '\n... (truncated, file too large)'
                  : textContent;
                contextString += `\nAttached File: ${att.path}\n\`\`\`\n${truncated}\n\`\`\`\n`;
              }
            } catch (e) {
              contextString += `\nAttached File: ${att.path} (could not read file)\n`;
            }
          }
        } else if (att.type === 'folder') {
          try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (workspaceFolder) {
              const folderUri = vscode.Uri.joinPath(workspaceFolder, att.path);
              const entries = await vscode.workspace.fs.readDirectory(folderUri);
              const listing = entries
                .map(([name, type]) => {
                  const icon = type === vscode.FileType.Directory ? '📁' : '📄';
                  return `${icon} ${name}`;
                })
                .join('\n');
              contextString += `\nAttached Folder: ${att.path}\n${listing}\n`;
            }
          } catch (e) {
            contextString += `\nAttached Folder: ${att.path} (could not list folder)\n`;
          }
        } else if (att.type === 'terminal') {
          // Terminal content is pre-loaded in the attachment
          const content = (att as any).content || '(no output captured)';
          contextString += `\nTerminal Output [${att.name}]:\n\`\`\`\n${content}\n\`\`\`\n`;
        } else if (att.type === 'rules') {
          // Rules files — read content like @file
          try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (workspaceFolder) {
              const fileUri = vscode.Uri.joinPath(workspaceFolder, att.path);
              const fileContent = await vscode.workspace.fs.readFile(fileUri);
              const textContent = new TextDecoder().decode(fileContent);
              const truncated = textContent.length > 10240
                ? textContent.slice(0, 10240) + '\n... (truncated, file too large)'
                : textContent;
              contextString += `\nProject Rules [${att.name}]:\n\`\`\`\n${truncated}\n\`\`\`\n`;
            }
          } catch (e) {
            contextString += `\nProject Rules: ${att.path} (could not read file)\n`;
          }
        } else if (att.type === 'url') {
          // URL content is pre-loaded in the attachment
          const content = (att as any).content || '(no content fetched)';
          contextString += `\nURL Content [${att.path}]:\n\`\`\`\n${content}\n\`\`\`\n`;
        } else if (att.type === 'selection') {
          // Code selection from editor or terminal (Ctrl+Shift+L)
          const content = (att as any).content || '';
          const lineRange = (att as any).lineRange || '';
          const label = lineRange ? `${att.path} ${lineRange}` : att.path;
          contextString += `\nSelected Code [${label}]:\n\`\`\`\n${content}\n\`\`\`\n`;
        }
        // image attachments are handled separately below
      }
    }

    // Collect image attachments for multimodal
    const imageAttachments: Array<{ base64Data: string; mimeType: string }> = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === 'image' && att.base64Data && att.mimeType) {
          imageAttachments.push({ base64Data: att.base64Data, mimeType: att.mimeType });
        }
      }
    }

    let fullContent = '';
    let hadError = false;
    let wasStopped = false;

    // Create abort controller for stop generation
    this._streamAbortController = new AbortController();

    try {
      await this._hermesClient.streamChat(text, contextString, (chunk: string) => {
        fullContent += chunk;
        this.postMessage({
          type: 'updateMessage',
          id: responseId,
          content: fullContent,
          status: 'streaming',
        });
      }, imageAttachments.length > 0 ? imageAttachments : undefined, this._streamAbortController.signal);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        wasStopped = true;
        if (fullContent) {
          fullContent += '\n\n*— Generation stopped —*';
        }
      } else {
        console.error(e);
        fullContent += `\n\n[Error: ${e.message}]`;
        hadError = true;
      }
    } finally {
      this._streamAbortController = null;
    }

    this.postMessage({
      type: 'updateMessage',
      id: responseId,
      content: fullContent,
      status: hadError ? 'error' : 'done'
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
