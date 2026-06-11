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

/** Message types sent from webview to extension */
export type OutgoingMessage =
  | { type: 'chatMessage'; value: string }
  | { type: 'clearChat' }
  | { type: 'copyCode'; value: string }
  | { type: 'ready' };

/** Message types sent from extension to webview */
export type IncomingMessage =
  | { type: 'addMessage'; message: ChatMessage }
  | { type: 'updateMessage'; id: string; content: string; status?: ChatMessage['status'] }
  | { type: 'clearMessages' }
  | { type: 'setProfile'; name: string; role: string };
