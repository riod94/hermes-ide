<script lang="ts">
  import ChatHeader from './components/ChatHeader.svelte';
  import ChatBubble from './components/ChatBubble.svelte';
  import ChatInput from './components/ChatInput.svelte';
  import TypingIndicator from './components/TypingIndicator.svelte';
  import WelcomeScreen from './components/WelcomeScreen.svelte';
  import SessionList from './components/SessionList.svelte';
  import ModelSelector from './components/ModelSelector.svelte';
  import {
    messages, isLoading, updateMessage, clearMessages,
    sessions, activeSessionId, activeSessionTitle, showSessionList,
    models, activeModel, showModelSelector,
    attachments, editText,
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
        // Model management messages
        case 'modelsLoaded': {
          const modMsg = msg as any;
          models.set(modMsg.models || []);
          activeModel.set(modMsg.activeModel || 'hermes-agent');
          break;
        }
        case 'modelChanged': {
          const chgMsg = msg as any;
          activeModel.set(chgMsg.model);
          break;
        }
        // Attachment messages (from @file / @folder picks)
        case 'attachmentAdded': {
          const attMsg = msg as any;
          // Selection attachments are handled inline in ChatInput (rich text chip)
          if (attMsg.attachment?.type === 'selection') break;
          attachments.update((items: any[]) => [...items, attMsg.attachment]);
          break;
        }
        case 'folderFilesAdded': {
          const folderMsg = msg as any;
          // Add folder as a single attachment
          attachments.update((items: any[]) => [...items, {
            type: 'folder',
            name: folderMsg.folderName,
            path: folderMsg.folderPath,
          }]);
          break;
        }
        case 'clearLastError': {
          // Remove last error assistant message for retry
          messages.update((msgs) => {
            // Find last message with error status or error content
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === 'assistant' && (msgs[i].status === 'error' || msgs[i].content.includes('[Error:'))) {
                return msgs.filter((_, idx) => idx !== i);
              }
            }
            return msgs;
          });
          break;
        }
        case 'populateInput': {
          // Pre-fill the chat input with unsent message text + restore attachments
          const popMsg = msg as any;
          editText.set(popMsg.text);
          // Restore attachments to the attachment chips above input
          if (popMsg.attachments && popMsg.attachments.length > 0) {
            attachments.set(popMsg.attachments);
          }
          break;
        }
        case 'removeMessages': {
          // Remove messages from a certain index onwards (for unsend rollback)
          const rmMsg = msg as any;
          messages.update((msgs) => msgs.slice(0, rmMsg.fromIndex));
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

  <!-- Input Area + Model Selector (anchored above input) -->
  <div class="input-wrapper" style="position: relative; flex-shrink: 0;">
    {#if $showModelSelector}
      <ModelSelector />
    {/if}
    <ChatInput disabled={$isLoading} />
  </div>
</div>
