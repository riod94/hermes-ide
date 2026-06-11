<script lang="ts">
  import ChatHeader from './components/ChatHeader.svelte';
  import ChatBubble from './components/ChatBubble.svelte';
  import ChatInput from './components/ChatInput.svelte';
  import TypingIndicator from './components/TypingIndicator.svelte';
  import WelcomeScreen from './components/WelcomeScreen.svelte';
  import { messages, isLoading, addMessage, updateMessage, clearMessages } from './lib/store';
  import { vscode } from './lib/vscode';
  import type { IncomingMessage } from './lib/types';

  let chatContainerEl: HTMLDivElement | undefined = $state();

  // Auto-scroll to bottom when new messages arrive
  $effect(() => {
    // Track messages length to trigger scroll
    const _len = $messages.length;
    const _loading = $isLoading;
    if (chatContainerEl) {
      requestAnimationFrame(() => {
        chatContainerEl!.scrollTop = chatContainerEl!.scrollHeight;
      });
    }
  });

  // Listen for messages from the extension host
  $effect(() => {
    function handleMessage(event: MessageEvent<IncomingMessage>) {
      const msg = event.data;
      switch (msg.type) {
        case 'addMessage':
          messages.update((msgs) => [...msgs, msg.message]);
          if (msg.message.role === 'assistant') {
            isLoading.set(false);
          }
          break;
        case 'updateMessage':
          updateMessage(msg.id, msg.content, msg.status);
          if (msg.status === 'done' || msg.status === 'error') {
            isLoading.set(false);
          }
          break;
        case 'clearMessages':
          clearMessages();
          break;
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  });

  // Notify extension that webview is ready
  $effect(() => {
    vscode.postMessage({ type: 'ready' });
  });

  function handleSend() {
    // ChatInput already posts the message via vscode.postMessage
    // We add the user message locally for instant feedback
    // The extension will echo it back or we handle it here
  }

  function handleClear() {
    clearMessages();
    vscode.postMessage({ type: 'clearChat' });
  }
</script>

<div class="flex flex-col h-screen overflow-hidden" style="background: var(--color-bg);">
  <!-- Header -->
  <ChatHeader onClear={handleClear} />

  <!-- Messages Area -->
  <div bind:this={chatContainerEl}
       class="flex-1 overflow-y-auto px-3 py-3">
    {#if $messages.length === 0 && !$isLoading}
      <WelcomeScreen />
    {:else}
      {#each $messages as message (message.id)}
        <ChatBubble {message} />
      {/each}
      {#if $isLoading}
        <TypingIndicator />
      {/if}
    {/if}
  </div>

  <!-- Input Area -->
  <ChatInput disabled={$isLoading} />
</div>
