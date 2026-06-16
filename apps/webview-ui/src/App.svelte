<script lang="ts">
  import ChatHeader from './components/ChatHeader.svelte';
  import ChatBubble from './components/ChatBubble.svelte';
  import ChatInput from './components/ChatInput.svelte';
  import TypingIndicator from './components/TypingIndicator.svelte';
  import WelcomeScreen from './components/WelcomeScreen.svelte';
  import SessionList from './components/SessionList.svelte';
  import {
    messages, isLoading, updateMessage, clearMessages,
    sessions, activeSessionId, activeSessionTitle, showSessionList,
  } from './lib/store';
  import { vscode } from './lib/vscode';
  import type { IncomingMessage } from './lib/types';
  import DiffAlert from './components/DiffAlert.svelte';

  let chatContainerEl: HTMLDivElement | undefined = $state();
  
  // Pending diffs dari MCP Server (via Extension Host postMessage)
  let pendingDiffs: Array<{
    id: string;
    filepath: string;
    original_content: string;
    new_content: string;
  }> = $state([]);

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
        case 'showPendingDiff':
          // MCP Server mengirim diff proposal via Extension Host
          const diffData = (msg as any).diff;
          pendingDiffs = [...pendingDiffs, diffData];
          break;
        case 'clearMessages':
          clearMessages();
          break;
        // Session management messages
        case 'sessionsUpdated': {
          const sessMsg = msg as any;
          sessions.set(sessMsg.sessions);
          activeSessionId.set(sessMsg.activeSessionId);
          break;
        }
        case 'sessionLoaded': {
          const loadMsg = msg as any;
          // Replace all messages with loaded session
          messages.set(loadMsg.session.messages || []);
          activeSessionId.set(loadMsg.session.id);
          activeSessionTitle.set(loadMsg.session.title || 'New Chat');
          break;
        }
        case 'activeSession': {
          const actMsg = msg as any;
          activeSessionId.set(actMsg.session.id);
          activeSessionTitle.set(actMsg.session.title || 'New Chat');
          break;
        }
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
  }

  function handleClear() {
    clearMessages();
    vscode.postMessage({ type: 'clearChat' });
  }

  // Callback ketika DiffAlert resolve (accept/reject) — hapus dari pending list
  function handleDiffResolved(diffId: string) {
    pendingDiffs = pendingDiffs.filter(d => d.id !== diffId);
  }
</script>

<div class="flex flex-col h-screen overflow-hidden" style="background: var(--color-bg);">
  <DiffAlert {pendingDiffs} onResolved={handleDiffResolved} />
  
  <!-- Session List Panel (slide-in overlay) -->
  {#if $showSessionList}
    <SessionList />
  {/if}

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
