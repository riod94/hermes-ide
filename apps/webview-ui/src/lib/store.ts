import { writable, derived } from 'svelte/store';
import type { ChatMessage, SessionMeta, ModelInfo, ContextAttachment } from './types';

/** All chat messages */
export const messages = writable<ChatMessage[]>([]);

/** Whether the agent is currently responding */
export const isLoading = writable(false);

/** Current profile info */
export const profile = writable({ name: 'Hermes', role: 'admin' });

/** Message count */
export const messageCount = derived(messages, ($messages) => $messages.length);

// ───────────────── Session State ─────────────────

/** List of all sessions (metadata only) */
export const sessions = writable<SessionMeta[]>([]);

/** Currently active session ID */
export const activeSessionId = writable<string | null>(null);

/** Currently active session title */
export const activeSessionTitle = writable<string>('New Chat');

/** Whether session list panel is visible */
export const showSessionList = writable(false);

// ───────────────── Model State ─────────────────

/** Available models from upstream provider */
export const models = writable<ModelInfo[]>([]);

/** Currently selected model ID */
export const activeModel = writable<string>('hermes-agent');

/** Whether model selector dropdown is visible */
export const showModelSelector = writable(false);

// ───────────────── Attachments State ─────────────────

/** Current context attachments (from @file, @folder mentions) */
export const attachments = writable<ContextAttachment[]>([]);

/** Whether mention popup is visible */
export const showMentionPopup = writable(false);

// ───────────────── Message Helpers ─────────────────

/** Generate unique message ID */
export function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Add a message to the store */
export function addMessage(role: ChatMessage['role'], content: string, status: ChatMessage['status'] = 'done'): ChatMessage {
  const msg: ChatMessage = {
    id: createMessageId(),
    role,
    content,
    timestamp: Date.now(),
    status,
  };
  messages.update((msgs) => [...msgs, msg]);
  return msg;
}

/** Update an existing message */
export function updateMessage(id: string, content: string, status?: ChatMessage['status']) {
  messages.update((msgs) =>
    msgs.map((m) => (m.id === id ? { ...m, content, ...(status ? { status } : {}) } : m))
  );
}

/** Clear all messages */
export function clearMessages() {
  messages.set([]);
}
