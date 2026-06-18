<script lang="ts">
  interface ToolUseInfo {
    /** Tool name (e.g., "read_file", "terminal", "search_files") */
    name: string;
    /** Status: running or completed */
    status: 'running' | 'done';
    /** Arguments summary (optional, from tool call) */
    args?: string;
  }

  interface Props {
    tools: ToolUseInfo[];
  }

  let { tools }: Props = $props();

  let expanded = $state(false);

  const completedCount = $derived(tools.filter(t => t.status === 'done').length);
  const isAllDone = $derived(completedCount === tools.length);
  const runningTool = $derived(tools.find(t => t.status === 'running'));

  /** Map tool names to short icons */
  function toolIcon(name: string): string {
    const map: Record<string, string> = {
      'read_file': '📖',
      'write_file': '📝',
      'search_files': '🔍',
      'terminal': '⬛',
      'patch': '🩹',
      'browser_navigate': '🌐',
      'browser_snapshot': '📷',
      'browser_click': '👆',
      'browser_type': '⌨️',
      'web_search': '🔎',
      'web_extract': '📄',
      'delegate_task': '🤖',
      'execute_code': '⚡',
      'vision_analyze': '👁️',
      'skill_view': '📚',
      'memory': '🧠',
    };
    return map[name] || '🔧';
  }

  function toggleExpand() {
    expanded = !expanded;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tool-card" class:running={!isAllDone} onclick={toggleExpand}>
  <!-- Summary row (always visible) -->
  <div class="tool-summary">
    <div class="tool-summary-left">
      {#if !isAllDone && runningTool}
        <span class="tool-spinner"></span>
        <span class="tool-label">Using tool: <strong>{runningTool.name}</strong></span>
      {:else}
        <svg class="tool-done-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span class="tool-label">{tools.length} tool{tools.length !== 1 ? 's' : ''} used</span>
      {/if}
    </div>
    <svg class="tool-chevron" class:expanded width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </div>

  <!-- Expanded detail -->
  {#if expanded}
    <div class="tool-list">
      {#each tools as tool}
        <div class="tool-item" class:done={tool.status === 'done'}>
          <span class="tool-item-icon">{toolIcon(tool.name)}</span>
          <span class="tool-item-name">{tool.name}</span>
          {#if tool.args}
            <span class="tool-item-args" title={tool.args}>{tool.args}</span>
          {/if}
          <span class="tool-item-status">
            {#if tool.status === 'running'}
              <span class="tool-item-spinner"></span>
            {:else}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a6e3a1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tool-card {
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    margin: 6px 0;
    cursor: pointer;
    transition: background 0.15s;
    overflow: hidden;
  }

  .tool-card:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .tool-card.running {
    border-color: rgba(var(--color-accent-rgb, 139, 233, 253), 0.2);
  }

  /* ── Summary ── */
  .tool-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
  }

  .tool-summary-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tool-label {
    font-size: 11.5px;
    color: var(--color-muted);
  }

  .tool-label strong {
    color: var(--color-fg);
    font-weight: 500;
  }

  .tool-done-icon {
    color: #a6e3a1;
    flex-shrink: 0;
  }

  .tool-chevron {
    color: var(--color-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .tool-chevron.expanded {
    transform: rotate(180deg);
  }

  /* ── Spinner ── */
  .tool-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  .tool-item-spinner {
    width: 10px;
    height: 10px;
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── List ── */
  .tool-list {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding: 4px 6px;
  }

  .tool-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-radius: 4px;
    font-size: 11px;
  }

  .tool-item-icon {
    font-size: 12px;
    flex-shrink: 0;
  }

  .tool-item-name {
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    color: var(--color-fg);
    font-size: 11px;
    flex-shrink: 0;
  }

  .tool-item-args {
    color: var(--color-muted);
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .tool-item-status {
    margin-left: auto;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .tool-item.done {
    opacity: 0.7;
  }
</style>
