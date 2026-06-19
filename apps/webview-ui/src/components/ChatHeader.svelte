<script lang="ts">
  import { vscode } from '../lib/vscode';
  import { activeSessionTitle, showSessionList, showSettingsPanel } from '../lib/store';

  interface Props {
    onClear?: () => void;
  }

  let { onClear }: Props = $props();

  // __APP_VERSION__ is replaced at build time by Vite define
  // @ts-ignore
  const version: string = __APP_VERSION__;

  function handleNewChat() {
    vscode.postMessage({ type: 'newSession' });
  }

  function toggleHistory() {
    showSessionList.update((v) => !v);
  }

  function toggleSettings() {
    showSettingsPanel.update((v) => !v);
  }
</script>

<header class="flex items-center justify-between px-3 py-2 border-b"
        style="border-color: var(--color-border); background: var(--color-sidebar);">
  <div class="flex items-center gap-2">
    <div class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
         style="background: var(--color-badge); color: var(--color-badge-fg);">
      ⚡
    </div>
    <div>
      <div class="flex items-center gap-1.5">
        <h1 class="text-[13px] font-semibold leading-tight session-title" style="color: var(--color-fg);">{$activeSessionTitle}</h1>
        <span class="text-[9px] px-1 rounded-sm" style="background: var(--color-input-bg); color: var(--color-muted); border: 1px solid var(--color-border);">v{version}</span>
      </div>
      <p class="text-[10px] leading-tight" style="color: var(--color-muted);">Hermes AI • Agentic Coding Assistant</p>
    </div>
  </div>

  <div class="flex items-center gap-1">
    <!-- New Chat button -->
    <button onclick={handleNewChat}
            class="p-1.5 rounded-md transition-colors hover:opacity-80"
            style="color: var(--color-muted);"
            title="New chat">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>

    <!-- History toggle button -->
    <button onclick={toggleHistory}
            class="p-1.5 rounded-md transition-colors hover:opacity-80"
            style="color: var(--color-muted);"
            title="Chat history">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    </button>

    <!-- Settings button -->
    <button onclick={toggleSettings}
            class="p-1.5 rounded-md transition-colors hover:opacity-80"
            style="color: var(--color-muted);"
            title="Settings">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
  </div>
</header>

<style>
  .session-title {
    max-width: 140px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
