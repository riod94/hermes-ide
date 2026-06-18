<script lang="ts">
  import { showSlashPopup } from '../lib/store';

  interface SlashCommand {
    id: string;
    label: string;
    icon: string;
    description: string;
  }

  const commands: SlashCommand[] = [
    { id: 'skills', label: '/skills', icon: '🧠', description: 'List all available skills' },
    { id: 'new-skill', label: '/new-skill', icon: '✨', description: 'Save this conversation as a new skill' },
    { id: 'expert', label: '/expert', icon: '🎯', description: 'Activate expert mode for complex tasks' },
  ];

  let selectedIndex = $state(0);
  let filterText = $state('');

  let filteredCommands = $derived(
    filterText
      ? commands.filter(c => c.label.toLowerCase().includes(filterText.toLowerCase()))
      : commands
  );

  export function handleKeydown(e: KeyboardEvent): boolean {
    if (!$showSlashPopup) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % filteredCommands.length;
        return true;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
        return true;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (filteredCommands.length > 0) {
          selectCommand(filteredCommands[selectedIndex]);
        }
        return true;
      case 'Escape':
        e.preventDefault();
        close();
        return true;
    }
    return false;
  }

  /** Callback set by parent to receive selected command */
  let _onSelect: ((cmd: SlashCommand) => void) | null = null;

  export function onSelect(callback: (cmd: SlashCommand) => void) {
    _onSelect = callback;
  }

  function selectCommand(cmd: SlashCommand) {
    if (_onSelect) {
      _onSelect(cmd);
    }
    close();
  }

  function close() {
    showSlashPopup.set(false);
    filterText = '';
    selectedIndex = 0;
  }

  export function setFilter(text: string) {
    filterText = text;
    selectedIndex = 0;
  }

  export function reset() {
    filterText = '';
    selectedIndex = 0;
  }
</script>

{#if $showSlashPopup}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="slash-popup" onclick={(e) => e.stopPropagation()}>
    <div class="slash-header">Commands</div>
    {#each filteredCommands as cmd, i}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="slash-item"
        class:selected={i === selectedIndex}
        onclick={() => selectCommand(cmd)}
        onmouseenter={() => selectedIndex = i}
      >
        <span class="slash-icon">{cmd.icon}</span>
        <div class="slash-info">
          <span class="slash-label">{cmd.label}</span>
          <span class="slash-desc">{cmd.description}</span>
        </div>
      </div>
    {/each}
    {#if filteredCommands.length === 0}
      <div class="slash-empty">No matching commands</div>
    {/if}
  </div>
{/if}

<style>
  .slash-popup {
    position: absolute;
    bottom: 100%;
    left: 8px;
    right: 8px;
    margin-bottom: 4px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-sidebar);
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    z-index: 100;
  }

  .slash-header {
    padding: 6px 12px 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-muted);
    border-bottom: 1px solid var(--color-border);
  }

  .slash-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .slash-item:hover,
  .slash-item.selected {
    background: var(--color-input-bg);
  }

  .slash-icon {
    font-size: 16px;
    flex-shrink: 0;
    width: 24px;
    text-align: center;
  }

  .slash-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .slash-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-fg);
    font-family: var(--vscode-editor-font-family, 'Fira Code', monospace);
  }

  .slash-desc {
    font-size: 11px;
    color: var(--color-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slash-empty {
    padding: 12px;
    text-align: center;
    font-size: 11px;
    color: var(--color-muted);
  }
</style>
