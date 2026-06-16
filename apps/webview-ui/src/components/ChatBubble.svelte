<script lang="ts">
  import type { ChatMessage } from '../lib/types';

  interface Props {
    message: ChatMessage;
  }

  let { message }: Props = $props();

  const isUser = $derived(message.role === 'user');
  const timeStr = $derived(
    new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
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

    <!-- Bubble -->
    <div class="px-3 py-2 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap break-words"
         style="background: {isUser ? 'var(--color-user-bubble)' : 'var(--color-agent-bubble)'};
                color: {isUser ? 'var(--color-btn-fg)' : 'var(--color-fg)'};
                border-bottom-{isUser ? 'right' : 'left'}-radius: 4px;">
      {message.content}
    </div>

    <!-- Timestamp + Status -->
    <div class="flex items-center gap-1.5 mt-0.5 px-1">
      <span class="text-[10px]" style="color: var(--color-muted);">{timeStr}</span>
      {#if message.status === 'sending'}
        <span class="text-[10px]" style="color: var(--color-muted);">⏳</span>
      {:else if message.status === 'streaming'}
        <span class="text-[10px] animate-pulse" style="color: var(--color-accent);">●</span>
      {:else if message.status === 'error'}
        <span class="text-[10px]" style="color: #f38ba8;">✗ Error</span>
      {/if}
    </div>
  </div>
</div>
