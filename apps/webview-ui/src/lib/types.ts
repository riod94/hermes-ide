/** Message type for chat */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'streaming' | 'done' | 'error';
  /** Attachments shown in user message bubble */
  attachments?: ContextAttachment[];
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

/** Context attachment from @ mentions */
export interface ContextAttachment {
  type: 'file' | 'folder' | 'terminal' | 'rules' | 'url' | 'image' | 'selection';
  name: string;
  path: string;
  /** Pre-loaded content (used for terminal output) */
  content?: string;
  /** Base64-encoded data (used for image attachments) */
  base64Data?: string;
  /** MIME type (used for image attachments) */
  mimeType?: string;
  /** Line range info for selection attachments (e.g., "L2:C7-L5:C100") */
  lineRange?: string;
}

/** Message types sent from webview to extension */
export type OutgoingMessage =
  | { type: 'chatMessage'; value: string; attachments?: ContextAttachment[] }
  | { type: 'stopGeneration' }
  | { type: 'clearChat' }
  | { type: 'copyCode'; value: string }
  | { type: 'ready' }
  | { type: 'newSession' }
  | { type: 'loadSession'; value: { id: string } }
  | { type: 'deleteSession'; value: { id: string } }
  | { type: 'getSessions' }
  | { type: 'renameSession'; value: { id: string; title: string } }
  | { type: 'getModels' }
  | { type: 'setModel'; value: { id: string } }
  | { type: 'pickFile' }
  | { type: 'pickFolder' }
  | { type: 'pickTerminal' }
  | { type: 'pickRules' }
  | { type: 'pickUrl' }
  | { type: 'pickAttachment' }
  | { type: 'pickImage' }
  | { type: 'localFileAttached'; file: { name: string; fileType: 'file' | 'image'; content?: string; base64Data?: string; mimeType?: string; size: number } }
  | { type: 'retryMessage'; value: string; attachments?: ContextAttachment[] }
  | { type: 'unsendMessage'; messageId: string }
  | { type: 'showWarning'; value: string }
  | { type: 'checkpointAction'; action: 'approve' | 'revise'; checkpoint: number }
  | { type: 'openLink'; value: string }
  | { type: 'getSettings' }
  | { type: 'updateSettings'; settings: Settings }
  | { type: 'scanRuleFiles' };

/** Pending diff proposal dari MCP Server */
export interface PendingDiff {
  id: string;
  filepath: string;
  original_content: string;
  new_content: string;
}

/** Skill info from Hermes API */
export interface SkillInfo {
  name: string;
  description: string;
  category: string | null;
}

/** Rule file found in workspace */
export interface RuleFileInfo {
  name: string;
  path: string;
}

/** User settings (persisted via globalState) */
export interface Settings {
  // Chat
  fontSize: number;        // 11-18, default 13
  sendOnEnter: boolean;    // default true
  autoScroll: boolean;     // default true
  showTimestamps: boolean; // default false
  compactMode: boolean;    // default false
  // Context
  defaultRules: string[];  // relative paths of auto-attached rule files
  customInstructions: string; // always-injected custom instructions
  // Model
  defaultModel: string;    // default 'hermes-agent'
}

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 13,
  sendOnEnter: true,
  autoScroll: true,
  showTimestamps: false,
  compactMode: false,
  defaultRules: [],
  customInstructions: '',
  defaultModel: 'hermes-agent',
};

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
  | { type: 'modelChanged'; model: string }
  | { type: 'skillsLoaded'; skills: SkillInfo[] }
  | { type: 'attachmentAdded'; attachment: ContextAttachment }
  | { type: 'folderFilesAdded'; folderName: string; folderPath: string; files: { name: string; path: string }[] }
  | { type: 'clearLastError' }
  | { type: 'populateInput'; text: string; attachments?: ContextAttachment[] }
  | { type: 'removeMessages'; fromIndex: number }
  | { type: 'settingsLoaded'; settings: Settings }
  | { type: 'ruleFilesFound'; files: RuleFileInfo[] };
