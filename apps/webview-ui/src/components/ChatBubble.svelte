<script lang="ts">
  import type { ChatMessage } from '../lib/types';
  import { vscode } from '../lib/vscode';
  import { isLoading } from '../lib/store';

  interface Props {
    message: ChatMessage;
    isLast?: boolean;
  }

  let { message, isLast = false }: Props = $props();

  const isUser = $derived(message.role === 'user');
  const isError = $derived(
    message.role === 'assistant' && message.status === 'error'
  );
  const hasError = $derived(
    message.role === 'assistant' && message.content.includes('Error:')
  );
  const timeStr = $derived(
    new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  /** Whether unsend button is visible (hover state) */
  let showUnsend = $state(false);

  /** Icon for attachment type */
  function attachIcon(type: string): string {
    switch (type) {
      case 'file': return '📄';
      case 'folder': return '📁';
      case 'terminal': return '⬛';
      case 'url': return '🔗';
      case 'image': return '🖼️';
      case 'rules': return '📏';
      default: return '📎';
    }
  }

  function handleRetry() {
    vscode.postMessage({
      type: 'retryMessage',
    });
  }

  function handleUnsend() {
    vscode.postMessage({
      type: 'unsendMessage',
      messageId: message.id,
    });
  }
</script>

<div class="flex w-full mb-3 {isUser ? 'justify-end' : 'justify-start'}">
  <div class="max-w-[85%] flex flex-col {isUser ? 'items-end' : 'items-start'}">
    <!-- Avatar + Name -->
    <div class="flex items-center gap-1.5 mb-1 px-1">
      {#if !isUser}
        <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
             style="background: var(--color-badge); color: var(--color-badge-fg);">
          H
        </div>
        <span class="text-[11px] font-medium" style="color: var(--color-muted);">Hermes</span>
      {:else}
        <span class="text-[11px] font-medium" style="color: var(--color-muted);">You</span>
      {/if}
    </div>

    <!-- Attachment chips (above bubble, for user messages) -->
    {#if isUser && message.attachments && message.attachments.length > 0}
      <div class="bubble-attachments mb-1">
        {#each message.attachments as att}
          <div class="bubble-att-chip">
            <span class="bubble-att-icon">{attachIcon(att.type)}</span>
            <span class="bubble-att-name" title={att.path}>{att.name}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Bubble with hover for unsend -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bubble-wrapper"
         onmouseenter={() => { if (isUser) showUnsend = true; }}
         onmouseleave={() => showUnsend = false}>
      <div class="px-3 py-2 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap break-words"
           style="background: {isUser ? 'var(--color-user-bubble)' : 'var(--color-agent-bubble)'};
                  color: {isUser ? 'var(--color-btn-fg)' : 'var(--color-fg)'};
                  border-bottom-{isUser ? 'right' : 'left'}-radius: 4px;">
        {message.content}
      </div>

      <!-- Unsend button (visible on hover, only for user messages, not while loading) -->
      {#if isUser && showUnsend && !$isLoading}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="unsend-actions">
          <span class="unsend-btn" onclick={handleUnsend} title="Unsend & edit this message">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 14 4 9 9 4"></polyline>
              <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
            </svg>
            Unsend
          </span>
        </div>
      {/if}
    </div>

    <!-- Timestamp + Status + Retry -->
    <div class="flex items-center gap-1.5 mt-0.5 px-1">
      <span class="text-[10px]" style="color: var(--color-muted);">{timeStr}</span>
      {#if message.status === 'sending'}
        <span class="text-[10px]" style="color: var(--color-muted);">⏳</span>
      {:else if message.status === 'streaming'}
        <span class="text-[10px] animate-pulse" style="color: var(--color-accent);">●</span>
      {:else if message.status === 'error' || hasError}
        <span class="text-[10px]" style="color: #f38ba8;">✗ Error</span>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="retry-btn" onclick={handleRetry} title="Retry message">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          Retry
        </span>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ── Attachment chips in bubble ── */
  .bubble-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 100%;
  }

  .bubble-att-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-size: 10px;
    color: var(--color-muted);
    max-width: 160px;
  }

  .bubble-att-icon {
    font-size: 11px;
    flex-shrink: 0;
  }

  .bubble-att-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  /* ── Retry button ── */
  .retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: var(--color-accent);
    cursor: pointer;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--color-accent);
    transition: all 0.15s;
    user-select: none;
  }

  .retry-btn:hover {
    background: var(--color-accent);
    color: var(--color-bg);
  }

  /* ── Unsend button ── */
  .bubble-wrapper {
    position: relative;
  }

  .unsend-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 2px;
  }

  .unsend-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: var(--color-muted);
    cursor: pointer;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.15s;
    user-select: none;
  }

  .unsend-btn:hover {
    background: #f38ba8;
    color: var(--color-bg);
    border-color: #f38ba8;
  }
</style>
