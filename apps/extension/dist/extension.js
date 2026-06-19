"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));

// src/ChatViewProvider.ts
var vscode2 = __toESM(require("vscode"));
var fs2 = __toESM(require("fs"));

// src/HermesClient.ts
var HermesClient = class _HermesClient {
  apiUrl;
  apiKey;
  conversationId = `ide-session-${Date.now()}`;
  _model = "hermes-agent";
  /** Get current conversation ID */
  getConversationId() {
    return this.conversationId;
  }
  /** Set conversation ID (used when restoring a session) */
  setConversationId(id) {
    this.conversationId = id;
  }
  /** Get current model */
  getModel() {
    return this._model;
  }
  /** Set model for subsequent requests */
  setModel(model) {
    this._model = model;
  }
  /**
   * Fetch available models from the upstream provider (9router).
   * Uses HERMES_UPSTREAM_URL env var (the actual LLM router) to list models,
   * because Hermes API /v1/models only returns the wrapper model.
   */
  async fetchModels() {
    try {
      const upstreamUrl = process.env.HERMES_UPSTREAM_URL || this.apiUrl;
      const upstreamKey = process.env.HERMES_UPSTREAM_KEY || this.apiKey;
      const response = await fetch(`${upstreamUrl}/models`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${upstreamKey}`
        }
      });
      if (!response.ok) {
        console.warn(`[Hermes] Failed to fetch models: ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("[Hermes] Error fetching models:", error);
      return [];
    }
  }
  /** Fetch available skills from Hermes API */
  async fetchSkills() {
    try {
      const response = await fetch(`${this.apiUrl}/skills`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });
      if (!response.ok) {
        console.warn(`[Hermes] Failed to fetch skills: ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("[Hermes] Error fetching skills:", error);
      return [];
    }
  }
  /**
   * System-level instructions injected into every Hermes API call.
   * Forces the agent to use mcp_ide_ide_propose_diff for all file edits
   * instead of write_file/patch/terminal sed.
   */
  static IDE_INSTRUCTIONS = [
    "You are running inside an IDE session. The developer is watching your changes in real-time.",
    "",
    "MANDATORY FILE EDITING RULE:",
    "- For ALL code file changes (create/edit), you MUST use the `mcp_ide_ide_propose_diff` tool.",
    "- Parameters: filepath (absolute path), new_content (full file content after changes).",
    "- This tool opens a diff view in the IDE and BLOCKS until the developer clicks Accept or Reject.",
    "- If rejected, ask what needs to change. Do NOT retry the same diff.",
    "",
    "FORBIDDEN during this IDE session:",
    "- write_file for code files",
    "- patch for code files",
    "- terminal commands that edit files (sed, echo >, cat >, tee, awk)",
    "",
    "EXCEPTIONS (allowed without mcp_ide_ide_propose_diff):",
    "- .gitignore, README.md, config files, documentation",
    "- git add/commit/push via terminal",
    "- Installing dependencies (bun add, npm install, composer require)",
    "- Reading files (read_file, search_files)"
  ].join("\n");
  constructor() {
    this.apiUrl = process.env.HERMES_API_URL || "http://127.0.0.1:3000/v1";
    this.apiKey = process.env.HERMES_API_KEY || "default-token";
  }
  /** Reset conversation — starts a fresh session with new ID */
  resetConversation() {
    this.conversationId = `ide-session-${Date.now()}`;
  }
  /**
   * Mengirim pesan chat dengan SSE streaming menggunakan API /responses agar history context terjaga.
   * Supports multimodal input (text + images) when images are provided.
   */
  async streamChat(message, contextString, onChunk, images, signal) {
    try {
      const textMessage = contextString ? `${contextString}

User: ${message}` : message;
      let input;
      let usingMultimodal = false;
      if (images && images.length > 0) {
        const contentParts = [];
        contentParts.push({ type: "input_text", text: textMessage });
        for (const img of images) {
          contentParts.push({
            type: "input_image",
            image_url: {
              url: `data:${img.mimeType};base64,${img.base64Data}`,
              detail: "auto"
            }
          });
        }
        input = [{ role: "user", content: contentParts }];
        usingMultimodal = true;
      } else {
        input = textMessage;
      }
      const requestBody = {
        model: this._model,
        input,
        instructions: _HermesClient.IDE_INSTRUCTIONS,
        conversation: this.conversationId,
        stream: true
      };
      let response = await fetch(`${this.apiUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal
      });
      if (!response.ok && usingMultimodal) {
        console.warn(`[Hermes] Multimodal request failed (${response.status}), retrying as text-only`);
        const imageCount = images?.length || 0;
        const fallbackText = textMessage + `

[${imageCount} image(s) attached but current model does not support vision/multimodal input]`;
        const fallbackBody = {
          ...requestBody,
          input: fallbackText
        };
        response = await fetch(`${this.apiUrl}/responses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(fallbackBody),
          signal
        });
      }
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      if (response.body) {
        const handleLine = (line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.type === "response.output_item.added" && data.item?.type === "function_call") {
                const toolName = data.item.name;
                if (toolName === "search_files" || toolName === "read_file") {
                  onChunk(`
> \u23F3 **Exploring codebase...**

`);
                } else {
                  onChunk(`
> \u23F3 **Using tool: \`${toolName}\`...**

`);
                }
              } else if (data.type === "response.output_text.delta") {
                onChunk(data.delta || data.text || "");
              } else if (data.type === "function_call") {
                onChunk(`
> \u{1F6E0}\uFE0F **Using Tool: \`${data.name}\`...**

`);
              } else if (data.choices && data.choices[0].delta?.content) {
                onChunk(data.choices[0].delta.content);
              } else if (data.event === "hermes.tool.progress") {
                onChunk(`
> \u{1F6E0}\uFE0F **${data.tool}**: ${JSON.stringify(data.arguments || {})}

`);
              }
            } catch (e) {
            }
          }
        };
        const body = response.body;
        if (body.getReader) {
          const reader = body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              handleLine(line);
            }
          }
        } else if (body[Symbol.asyncIterator]) {
          const decoder = new TextDecoder();
          let buffer = "";
          for await (const chunk of body) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              handleLine(line);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      onChunk(`

[Error: ${error instanceof Error ? error.message : "Unknown"}]`);
    }
  }
};

// src/McpBridge.ts
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));

// src/pathMapper.ts
var HOST_BASE = process.env.HOST_PROJECTS_BASE || "";
var CONTAINER_BASE = process.env.DEFAULT_WORKSPACE || "/projects";
function hostPathToContainer(hostPath) {
  if (HOST_BASE && hostPath.startsWith(HOST_BASE)) {
    const relative = hostPath.slice(HOST_BASE.length);
    return `${CONTAINER_BASE}${relative}`;
  }
  const match = hostPath.match(/^\/home\/ade\/projects\/[^/]+(\/.*)?$/);
  if (match) {
    return `${CONTAINER_BASE}${match[1] || ""}`;
  }
  return hostPath;
}

// src/McpBridge.ts
var McpBridge = class {
  baseUrl;
  outputChannel;
  sseController = null;
  reconnectTimer = null;
  connected = false;
  // Pending diffs — tracked locally for diff editor management
  pendingDiffs = /* @__PURE__ */ new Map();
  // Callback: notify webview of new diff proposal
  onDiffProposal = null;
  constructor() {
    const mcpUrl = process.env.MCP_SERVICE_URL || "";
    this.baseUrl = mcpUrl || this.discoverMcpUrl();
    this.outputChannel = vscode.window.createOutputChannel("Hermes MCP Bridge");
  }
  /**
   * Auto-discover MCP service URL based on environment
   */
  discoverMcpUrl() {
    if (process.env.MCP_SERVICE_URL) {
      return process.env.MCP_SERVICE_URL;
    }
    if (fs.existsSync("/.dockerenv")) {
      const mcpPort = process.env.MCP_PORT || "56007";
      return `http://172.17.0.1:${mcpPort}`;
    }
    return "http://127.0.0.1:56007";
  }
  /**
   * Set callback for when MCP service sends a diff proposal
   */
  onDiff(callback) {
    this.onDiffProposal = callback;
  }
  /**
   * Start SSE connection to MCP service for real-time events
   */
  async start() {
    this.log(`Connecting to MCP Service at ${this.baseUrl}`);
    const healthy = await this.healthCheck();
    if (!healthy) {
      this.log("MCP Service not reachable \u2014 will retry in background");
      this.scheduleReconnect();
      return;
    }
    await this.fetchPendingDiffs();
    this.connectSSE();
  }
  /**
   * Health check — GET /health
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5e3)
      });
      if (response.ok) {
        const data = await response.json();
        this.log(
          `Health OK \u2014 sessions: ${data.activeSessions}, pending: ${data.pendingDiffs}`
        );
        return true;
      }
      return false;
    } catch (e) {
      this.log(`Health check failed: ${e.message}`);
      return false;
    }
  }
  /**
   * Fetch currently pending diffs — GET /api/pending
   */
  async fetchPendingDiffs() {
    try {
      const response = await fetch(`${this.baseUrl}/api/pending`, {
        signal: AbortSignal.timeout(5e3)
      });
      if (!response.ok)
        return;
      const data = await response.json();
      for (const diff of data.pending) {
        this.handleDiffProposal(diff);
      }
    } catch (e) {
      this.log(`Failed to fetch pending diffs: ${e.message}`);
    }
  }
  /**
   * Connect to SSE stream — GET /api/events
   */
  connectSSE() {
    this.sseController = new AbortController();
    this.log("Opening SSE connection...");
    fetch(`${this.baseUrl}/api/events`, {
      signal: this.sseController.signal,
      headers: { Accept: "text/event-stream" }
    }).then(async (response) => {
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
        if (done)
          break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          this.handleSSEMessage(part);
        }
      }
      this.connected = false;
      this.log("SSE stream ended");
      this.scheduleReconnect();
    }).catch((e) => {
      if (e.name === "AbortError")
        return;
      this.connected = false;
      this.log(`SSE error: ${e.message}`);
      this.scheduleReconnect();
    });
  }
  /**
   * Parse and handle an SSE message block
   */
  handleSSEMessage(block) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) {
        event = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        data = line.slice(6);
      } else if (line.startsWith(":")) {
        return;
      }
    }
    if (!data)
      return;
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
    } catch (e) {
      this.log(`Failed to parse SSE data: ${e.message}`);
    }
  }
  /**
   * Handle incoming diff proposal — open diff editor & notify webview
   */
  async handleDiffProposal(payload) {
    this.log(`Diff proposal: ${payload.filepath} (${payload.diffId})`);
    const containerPath = hostPathToContainer(payload.filepath);
    this.log(`Path mapped: ${payload.filepath} \u2192 ${containerPath}`);
    this.pendingDiffs.set(payload.diffId, {
      filepath: payload.filepath,
      new_content: payload.new_content
    });
    try {
      let originalUri = vscode.Uri.file(containerPath);
      if (!fs.existsSync(containerPath)) {
        originalUri = vscode.Uri.parse(
          `hermes-draft:${containerPath}?content=`
        );
      }
      const draftUri = vscode.Uri.parse(
        `hermes-draft:${containerPath}?content=${encodeURIComponent(payload.new_content)}`
      );
      await vscode.commands.executeCommand(
        "vscode.diff",
        originalUri,
        draftUri,
        `Propose: ${containerPath.split("/").pop()}`
      );
    } catch (e) {
      this.log(`Failed to open diff editor: ${e.message}`);
    }
    if (this.onDiffProposal) {
      this.onDiffProposal(payload);
    }
  }
  /**
   * Handle diff resolved event (from SSE — may come from another Extension instance)
   */
  handleDiffResolved(payload) {
    this.log(`Diff resolved: ${payload.diffId} \u2192 ${payload.decision}`);
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
  async resolveDiff(diffId, decision) {
    this.log(`Resolving diff: ${diffId} \u2192 ${decision}`);
    try {
      const response = await fetch(`${this.baseUrl}/api/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffId, decision }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      this.pendingDiffs.delete(diffId);
      this.log(`Diff ${diffId} resolved successfully`);
    } catch (e) {
      this.log(`Failed to resolve diff: ${e.message}`);
      vscode.window.showErrorMessage(
        `Hermes: Failed to resolve diff \u2014 ${e.message}`
      );
    }
  }
  /**
   * Schedule reconnect with exponential backoff
   */
  scheduleReconnect(delayMs = 5e3) {
    if (this.reconnectTimer)
      return;
    this.log(`Reconnecting in ${delayMs / 1e3}s...`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      const healthy = await this.healthCheck();
      if (healthy) {
        this.connectSSE();
      } else {
        this.scheduleReconnect(Math.min(delayMs * 2, 3e4));
      }
    }, delayMs);
  }
  /**
   * Stop SSE connection and cleanup
   */
  stop() {
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
  isConnected() {
    return this.connected;
  }
  log(message) {
    this.outputChannel.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`);
  }
};
var mcpBridge = new McpBridge();

// src/SessionManager.ts
var MAX_SESSIONS = 50;
var SESSIONS_KEY = "hermes.sessions";
var ACTIVE_SESSION_KEY = "hermes.activeSessionId";
var SESSION_DATA_PREFIX = "hermes.session.";
var SessionManager = class {
  constructor(context) {
    this.context = context;
  }
  /** Generate unique session ID */
  generateId() {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  /** Get sessions metadata list (sorted by updatedAt desc) */
  listSessions() {
    const metas = this.context.globalState.get(SESSIONS_KEY, []);
    return metas.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  /** Get active session ID */
  getActiveSessionId() {
    return this.context.globalState.get(ACTIVE_SESSION_KEY, null);
  }
  /** Set active session ID */
  async setActiveSessionId(id) {
    await this.context.globalState.update(ACTIVE_SESSION_KEY, id);
  }
  /** Create a new empty session, returns SessionData */
  async createSession(conversationId) {
    const id = this.generateId();
    const now = Date.now();
    const session = {
      id,
      title: "New Chat",
      conversationId,
      messages: [],
      createdAt: now,
      updatedAt: now
    };
    await this.context.globalState.update(`${SESSION_DATA_PREFIX}${id}`, session);
    const metas = this.listSessions();
    metas.unshift({
      id,
      title: session.title,
      messageCount: 0,
      preview: "",
      createdAt: now,
      updatedAt: now
    });
    if (metas.length > MAX_SESSIONS) {
      const removed = metas.splice(MAX_SESSIONS);
      for (const meta of removed) {
        await this.context.globalState.update(`${SESSION_DATA_PREFIX}${meta.id}`, void 0);
      }
    }
    await this.context.globalState.update(SESSIONS_KEY, metas);
    await this.setActiveSessionId(id);
    return session;
  }
  /** Load full session data by ID */
  loadSession(id) {
    return this.context.globalState.get(`${SESSION_DATA_PREFIX}${id}`, null) || null;
  }
  /** Save/update session with current messages */
  async saveSession(id, messages, conversationId, title) {
    const existing = this.loadSession(id);
    if (!existing)
      return;
    const lastMsgTimestamp = messages.length > 0 ? messages[messages.length - 1].timestamp : existing.updatedAt;
    let sessionTitle = title || existing.title;
    if (sessionTitle === "New Chat" && messages.length > 0) {
      const firstUserMsg = messages.find((m) => m.role === "user");
      if (firstUserMsg) {
        sessionTitle = firstUserMsg.content.slice(0, 40).replace(/\n/g, " ").trim();
        if (firstUserMsg.content.length > 40)
          sessionTitle += "\u2026";
      }
    }
    const lastMsg = messages[messages.length - 1];
    const preview = lastMsg ? lastMsg.content.slice(0, 60).replace(/\n/g, " ").trim() : "";
    const updated = {
      ...existing,
      title: sessionTitle,
      conversationId,
      messages,
      updatedAt: lastMsgTimestamp
    };
    await this.context.globalState.update(`${SESSION_DATA_PREFIX}${id}`, updated);
    const metas = this.listSessions();
    const idx = metas.findIndex((m) => m.id === id);
    if (idx >= 0) {
      metas[idx] = {
        id,
        title: sessionTitle,
        messageCount: messages.length,
        preview,
        createdAt: existing.createdAt,
        updatedAt: lastMsgTimestamp
      };
    }
    await this.context.globalState.update(SESSIONS_KEY, metas);
  }
  /** Delete a session */
  async deleteSession(id) {
    await this.context.globalState.update(`${SESSION_DATA_PREFIX}${id}`, void 0);
    const metas = this.listSessions().filter((m) => m.id !== id);
    await this.context.globalState.update(SESSIONS_KEY, metas);
    if (this.getActiveSessionId() === id) {
      await this.setActiveSessionId(null);
    }
  }
  /** Rename a session */
  async renameSession(id, newTitle) {
    const session = this.loadSession(id);
    if (!session)
      return;
    session.title = newTitle;
    session.updatedAt = Date.now();
    await this.context.globalState.update(`${SESSION_DATA_PREFIX}${id}`, session);
    const metas = this.listSessions();
    const idx = metas.findIndex((m) => m.id === id);
    if (idx >= 0) {
      metas[idx].title = newTitle;
      metas[idx].updatedAt = session.updatedAt;
    }
    await this.context.globalState.update(SESSIONS_KEY, metas);
  }
  /** Get active session or create one */
  async getOrCreateActiveSession(conversationId) {
    const activeId = this.getActiveSessionId();
    if (activeId) {
      const session = this.loadSession(activeId);
      if (session)
        return session;
    }
    return this.createSession(conversationId);
  }
};

// src/ChatViewProvider.ts
var HermesDraftProvider = class {
  _drafts = /* @__PURE__ */ new Map();
  setDraft(filepath, content) {
    this._drafts.set(filepath, content);
  }
  provideTextDocumentContent(uri) {
    const filepath = uri.path;
    const params = new URLSearchParams(uri.query);
    const contentFromQuery = params.get("content");
    if (contentFromQuery) {
      return contentFromQuery;
    }
    return this._drafts.get(filepath) || "";
  }
};
var draftProvider = new HermesDraftProvider();
var ChatViewProvider = class _ChatViewProvider {
  constructor(_context) {
    this._context = _context;
    this._extensionUri = _context.extensionUri;
    this._hermesClient = new HermesClient();
    this._sessionManager = new SessionManager(_context);
  }
  static viewType = "hermes.chatView";
  _view;
  _hermesClient;
  _sessionManager;
  _extensionUri;
  // Track current messages for session save
  _currentMessages = [];
  // AbortController for stopping streaming generation
  _streamAbortController = null;
  /** Expose HermesClient for external access */
  get hermesClient() {
    return this._hermesClient;
  }
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode2.Uri.joinPath(this._extensionUri, "webview-dist")
      ]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "chatMessage":
          this._handleChatMessage(data.value, data.attachments);
          break;
        case "resolveDiff":
          this._handleResolveDiff(data.value);
          break;
        case "clearChat":
          this._hermesClient.resetConversation();
          break;
        case "copyCode":
          vscode2.env.clipboard.writeText(data.value);
          vscode2.window.showInformationMessage("Code copied to clipboard");
          break;
        case "ready":
          console.log("[Hermes] Webview ready");
          this._handleWebviewReady();
          break;
        case "openDiff":
          this._handleOpenDiff(data.value);
          break;
        case "newSession":
          this._handleNewSession();
          break;
        case "loadSession":
          this._handleLoadSession(data.value);
          break;
        case "deleteSession":
          this._handleDeleteSession(data.value);
          break;
        case "getSessions":
          this._sendSessionsList();
          break;
        case "renameSession":
          this._handleRenameSession(data.value);
          break;
        case "getModels":
          this._handleGetModels();
          break;
        case "setModel":
          this._handleSetModel(data.value);
          break;
        case "pickFile":
          this._handlePickFile();
          break;
        case "pickFolder":
          this._handlePickFolder();
          break;
        case "pickTerminal":
          this._handlePickTerminal();
          break;
        case "pickRules":
          this._handlePickRules();
          break;
        case "pickUrl":
          this._handlePickUrl();
          break;
        case "pickAttachment":
          this._handlePickAttachment();
          break;
        case "pickImage":
          this._handlePickImage();
          break;
        case "localFileAttached":
          this._handleLocalFileAttached(data.file);
          break;
        case "retryMessage":
          this._handleRetryMessage();
          break;
        case "stopGeneration":
          this._handleStopGeneration();
          break;
        case "unsendMessage":
          this._handleUnsendMessage(data.messageId);
          break;
        case "showWarning":
          vscode2.window.showWarningMessage(data.value);
          break;
        case "checkpointAction":
          this._handleCheckpointAction(data.action, data.checkpoint);
          break;
        case "openLink":
          if (data.value) {
            vscode2.env.openExternal(vscode2.Uri.parse(data.value));
          }
          break;
        case "getSettings":
          this._handleGetSettings();
          break;
        case "updateSettings":
          this._handleUpdateSettings(data.settings);
          break;
        case "scanRuleFiles":
          this._handleScanRuleFiles();
          break;
      }
    });
    vscode2.commands.registerCommand("hermes.showDiffControls", (payload) => {
      this._showDiffInWebview(payload);
    });
    vscode2.commands.registerCommand("hermes.addToChat", async () => {
      await this._handleAddToChat();
    });
  }
  /** Send a message to the webview */
  postMessage(message) {
    this._view?.webview.postMessage(message);
  }
  // ───────────────── Session Management ─────────────────
  /** Handle webview ready — restore active session */
  async _handleWebviewReady() {
    const session = await this._sessionManager.getOrCreateActiveSession(
      this._hermesClient.getConversationId()
    );
    this._hermesClient.setConversationId(session.conversationId);
    this._currentMessages = [...session.messages];
    const savedModel = this._context.globalState.get("hermes.activeModel");
    if (savedModel) {
      this._hermesClient.setModel(savedModel);
    }
    this.postMessage({
      type: "sessionLoaded",
      session: {
        id: session.id,
        title: session.title,
        messages: session.messages
      }
    });
    this._sendSessionsList();
    this._handleGetModels();
    this._handleGetSkills();
    this._handleGetSettings();
  }
  /** Create new session (save current first) */
  async _handleNewSession() {
    const activeId = this._sessionManager.getActiveSessionId();
    if (activeId && this._currentMessages.length > 0) {
      await this._sessionManager.saveSession(
        activeId,
        this._currentMessages,
        this._hermesClient.getConversationId()
      );
    }
    this._hermesClient.resetConversation();
    this._currentMessages = [];
    const session = await this._sessionManager.createSession(
      this._hermesClient.getConversationId()
    );
    this.postMessage({ type: "clearMessages" });
    this.postMessage({
      type: "activeSession",
      session: { id: session.id, title: session.title }
    });
    this._sendSessionsList();
  }
  /** Load an existing session */
  async _handleLoadSession(data) {
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
      vscode2.window.showWarningMessage("Session not found");
      return;
    }
    await this._sessionManager.setActiveSessionId(data.id);
    this._hermesClient.setConversationId(session.conversationId);
    this._currentMessages = [...session.messages];
    this.postMessage({
      type: "sessionLoaded",
      session: {
        id: session.id,
        title: session.title,
        messages: session.messages
      }
    });
    this._sendSessionsList();
  }
  /** Delete a session */
  async _handleDeleteSession(data) {
    const activeId = this._sessionManager.getActiveSessionId();
    await this._sessionManager.deleteSession(data.id);
    if (activeId === data.id) {
      this._hermesClient.resetConversation();
      this._currentMessages = [];
      const session = await this._sessionManager.createSession(
        this._hermesClient.getConversationId()
      );
      this.postMessage({ type: "clearMessages" });
      this.postMessage({
        type: "activeSession",
        session: { id: session.id, title: session.title }
      });
    }
    this._sendSessionsList();
  }
  /** Rename a session */
  async _handleRenameSession(data) {
    await this._sessionManager.renameSession(data.id, data.title);
    this._sendSessionsList();
    if (this._sessionManager.getActiveSessionId() === data.id) {
      this.postMessage({
        type: "activeSession",
        session: { id: data.id, title: data.title }
      });
    }
  }
  /** Send sessions list to webview */
  _sendSessionsList() {
    const sessions = this._sessionManager.listSessions();
    const activeId = this._sessionManager.getActiveSessionId();
    this.postMessage({
      type: "sessionsUpdated",
      sessions,
      activeSessionId: activeId
    });
  }
  /** Auto-save current session (called after message changes) */
  async _autoSaveSession() {
    const activeId = this._sessionManager.getActiveSessionId();
    if (!activeId)
      return;
    await this._sessionManager.saveSession(
      activeId,
      this._currentMessages,
      this._hermesClient.getConversationId()
    );
  }
  // ───────────────── Model Management ─────────────────
  /** Fetch models from upstream and send to webview */
  async _handleGetModels() {
    const modelList = await this._hermesClient.fetchModels();
    const currentModel = this._hermesClient.getModel();
    this.postMessage({
      type: "modelsLoaded",
      models: modelList,
      activeModel: currentModel
    });
  }
  /** Fetch and send skills list to webview */
  async _handleGetSkills() {
    const skillList = await this._hermesClient.fetchSkills();
    this.postMessage({
      type: "skillsLoaded",
      skills: skillList
    });
  }
  /** Set model on HermesClient and persist to globalState */
  async _handleSetModel(data) {
    this._hermesClient.setModel(data.id);
    await this._context.globalState.update("hermes.activeModel", data.id);
    this.postMessage({
      type: "modelChanged",
      model: data.id
    });
  }
  // ───────────────── Settings Management ─────────────────
  /** Default settings (mirroring webview-ui types) */
  static DEFAULT_SETTINGS = {
    fontSize: 13,
    sendOnEnter: true,
    autoScroll: true,
    showTimestamps: false,
    compactMode: false,
    defaultRules: [],
    customInstructions: "",
    defaultModel: "hermes-agent"
  };
  /** Get settings from globalState and send to webview */
  _handleGetSettings() {
    const saved = this._context.globalState.get("hermes.settings");
    const settings = { ..._ChatViewProvider.DEFAULT_SETTINGS, ...saved };
    this.postMessage({ type: "settingsLoaded", settings });
  }
  /** Update settings in globalState */
  async _handleUpdateSettings(newSettings) {
    const saved = this._context.globalState.get("hermes.settings");
    const merged = { ..._ChatViewProvider.DEFAULT_SETTINGS, ...saved, ...newSettings };
    await this._context.globalState.update("hermes.settings", merged);
    this.postMessage({ type: "settingsLoaded", settings: merged });
    if (typeof merged.defaultModel === "string") {
      const currentActive = this._context.globalState.get("hermes.activeModel");
      if (currentActive !== merged.defaultModel) {
        await this._handleSetModel({ id: merged.defaultModel });
      }
    }
  }
  /** Scan workspace for known rule/guidelines files */
  async _handleScanRuleFiles() {
    const workspaceFolder = vscode2.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.postMessage({ type: "ruleFilesFound", files: [] });
      return;
    }
    const rulePatterns = [
      ".cursorrules",
      ".cursorignore",
      "AGENTS.md",
      "CLAUDE.md",
      "COPILOT.md",
      "RULES.md",
      "CONVENTIONS.md",
      "GUIDELINES.md",
      "CONTRIBUTING.md",
      "CODING_STANDARDS.md",
      ".editorconfig",
      ".eslintrc",
      ".eslintrc.js",
      ".eslintrc.json",
      ".eslintrc.yml",
      ".prettierrc",
      ".prettierrc.js",
      ".prettierrc.json",
      "eslint.config.js",
      "eslint.config.mjs",
      "biome.json",
      "biome.jsonc",
      ".stylelintrc",
      ".stylelintrc.json"
    ];
    const foundFiles = [];
    for (const pattern of rulePatterns) {
      const matches = await vscode2.workspace.findFiles(
        `**/${pattern}`,
        "{**/node_modules/**,**/dist/**,**/.git/**,**/vendor/**}",
        5
      );
      for (const uri of matches) {
        const relativePath = vscode2.workspace.asRelativePath(uri);
        foundFiles.push({
          name: relativePath.split("/").pop() || relativePath,
          path: relativePath
        });
      }
    }
    const unique = Array.from(
      new Map(foundFiles.map((f) => [f.path, f])).values()
    ).sort((a, b) => a.path.localeCompare(b.path));
    this.postMessage({ type: "ruleFilesFound", files: unique });
  }
  /** Get current settings (for use in _handleChatMessage) */
  _getCurrentSettings() {
    const saved = this._context.globalState.get("hermes.settings");
    return { ..._ChatViewProvider.DEFAULT_SETTINGS, ...saved };
  }
  // ───────────────── Diff Handling ─────────────────
  /** Send pending diff to Webview UI */
  _showDiffInWebview(payload) {
    this.postMessage({
      type: "showPendingDiff",
      diff: {
        id: payload.diffId,
        filepath: payload.filepath,
        original_content: "",
        new_content: payload.new_content
      }
    });
  }
  /** Handle opening Diff view in VS Code */
  async _handleOpenDiff(payload) {
    try {
      const containerPath = hostPathToContainer(payload.filepath);
      let originalUri;
      if (fs2.existsSync(containerPath)) {
        originalUri = vscode2.Uri.file(containerPath);
      } else {
        originalUri = vscode2.Uri.parse(`hermes-draft:${containerPath}?content=`);
      }
      draftProvider.setDraft(containerPath, payload.newContent);
      const draftUri = vscode2.Uri.parse(`hermes-draft:${containerPath}?content=${encodeURIComponent(payload.newContent)}`);
      await vscode2.commands.executeCommand(
        "vscode.diff",
        originalUri,
        draftUri,
        `Review Draft: ${containerPath.split("/").pop()}`,
        { preview: true }
      );
    } catch (e) {
      console.error("[Hermes] Failed to open diff", e);
      vscode2.window.showErrorMessage("Hermes: Failed to open Diff view.");
    }
  }
  /** Handle user Approve/Reject — resolve via MCP Bridge HTTP */
  async _handleResolveDiff(payload) {
    try {
      const decision = payload.action === "approve" ? "accept" : "reject";
      await mcpBridge.resolveDiff(payload.diffId, decision);
      const filename = payload.filepath?.split("/").pop() || "file";
      if (payload.action === "approve") {
        vscode2.window.showInformationMessage(`Hermes: Approved changes to ${filename}`);
      } else {
        vscode2.window.showWarningMessage(`Hermes: Rejected changes to ${filename}`);
      }
      await vscode2.commands.executeCommand("workbench.action.closeActiveEditor");
    } catch (e) {
      console.error("[Hermes] Failed to resolve diff", e);
      vscode2.window.showErrorMessage("Hermes: Failed to resolve diff.");
    }
  }
  // ───────────────── Context Attachments (@mentions) ─────────────────
  /** Handle @file pick — QuickPick to search files in workspace */
  async _handlePickFile() {
    const workspaceFolder = vscode2.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode2.window.showWarningMessage("No workspace folder open");
      return;
    }
    const files = await vscode2.workspace.findFiles(
      "**/*",
      "{**/node_modules/**,**/dist/**,**/.git/**,**/vendor/**,**/bun.lock,**/*.vsix}",
      500
    );
    const items = files.map((uri) => {
      const relativePath = vscode2.workspace.asRelativePath(uri);
      const fileName = uri.path.split("/").pop() || "file";
      return {
        label: `\u{1F4C4} ${fileName}`,
        description: relativePath,
        uri,
        relativePath,
        fileName
      };
    }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const selected = await vscode2.window.showQuickPick(items, {
      placeHolder: "Search and select a file to attach as context\u2026",
      matchOnDescription: true
    });
    if (!selected)
      return;
    this.postMessage({
      type: "attachmentAdded",
      attachment: {
        type: "file",
        name: selected.fileName,
        path: selected.relativePath
      }
    });
  }
  /** Handle @folder pick — QuickPick to search folders in workspace */
  async _handlePickFolder() {
    const workspaceFolder = vscode2.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode2.window.showWarningMessage("No workspace folder open");
      return;
    }
    const files = await vscode2.workspace.findFiles(
      "**/*",
      "{**/node_modules/**,**/dist/**,**/.git/**,**/vendor/**}",
      1e3
    );
    const dirSet = /* @__PURE__ */ new Set();
    for (const uri of files) {
      const rel = vscode2.workspace.asRelativePath(uri);
      const parts = rel.split("/");
      for (let i = 1; i < parts.length; i++) {
        dirSet.add(parts.slice(0, i).join("/"));
      }
    }
    const items = Array.from(dirSet).sort().map((dirPath) => ({
      label: `\u{1F4C1} ${dirPath.split("/").pop()}`,
      description: dirPath,
      dirPath
    }));
    const selected = await vscode2.window.showQuickPick(items, {
      placeHolder: "Search and select a folder to attach as context\u2026",
      matchOnDescription: true
    });
    if (!selected)
      return;
    const folderUri = vscode2.Uri.joinPath(workspaceFolder.uri, selected.dirPath);
    const folderName = selected.dirPath.split("/").pop() || "folder";
    try {
      const entries = await vscode2.workspace.fs.readDirectory(folderUri);
      const fileList = entries.filter(([, type]) => type === vscode2.FileType.File).map(([name]) => ({
        name,
        path: `${selected.dirPath}/${name}`
      }));
      this.postMessage({
        type: "folderFilesAdded",
        folderName,
        folderPath: selected.dirPath,
        files: fileList
      });
    } catch {
      this.postMessage({
        type: "folderFilesAdded",
        folderName,
        folderPath: selected.dirPath,
        files: []
      });
    }
  }
  /** Handle @terminal pick — list active terminals and capture their content */
  async _handlePickTerminal() {
    const terminals = vscode2.window.terminals;
    if (terminals.length === 0) {
      vscode2.window.showWarningMessage("No active terminals found");
      return;
    }
    const items = terminals.map((term2, idx) => ({
      label: `\u2B1B ${term2.name}`,
      description: `Terminal ${idx + 1}`,
      terminal: term2,
      index: idx
    }));
    const selected = await vscode2.window.showQuickPick(items, {
      placeHolder: "Select a terminal to attach its output\u2026"
    });
    if (!selected)
      return;
    const term = selected.terminal;
    let terminalContent = "";
    try {
      if (term.shellIntegration) {
        const shellIntegration = term.shellIntegration;
        if (shellIntegration.executeCommand) {
          terminalContent = await this._readTerminalViaClipboard(term);
        } else if (shellIntegration.cwd) {
          terminalContent = `[Terminal: ${term.name}] CWD: ${shellIntegration.cwd.fsPath}`;
        }
      }
      if (!terminalContent) {
        terminalContent = await this._readTerminalViaClipboard(term);
      }
    } catch (e) {
      console.error("[Hermes] Failed to read terminal output", e);
      terminalContent = `[Terminal: ${term.name}] (could not capture output)`;
    }
    if (terminalContent.length > 10240) {
      terminalContent = terminalContent.slice(-10240) + "\n... (truncated, showing last ~10KB)";
    }
    this.postMessage({
      type: "attachmentAdded",
      attachment: {
        type: "terminal",
        name: term.name,
        path: `terminal://${term.name}`,
        content: terminalContent
      }
    });
  }
  /** Read terminal content via clipboard (select all → copy → restore) */
  async _readTerminalViaClipboard(terminal) {
    const savedClipboard = await vscode2.env.clipboard.readText();
    try {
      terminal.show(false);
      await new Promise((r) => setTimeout(r, 100));
      await vscode2.commands.executeCommand("workbench.action.terminal.selectAll");
      await new Promise((r) => setTimeout(r, 100));
      await vscode2.commands.executeCommand("workbench.action.terminal.copySelection");
      await new Promise((r) => setTimeout(r, 100));
      await vscode2.commands.executeCommand("workbench.action.terminal.clearSelection");
      const content = await vscode2.env.clipboard.readText();
      await vscode2.env.clipboard.writeText(savedClipboard);
      return content || `[Terminal: ${terminal.name}] (empty or no output)`;
    } catch {
      await vscode2.env.clipboard.writeText(savedClipboard);
      return `[Terminal: ${terminal.name}] (could not capture output)`;
    }
  }
  /** Handle @rules pick — scan for project guidelines/rules files */
  async _handlePickRules() {
    const workspaceFolder = vscode2.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode2.window.showWarningMessage("No workspace folder open");
      return;
    }
    const rulePatterns = [
      ".cursorrules",
      ".cursorignore",
      "AGENTS.md",
      "CLAUDE.md",
      "COPILOT.md",
      "RULES.md",
      "CONVENTIONS.md",
      "GUIDELINES.md",
      "CONTRIBUTING.md",
      "CODING_STANDARDS.md",
      ".editorconfig",
      ".eslintrc",
      ".eslintrc.js",
      ".eslintrc.json",
      ".eslintrc.yml",
      ".prettierrc",
      ".prettierrc.js",
      ".prettierrc.json",
      "eslint.config.js",
      "eslint.config.mjs",
      "biome.json",
      "biome.jsonc",
      ".stylelintrc",
      ".stylelintrc.json"
    ];
    const foundFiles = [];
    for (const pattern of rulePatterns) {
      const matches = await vscode2.workspace.findFiles(
        `**/${pattern}`,
        "{**/node_modules/**,**/dist/**,**/.git/**,**/vendor/**}",
        5
      );
      for (const uri of matches) {
        const relativePath = vscode2.workspace.asRelativePath(uri);
        foundFiles.push({
          label: `\u{1F4CF} ${pattern}`,
          description: relativePath,
          relativePath,
          uri
        });
      }
    }
    if (foundFiles.length === 0) {
      vscode2.window.showInformationMessage("No project rules/guidelines files found");
      return;
    }
    const unique = Array.from(
      new Map(foundFiles.map((f) => [f.relativePath, f])).values()
    ).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const selected = await vscode2.window.showQuickPick(unique, {
      placeHolder: "Select a rules/guidelines file to attach\u2026",
      canPickMany: true
    });
    if (!selected || selected.length === 0)
      return;
    for (const item of selected) {
      this.postMessage({
        type: "attachmentAdded",
        attachment: {
          type: "rules",
          name: item.relativePath.split("/").pop() || item.relativePath,
          path: item.relativePath
        }
      });
    }
  }
  /** Handle @url pick — InputBox for URL, fetch content server-side */
  async _handlePickUrl() {
    const url = await vscode2.window.showInputBox({
      placeHolder: "https://example.com/docs/api",
      prompt: "Enter a URL to fetch and attach as context",
      validateInput: (value) => {
        if (!value)
          return "URL is required";
        try {
          const parsed = new URL(value);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            return "Only http:// and https:// URLs are supported";
          }
          return null;
        } catch {
          return "Invalid URL format";
        }
      }
    });
    if (!url)
      return;
    await vscode2.window.withProgress(
      {
        location: vscode2.ProgressLocation.Notification,
        title: `Fetching ${url}\u2026`,
        cancellable: false
      },
      async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15e3);
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "HermesIDE/1.0",
              "Accept": "text/html, text/plain, application/json, */*"
            },
            redirect: "follow"
          });
          clearTimeout(timeout);
          if (!response.ok) {
            vscode2.window.showWarningMessage(`Failed to fetch URL: ${response.status} ${response.statusText}`);
            return;
          }
          const contentType = response.headers.get("content-type") || "";
          const rawBody = await response.text();
          let extractedText;
          if (contentType.includes("text/html")) {
            extractedText = this._stripHtmlToText(rawBody);
          } else if (contentType.includes("application/json")) {
            try {
              extractedText = JSON.stringify(JSON.parse(rawBody), null, 2);
            } catch {
              extractedText = rawBody;
            }
          } else {
            extractedText = rawBody;
          }
          if (extractedText.length > 10240) {
            extractedText = extractedText.slice(0, 10240) + "\n... (truncated, content too large)";
          }
          const parsedUrl = new URL(url);
          const displayName = parsedUrl.hostname + (parsedUrl.pathname !== "/" ? parsedUrl.pathname : "");
          const shortName = displayName.length > 50 ? displayName.slice(0, 47) + "\u2026" : displayName;
          this.postMessage({
            type: "attachmentAdded",
            attachment: {
              type: "url",
              name: shortName,
              path: url,
              content: extractedText
            }
          });
        } catch (e) {
          if (e.name === "AbortError") {
            vscode2.window.showWarningMessage("URL fetch timed out (15s limit)");
          } else {
            vscode2.window.showWarningMessage(`Failed to fetch URL: ${e.message}`);
          }
        }
      }
    );
  }
  /** Strip HTML tags and extract readable text */
  _stripHtmlToText(html) {
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "").replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "").replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
    text = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(p|div|h[1-6]|li|tr|blockquote|pre|section|article)[^>]*>/gi, "\n").replace(/<hr[^>]*>/gi, "\n---\n");
    text = text.replace(/<[^>]+>/g, "");
    text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
    text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n/g, "\n\n").trim();
    return text;
  }
  /** Handle [+] attachment button — QuickPick menu for file or image */
  async _handlePickAttachment() {
    const options = [
      { label: "\u{1F4C4} File", description: "Attach a file as text context", id: "file" },
      { label: "\u{1F5BC}\uFE0F Image", description: "Attach an image for vision analysis", id: "image" }
    ];
    const selected = await vscode2.window.showQuickPick(options, {
      placeHolder: "What would you like to attach?"
    });
    if (!selected)
      return;
    if (selected.id === "file") {
      this._handlePickFile();
    } else if (selected.id === "image") {
      this._handlePickImage();
    }
  }
  /** Handle image pick — QuickPick to search image files in workspace, encode base64 */
  async _handlePickImage() {
    const workspaceFolder = vscode2.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode2.window.showWarningMessage("No workspace folder open");
      return;
    }
    const imageFiles = await vscode2.workspace.findFiles(
      "**/*.{png,jpg,jpeg,gif,webp,svg,bmp,ico}",
      "{**/node_modules/**,**/dist/**,**/.git/**,**/vendor/**}",
      200
    );
    if (imageFiles.length === 0) {
      vscode2.window.showInformationMessage("No image files found in workspace");
      return;
    }
    const items = imageFiles.map((uri) => {
      const relativePath = vscode2.workspace.asRelativePath(uri);
      const fileName = uri.path.split("/").pop() || "image";
      return {
        label: `\u{1F5BC}\uFE0F ${fileName}`,
        description: relativePath,
        uri,
        relativePath,
        fileName
      };
    }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const selected = await vscode2.window.showQuickPick(items, {
      placeHolder: "Search and select an image to attach\u2026",
      matchOnDescription: true
    });
    if (!selected)
      return;
    try {
      const fileContent = await vscode2.workspace.fs.readFile(selected.uri);
      const fileSizeKB = fileContent.byteLength / 1024;
      if (fileContent.byteLength > 2 * 1024 * 1024) {
        vscode2.window.showWarningMessage(`Image too large (${(fileSizeKB / 1024).toFixed(1)}MB). Max 2MB.`);
        return;
      }
      const base64 = Buffer.from(fileContent).toString("base64");
      const ext = selected.fileName.split(".").pop()?.toLowerCase() || "";
      const mimeMap = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
        "svg": "image/svg+xml",
        "bmp": "image/bmp",
        "ico": "image/x-icon"
      };
      const mimeType = mimeMap[ext] || "image/png";
      this.postMessage({
        type: "attachmentAdded",
        attachment: {
          type: "image",
          name: selected.fileName,
          path: selected.relativePath,
          base64Data: base64,
          mimeType
        }
      });
      vscode2.window.showInformationMessage(`Attached image: ${selected.fileName} (${fileSizeKB.toFixed(0)}KB)`);
    } catch (e) {
      console.error("[Hermes] Failed to read image", e);
      vscode2.window.showWarningMessage("Failed to read image file");
    }
  }
  /** Handle local file uploaded from browser file picker */
  _handleLocalFileAttached(file) {
    const sizeLabel = file.size > 1024 ? `${(file.size / 1024).toFixed(0)}KB` : `${file.size}B`;
    if (file.fileType === "image") {
      this.postMessage({
        type: "attachmentAdded",
        attachment: {
          type: "image",
          name: file.name,
          path: `(uploaded) ${file.name}`,
          base64Data: file.base64Data,
          mimeType: file.mimeType
        }
      });
      vscode2.window.showInformationMessage(`Attached image: ${file.name} (${sizeLabel})`);
    } else {
      this.postMessage({
        type: "attachmentAdded",
        attachment: {
          type: "file",
          name: file.name,
          path: `(uploaded) ${file.name}`,
          content: file.content
        }
      });
      vscode2.window.showInformationMessage(`Attached file: ${file.name} (${sizeLabel})`);
    }
  }
  // ───────────────── Chat Message Handling ─────────────────
  /** Retry the last failed message */
  /** Stop ongoing streaming generation */
  _handleStopGeneration() {
    if (this._streamAbortController) {
      this._streamAbortController.abort();
      this._streamAbortController = null;
    }
  }
  async _handleRetryMessage() {
    let lastUserMsg;
    let lastUserIdx = -1;
    for (let i = this._currentMessages.length - 1; i >= 0; i--) {
      if (this._currentMessages[i].role === "user") {
        lastUserMsg = this._currentMessages[i];
        lastUserIdx = i;
        break;
      }
    }
    if (!lastUserMsg)
      return;
    this._currentMessages = this._currentMessages.slice(0, lastUserIdx + 1);
    this.postMessage({ type: "clearLastError" });
    await this._handleChatMessage(lastUserMsg.content);
  }
  /** Handle checkpoint approve/revise action from webview */
  async _handleCheckpointAction(action, checkpointNumber) {
    const responseText = action === "approve" ? "approve" : `revise checkpoint ${checkpointNumber}`;
    await this._handleChatMessage(responseText);
  }
  /** Add selected text from editor/terminal to chat input (Ctrl+Shift+L / Cmd+Shift+L) */
  async _handleAddToChat() {
    const editor = vscode2.window.activeTextEditor;
    if (!editor) {
      await vscode2.commands.executeCommand("workbench.action.terminal.copySelection");
      const clipboard = await vscode2.env.clipboard.readText();
      if (clipboard && clipboard.trim()) {
        this._insertSelectionToChat(clipboard.trim(), "terminal");
      }
      return;
    }
    const doc = editor.document;
    const selections = editor.selections;
    const selectedTexts = selections.map((sel) => doc.getText(sel)).filter((t) => t.trim().length > 0);
    if (selectedTexts.length === 0) {
      const line = doc.lineAt(editor.selection.active.line);
      const lineText = line.text.trim();
      if (lineText) {
        const relPath2 = vscode2.workspace.asRelativePath(doc.uri);
        const lineNum = line.lineNumber + 1;
        const col = editor.selection.active.character + 1;
        this._insertSelectionToChat(lineText, "editor", relPath2, lineNum, lineNum, col, col + lineText.length);
      }
      return;
    }
    const combined = selectedTexts.join("\n");
    const relPath = vscode2.workspace.asRelativePath(doc.uri);
    const startLine = selections[0].start.line + 1;
    const startCol = selections[0].start.character + 1;
    const endLine = selections[selections.length - 1].end.line + 1;
    const endCol = selections[selections.length - 1].end.character + 1;
    this._insertSelectionToChat(combined, "editor", relPath, startLine, endLine, startCol, endCol);
  }
  /** Send selection as an attachment chip to webview */
  _insertSelectionToChat(text, source, filePath, startLine, endLine, startCol, endCol) {
    let chipName;
    let lineRange;
    if (source === "terminal") {
      chipName = "Terminal Selection";
      lineRange = "";
    } else {
      const fileName = filePath ? filePath.split("/").pop() || filePath : "untitled";
      if (startLine && endLine && startLine !== endLine) {
        lineRange = `L${startLine}:C${startCol || 1}-L${endLine}:C${endCol || 1}`;
        chipName = `${fileName} ${lineRange}`;
      } else if (startLine) {
        lineRange = `L${startLine}`;
        chipName = `${fileName} ${lineRange}`;
      } else {
        lineRange = "";
        chipName = fileName;
      }
    }
    vscode2.commands.executeCommand("hermes.chatView.focus");
    this.postMessage({
      type: "attachmentAdded",
      attachment: {
        type: "selection",
        name: chipName,
        path: filePath || "terminal",
        content: text,
        lineRange
      }
    });
  }
  /** Unsend a user message — rollback conversation and populate input for editing */
  async _handleUnsendMessage(messageId) {
    const msgIdx = this._currentMessages.findIndex((m) => m.id === messageId);
    if (msgIdx === -1)
      return;
    const unsendMsg = this._currentMessages[msgIdx];
    if (unsendMsg.role !== "user")
      return;
    this._currentMessages = this._currentMessages.slice(0, msgIdx);
    this._hermesClient.resetConversation();
    this.postMessage({ type: "removeMessages", fromIndex: msgIdx });
    this.postMessage({
      type: "populateInput",
      text: unsendMsg.content,
      attachments: unsendMsg.attachments?.map((a) => ({
        type: a.type,
        name: a.name,
        path: a.path,
        content: a.content,
        base64Data: a.base64Data,
        mimeType: a.mimeType
      })) || []
    });
    await this._autoSaveSession();
  }
  /** Handle incoming chat message from user */
  async _handleChatMessage(text, attachments) {
    const userMsg = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: text,
      timestamp: Date.now(),
      attachments: attachments && attachments.length > 0 ? attachments : void 0
    };
    this._currentMessages.push(userMsg);
    this.postMessage({
      type: "addMessage",
      message: {
        ...userMsg,
        status: "done",
        attachments: attachments?.map((a) => ({
          type: a.type,
          name: a.name,
          path: a.path
          // Don't send base64/content to webview display — too heavy
        })) || void 0
      }
    });
    const responseId = `msg-${Date.now()}-assistant`;
    this.postMessage({
      type: "addMessage",
      message: {
        id: responseId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        status: "streaming"
      }
    });
    const editor = vscode2.window.activeTextEditor;
    let contextString = "";
    if (editor) {
      const doc = editor.document;
      const selections = editor.selections;
      const selectedText = selections.map((s) => doc.getText(s)).join("\n").trim();
      contextString += `Active File: ${vscode2.workspace.asRelativePath(doc.uri)}
`;
      if (selectedText) {
        contextString += `Selected Code:
\`\`\`
${selectedText}
\`\`\`
`;
      }
      const diagnostics = vscode2.languages.getDiagnostics(doc.uri);
      if (diagnostics.length > 0) {
        const errors = diagnostics.filter((d) => d.severity === vscode2.DiagnosticSeverity.Error).map((d) => `- Line ${d.range.start.line + 1}: ${d.message}`).join("\n");
        if (errors) {
          contextString += `Current Linter Errors:
${errors}
`;
        }
      }
    }
    const currentSettings = this._getCurrentSettings();
    if (currentSettings.customInstructions) {
      contextString += `
Custom Instructions:
${currentSettings.customInstructions}
`;
    }
    if (currentSettings.defaultRules.length > 0) {
      const workspaceFolder = vscode2.workspace.workspaceFolders?.[0]?.uri;
      if (workspaceFolder) {
        for (const rulePath of currentSettings.defaultRules) {
          try {
            const fileUri = vscode2.Uri.joinPath(workspaceFolder, rulePath);
            const fileContent = await vscode2.workspace.fs.readFile(fileUri);
            const textContent = new TextDecoder().decode(fileContent);
            const truncated = textContent.length > 10240 ? textContent.slice(0, 10240) + "\n... (truncated, file too large)" : textContent;
            contextString += `
Default Rules [${rulePath}]:
\`\`\`
${truncated}
\`\`\`
`;
          } catch (e) {
          }
        }
      }
    }
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === "file") {
          if (att.content) {
            const truncated = att.content.length > 10240 ? att.content.slice(0, 10240) + "\n... (truncated, file too large)" : att.content;
            contextString += `
Attached File: ${att.name}
\`\`\`
${truncated}
\`\`\`
`;
          } else {
            try {
              const workspaceFolder = vscode2.workspace.workspaceFolders?.[0]?.uri;
              if (workspaceFolder) {
                const fileUri = vscode2.Uri.joinPath(workspaceFolder, att.path);
                const fileContent = await vscode2.workspace.fs.readFile(fileUri);
                const textContent = new TextDecoder().decode(fileContent);
                const truncated = textContent.length > 10240 ? textContent.slice(0, 10240) + "\n... (truncated, file too large)" : textContent;
                contextString += `
Attached File: ${att.path}
\`\`\`
${truncated}
\`\`\`
`;
              }
            } catch (e) {
              contextString += `
Attached File: ${att.path} (could not read file)
`;
            }
          }
        } else if (att.type === "folder") {
          try {
            const workspaceFolder = vscode2.workspace.workspaceFolders?.[0]?.uri;
            if (workspaceFolder) {
              const folderUri = vscode2.Uri.joinPath(workspaceFolder, att.path);
              const entries = await vscode2.workspace.fs.readDirectory(folderUri);
              const listing = entries.map(([name, type]) => {
                const icon = type === vscode2.FileType.Directory ? "\u{1F4C1}" : "\u{1F4C4}";
                return `${icon} ${name}`;
              }).join("\n");
              contextString += `
Attached Folder: ${att.path}
${listing}
`;
            }
          } catch (e) {
            contextString += `
Attached Folder: ${att.path} (could not list folder)
`;
          }
        } else if (att.type === "terminal") {
          const content = att.content || "(no output captured)";
          contextString += `
Terminal Output [${att.name}]:
\`\`\`
${content}
\`\`\`
`;
        } else if (att.type === "rules") {
          try {
            const workspaceFolder = vscode2.workspace.workspaceFolders?.[0]?.uri;
            if (workspaceFolder) {
              const fileUri = vscode2.Uri.joinPath(workspaceFolder, att.path);
              const fileContent = await vscode2.workspace.fs.readFile(fileUri);
              const textContent = new TextDecoder().decode(fileContent);
              const truncated = textContent.length > 10240 ? textContent.slice(0, 10240) + "\n... (truncated, file too large)" : textContent;
              contextString += `
Project Rules [${att.name}]:
\`\`\`
${truncated}
\`\`\`
`;
            }
          } catch (e) {
            contextString += `
Project Rules: ${att.path} (could not read file)
`;
          }
        } else if (att.type === "url") {
          const content = att.content || "(no content fetched)";
          contextString += `
URL Content [${att.path}]:
\`\`\`
${content}
\`\`\`
`;
        } else if (att.type === "selection") {
          const content = att.content || "";
          const lineRange = att.lineRange || "";
          const label = lineRange ? `${att.path} ${lineRange}` : att.path;
          contextString += `
Selected Code [${label}]:
\`\`\`
${content}
\`\`\`
`;
        }
      }
    }
    const imageAttachments = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === "image" && att.base64Data && att.mimeType) {
          imageAttachments.push({ base64Data: att.base64Data, mimeType: att.mimeType });
        }
      }
    }
    let fullContent = "";
    let hadError = false;
    let wasStopped = false;
    this._streamAbortController = new AbortController();
    try {
      await this._hermesClient.streamChat(text, contextString, (chunk) => {
        fullContent += chunk;
        this.postMessage({
          type: "updateMessage",
          id: responseId,
          content: fullContent,
          status: "streaming"
        });
      }, imageAttachments.length > 0 ? imageAttachments : void 0, this._streamAbortController.signal);
    } catch (e) {
      if (e.name === "AbortError") {
        wasStopped = true;
        if (fullContent) {
          fullContent += "\n\n*\u2014 Generation stopped \u2014*";
        }
      } else {
        console.error(e);
        fullContent += `

[Error: ${e.message}]`;
        hadError = true;
      }
    } finally {
      this._streamAbortController = null;
    }
    this.postMessage({
      type: "updateMessage",
      id: responseId,
      content: fullContent,
      status: hadError ? "error" : "done"
    });
    this._currentMessages.push({
      id: responseId,
      role: "assistant",
      content: fullContent,
      timestamp: Date.now()
    });
    await this._autoSaveSession();
    this._sendSessionsList();
  }
  _getHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this._extensionUri, "webview-dist", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this._extensionUri, "webview-dist", "index.css")
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
};
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// src/extension.ts
function activate(context) {
  console.log("Hermes Extension activated");
  context.subscriptions.push(
    vscode3.workspace.registerTextDocumentContentProvider("hermes-draft", draftProvider)
  );
  const provider = new ChatViewProvider(context);
  context.subscriptions.push(
    vscode3.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("hermes.focus", () => {
      vscode3.commands.executeCommand("workbench.view.extension.hermes-sidebar");
    })
  );
  mcpBridge.onDiff((payload) => {
    vscode3.commands.executeCommand("hermes.showDiffControls", payload);
  });
  mcpBridge.start().catch((err) => {
    console.error("Failed to connect MCP Bridge:", err);
  });
  context.subscriptions.push({ dispose: () => mcpBridge.stop() });
  context.subscriptions.push(
    vscode3.commands.registerCommand("hermes.resolveDiff", (diffId, decision) => {
      mcpBridge.resolveDiff(diffId, decision);
    })
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
