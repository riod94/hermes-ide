import * as vscode from 'vscode';

/** Metadata ringkas untuk list sessions */
export interface SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  preview: string;
  createdAt: number;
  updatedAt: number;
}

/** Data lengkap satu session */
export interface SessionData {
  id: string;
  title: string;
  conversationId: string;
  messages: SessionMessage[];
  createdAt: number;
  updatedAt: number;
}

/** Message yang disimpan dalam session (subset ChatMessage) */
export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Attachments metadata (stored for unsend/restore, no heavy content) */
  attachments?: Array<{ type: string; name: string; path: string; content?: string; base64Data?: string; mimeType?: string }>;
}

const MAX_SESSIONS = 50;
const SESSIONS_KEY = 'hermes.sessions';
const ACTIVE_SESSION_KEY = 'hermes.activeSessionId';
const SESSION_DATA_PREFIX = 'hermes.session.';

export class SessionManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  /** Generate unique session ID */
  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /** Get sessions metadata list (sorted by updatedAt desc) */
  public listSessions(): SessionMeta[] {
    const metas = this.context.globalState.get<SessionMeta[]>(SESSIONS_KEY, []);
    return metas.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Get active session ID */
  public getActiveSessionId(): string | null {
    return this.context.globalState.get<string | null>(ACTIVE_SESSION_KEY, null);
  }

  /** Set active session ID */
  public async setActiveSessionId(id: string | null): Promise<void> {
    await this.context.globalState.update(ACTIVE_SESSION_KEY, id);
  }

  /** Create a new empty session, returns SessionData */
  public async createSession(conversationId: string): Promise<SessionData> {
    const id = this.generateId();
    const now = Date.now();

    const session: SessionData = {
      id,
      title: 'New Chat',
      conversationId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    // Save session data
    await this.context.globalState.update(`${SESSION_DATA_PREFIX}${id}`, session);

    // Add to sessions list
    const metas = this.listSessions();
    metas.unshift({
      id,
      title: session.title,
      messageCount: 0,
      preview: '',
      createdAt: now,
      updatedAt: now,
    });

    // Prune if exceeds max
    if (metas.length > MAX_SESSIONS) {
      const removed = metas.splice(MAX_SESSIONS);
      for (const meta of removed) {
        await this.context.globalState.update(`${SESSION_DATA_PREFIX}${meta.id}`, undefined);
      }
    }

    await this.context.globalState.update(SESSIONS_KEY, metas);
    await this.setActiveSessionId(id);

    return session;
  }

  /** Load full session data by ID */
  public loadSession(id: string): SessionData | null {
    return this.context.globalState.get<SessionData>(`${SESSION_DATA_PREFIX}${id}`, null as any) || null;
  }

  /** Save/update session with current messages */
  public async saveSession(
    id: string,
    messages: SessionMessage[],
    conversationId: string,
    title?: string
  ): Promise<void> {
    const existing = this.loadSession(id);
    if (!existing) return;

    // Use last message timestamp as updatedAt (reflects actual chat activity)
    const lastMsgTimestamp = messages.length > 0
      ? messages[messages.length - 1].timestamp
      : existing.updatedAt;

    // Auto-generate title from first user message if still default
    let sessionTitle = title || existing.title;
    if (sessionTitle === 'New Chat' && messages.length > 0) {
      const firstUserMsg = messages.find((m) => m.role === 'user');
      if (firstUserMsg) {
        sessionTitle = firstUserMsg.content.slice(0, 40).replace(/\n/g, ' ').trim();
        if (firstUserMsg.content.length > 40) sessionTitle += '…';
      }
    }

    // Preview from last message
    const lastMsg = messages[messages.length - 1];
    const preview = lastMsg
      ? lastMsg.content.slice(0, 60).replace(/\n/g, ' ').trim()
      : '';

    // Update session data
    const updated: SessionData = {
      ...existing,
      title: sessionTitle,
      conversationId,
      messages,
      updatedAt: lastMsgTimestamp,
    };
    await this.context.globalState.update(`${SESSION_DATA_PREFIX}${id}`, updated);

    // Update metadata
    const metas = this.listSessions();
    const idx = metas.findIndex((m) => m.id === id);
    if (idx >= 0) {
      metas[idx] = {
        id,
        title: sessionTitle,
        messageCount: messages.length,
        preview,
        createdAt: existing.createdAt,
        updatedAt: lastMsgTimestamp,
      };
    }
    await this.context.globalState.update(SESSIONS_KEY, metas);
  }

  /** Delete a session */
  public async deleteSession(id: string): Promise<void> {
    await this.context.globalState.update(`${SESSION_DATA_PREFIX}${id}`, undefined);

    const metas = this.listSessions().filter((m) => m.id !== id);
    await this.context.globalState.update(SESSIONS_KEY, metas);

    // If we deleted the active session, clear active
    if (this.getActiveSessionId() === id) {
      await this.setActiveSessionId(null);
    }
  }

  /** Rename a session */
  public async renameSession(id: string, newTitle: string): Promise<void> {
    const session = this.loadSession(id);
    if (!session) return;

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
  public async getOrCreateActiveSession(conversationId: string): Promise<SessionData> {
    const activeId = this.getActiveSessionId();
    if (activeId) {
      const session = this.loadSession(activeId);
      if (session) return session;
    }
    // No active session or not found — create new
    return this.createSession(conversationId);
  }
}
