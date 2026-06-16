/** Message type for chat */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'streaming' | 'done' | 'error';
}

/** VS Code API interface for type safety */
export interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

/** Session metadata for list display */
export interface SessionMeta {
  id: string;
  title: string;
  messageCount: number;
  preview: string;
  createdAt: number;
  updatedAt: number;
}

/** Model info from upstream provider */
export interface ModelInfo {
  id: string;
  owned_by: string;
}

/** Message types sent from webview to extension */
export type OutgoingMessage =
  | { type: 'chatMessage'; value: string }
  | { type: 'clearChat' }
  | { type: 'copyCode'; value: string }
  | { type: 'ready' }
  | { type: 'newSession' }
  | { type: 'loadSession'; value: { id: string } }
  | { type: 'deleteSession'; value: { id: string } }
  | { type: 'getSessions' }
  | { type: 'renameSession'; value: { id: string; title: string } }
  | { type: 'getModels' }
  | { type: 'setModel'; value: { id: string } };

/** Pending diff proposal dari MCP Server */
export interface PendingDiff {
  id: string;
  filepath: string;
  original_content: string;
  new_content: string;
}

/** Message types sent from extension to webview */
export type IncomingMessage =
  | { type: 'addMessage'; message: ChatMessage }
  | { type: 'updateMessage'; id: string; content: string; status?: ChatMessage['status'] }
  | { type: 'clearMessages' }
  | { type: 'setProfile'; name: string; role: string }
  | { type: 'showPendingDiff'; diff: PendingDiff }
  | { type: 'sessionsUpdated'; sessions: SessionMeta[]; activeSessionId: string | null }
  | { type: 'sessionLoaded'; session: { id: string; title: string; messages: ChatMessage[] } }
  | { type: 'activeSession'; session: { id: string; title: string } }
  | { type: 'modelsLoaded'; models: ModelInfo[]; activeModel: string }
  | { type: 'modelChanged'; model: string };
