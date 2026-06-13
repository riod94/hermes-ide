<script lang="ts">
  import ChatHeader from './components/ChatHeader.svelte';
  import ChatBubble from './components/ChatBubble.svelte';
  import ChatInput from './components/ChatInput.svelte';
  import TypingIndicator from './components/TypingIndicator.svelte';
  import WelcomeScreen from './components/WelcomeScreen.svelte';
  import { messages, isLoading, addMessage, updateMessage, clearMessages } from './lib/store';
  import { vscode } from './lib/vscode';
  import type { IncomingMessage } from './lib/types';
  import DiffAlert from './components/DiffAlert.svelte';

  let chatContainerEl: HTMLDivElement | undefined = $state();
  
  // Diff Polling State
  let pendingDiffs: any[] = $state([]);
  let pollInterval: ReturnType<typeof setInterval>;

  $effect(() => {
    // Start polling the MCP Interceptor HTTP Server for pending diffs
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch('http://host.docker.internal:51500/api/diffs/pending');
        if (res.ok) {
          const data = await res.json();
          pendingDiffs = data.pending || [];
        }
      } catch (err) {
        // Silently ignore connection errors (server might be down)
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  });

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
        case 'triggerDiff':
          // Menampilkan Pop-Up Alert secara native di Webview!
          const diffMsg = msg as any;
          const result = window.confirm(`Hermes proposes changes to ${diffMsg.filepath}. Do you want to review and apply them?`);
          vscode.postMessage({ 
            type: 'resolveDiff', 
            action: result ? 'approve' : 'reject',
            filepath: diffMsg.filepath,
            newContent: diffMsg.newContent
          });
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
  <DiffAlert {pendingDiffs} />
  
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
