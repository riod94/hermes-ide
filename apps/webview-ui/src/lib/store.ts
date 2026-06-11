import { writable, derived } from 'svelte/store';
import type { ChatMessage } from './types';

/** All chat messages */
export const messages = writable<ChatMessage[]>([]);

/** Whether the agent is currently responding */
export const isLoading = writable(false);

/** Current profile info */
export const profile = writable({ name: 'Hermes', role: 'admin' });

/** Message count */
export const messageCount = derived(messages, ($messages) => $messages.length);

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
