<script lang="ts">
  import { vscode } from '../lib/vscode';
  import { activeSessionTitle, showSessionList, activeModel, showModelSelector } from '../lib/store';

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
    showModelSelector.set(false);
  }

  function toggleModelSelector() {
    showModelSelector.update((v) => !v);
    showSessionList.set(false);
  }

  /** Display short model name (strip prefix) */
  function shortModelName(modelId: string): string {
    const slashIndex = modelId.indexOf('/');
    return slashIndex > -1 ? modelId.slice(slashIndex + 1) : modelId;
  }
</script>

<header class="flex items-center justify-between px-3 py-2 border-b"
        style="border-color: var(--color-border); background: var(--color-sidebar); position: relative;">
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
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="model-badge" onclick={toggleModelSelector} title="Switch model">
        <span class="model-badge-name">{shortModelName($activeModel)}</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
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
  </div>
</header>

<style>
  .session-title {
    max-width: 140px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .model-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    padding: 1px 6px;
    border-radius: 3px;
    transition: background-color 0.15s;
    margin-top: 1px;
  }

  .model-badge:hover {
    background: var(--color-input-bg);
  }

  .model-badge-name {
    font-size: 10px;
    color: var(--color-muted);
    max-width: 160px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .model-badge svg {
    color: var(--color-muted);
    flex-shrink: 0;
  }
</style>
