<script lang="ts">
  import { vscode } from '../lib/vscode';
  import { showMentionPopup } from '../lib/store';

  interface MentionOption {
    id: string;
    label: string;
    icon: string;
    description: string;
  }

  const options: MentionOption[] = [
    { id: 'file', label: '@file', icon: '📄', description: 'Attach a file as context' },
    { id: 'folder', label: '@folder', icon: '📁', description: 'Attach folder listing' },
    { id: 'terminal', label: '@terminal', icon: '⬛', description: 'Attach terminal output' },
    { id: 'rules', label: '@rules', icon: '📏', description: 'Attach project rules/guidelines' },
  ];

  let selectedIndex = $state(0);
  let filterText = $state('');

  let filteredOptions = $derived(
    filterText
      ? options.filter(o => o.label.toLowerCase().includes(filterText.toLowerCase()))
      : options
  );

  export function handleKeydown(e: KeyboardEvent): boolean {
    if (!$showMentionPopup) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % filteredOptions.length;
        return true;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + filteredOptions.length) % filteredOptions.length;
        return true;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (filteredOptions.length > 0) {
          selectOption(filteredOptions[selectedIndex]);
        }
        return true;
      case 'Escape':
        e.preventDefault();
        close();
        return true;
    }
    return false;
  }

  function selectOption(option: MentionOption) {
    if (option.id === 'file') {
      vscode.postMessage({ type: 'pickFile' });
    } else if (option.id === 'folder') {
      vscode.postMessage({ type: 'pickFolder' });
    } else if (option.id === 'terminal') {
      vscode.postMessage({ type: 'pickTerminal' });
    } else if (option.id === 'rules') {
      vscode.postMessage({ type: 'pickRules' });
    }
    close();
  }

  function close() {
    showMentionPopup.set(false);
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

{#if $showMentionPopup}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="mention-popup" onclick={(e) => e.stopPropagation()}>
    {#each filteredOptions as option, i}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="mention-item"
        class:selected={i === selectedIndex}
        onclick={() => selectOption(option)}
        onmouseenter={() => selectedIndex = i}
      >
        <span class="mention-icon">{option.icon}</span>
        <div class="mention-info">
          <span class="mention-label">{option.label}</span>
          <span class="mention-desc">{option.description}</span>
        </div>
      </div>
    {/each}
    {#if filteredOptions.length === 0}
      <div class="mention-empty">No matches</div>
    {/if}
  </div>
{/if}

<style>
  .mention-popup {
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

  .mention-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .mention-item:hover,
  .mention-item.selected {
    background: var(--color-input-bg);
  }

  .mention-icon {
    font-size: 16px;
    flex-shrink: 0;
    width: 24px;
    text-align: center;
  }

  .mention-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .mention-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-fg);
    font-family: var(--vscode-editor-font-family, 'Fira Code', monospace);
  }

  .mention-desc {
    font-size: 11px;
    color: var(--color-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mention-empty {
    padding: 12px;
    text-align: center;
    font-size: 11px;
    color: var(--color-muted);
  }
</style>
