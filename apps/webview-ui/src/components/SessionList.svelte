<script lang="ts">
  import { vscode } from '../lib/vscode';
  import { sessions, activeSessionId, showSessionList } from '../lib/store';
  import type { SessionMeta } from '../lib/types';

  let searchQuery = $state('');

  const filteredSessions = $derived(
    $sessions.filter((s: SessionMeta) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q);
    })
  );

  function loadSession(id: string) {
    vscode.postMessage({ type: 'loadSession', value: { id } });
    showSessionList.set(false);
  }

  function deleteSession(e: MouseEvent, id: string) {
    e.stopPropagation();
    vscode.postMessage({ type: 'deleteSession', value: { id } });
  }

  function formatTime(ts: number): string {
    const now = Date.now();
    const diff = now - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  function close() {
    showSessionList.set(false);
  }
</script>

<!-- Overlay backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="session-overlay" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()}>
  <!-- Panel -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="session-panel" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <!-- Header -->
    <div class="panel-header">
      <h2 class="panel-title">Chat History</h2>
      <button class="close-btn" onclick={close} title="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Search -->
    <div class="search-box">
      <svg class="search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search sessions…"
        class="search-input"
      />
    </div>

    <!-- Sessions List -->
    <div class="sessions-list">
      {#if filteredSessions.length === 0}
        <div class="empty-state">
          {#if searchQuery.trim()}
            <p>No sessions match "{searchQuery}"</p>
          {:else}
            <p>No chat history yet</p>
            <p class="empty-hint">Start a conversation to see it here</p>
          {/if}
        </div>
      {:else}
        {#each filteredSessions as session (session.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="session-item"
            class:active={session.id === $activeSessionId}
            onclick={() => loadSession(session.id)}
            onkeydown={(e) => e.key === 'Enter' && loadSession(session.id)}
            role="button"
            tabindex="0"
          >
            <div class="session-info">
              <div class="session-title">{session.title}</div>
              <div class="session-meta">
                <span class="session-count">{session.messageCount} msgs</span>
                <span class="session-time">{formatTime(session.updatedAt)}</span>
              </div>
              {#if session.preview}
                <div class="session-preview">{session.preview}</div>
              {/if}
            </div>
            <button
              class="delete-btn"
              onclick={(e) => deleteSession(e, session.id)}
              title="Delete session"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path>
              </svg>
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .session-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
    display: flex;
    justify-content: flex-start;
  }

  .session-panel {
    width: 280px;
    max-width: 85vw;
    height: 100%;
    background: var(--color-sidebar);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    animation: slideIn 0.15s ease-out;
  }

  @keyframes slideIn {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 8px;
    border-bottom: 1px solid var(--color-border);
  }

  .panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-fg);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  .close-btn:hover {
    color: var(--color-fg);
    background: var(--color-input-bg);
  }

  .search-box {
    position: relative;
    padding: 8px 12px;
  }

  .search-icon {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 6px 8px 6px 28px;
    border-radius: 6px;
    border: 1px solid var(--color-input-border);
    background: var(--color-input-bg);
    color: var(--color-input-fg);
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
  }
  .search-input:focus {
    border-color: var(--color-btn-bg);
  }
  .search-input::placeholder {
    color: var(--color-muted);
    opacity: 0.6;
  }

  .sessions-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .session-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: background 0.1s;
  }
  .session-item:hover {
    background: var(--color-input-bg);
  }
  .session-item.active {
    border-left-color: var(--color-btn-bg);
    background: var(--color-agent-bubble);
  }

  .session-info {
    flex: 1;
    min-width: 0;
  }

  .session-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-meta {
    display: flex;
    gap: 8px;
    margin-top: 2px;
    font-size: 10px;
    color: var(--color-muted);
  }

  .session-preview {
    font-size: 11px;
    color: var(--color-muted);
    margin-top: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.7;
  }

  .delete-btn {
    background: none;
    border: none;
    color: var(--color-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.1s;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .session-item:hover .delete-btn {
    opacity: 1;
  }
  .delete-btn:hover {
    color: #e55;
    background: rgba(238, 85, 85, 0.1);
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: var(--color-muted);
    font-size: 12px;
  }
  .empty-hint {
    font-size: 11px;
    margin-top: 4px;
    opacity: 0.6;
  }
</style>
