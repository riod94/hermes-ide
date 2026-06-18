<script lang="ts">
  import { showSlashPopup, skills } from '../lib/store';
  import type { SkillInfo } from '../lib/types';

  interface SlashItem {
    id: string;
    label: string;
    icon: string;
    description: string;
    type: 'command' | 'skill';
    category?: string;
  }

  // Built-in commands (always shown first)
  const builtinCommands: SlashItem[] = [
    { id: 'cmd:new-skill', label: '/new-skill', icon: '✨', description: 'Save conversation as a new skill', type: 'command' },
    { id: 'cmd:expert', label: '/expert', icon: '🎯', description: 'Activate expert mode for complex tasks', type: 'command' },
  ];

  // Category icons
  const categoryIcons: Record<string, string> = {
    'autonomous-ai-agents': '🤖',
    'creative': '🎨',
    'data-science': '📊',
    'devops': '⚙️',
    'email': '📧',
    'gaming': '🎮',
    'github': '🐙',
    'mcp': '🔌',
    'media': '🎵',
    'mlops': '🧪',
    'note-taking': '📝',
    'productivity': '📋',
    'research': '🔬',
    'smart-home': '🏠',
    'social-media': '📱',
    'software-development': '💻',
    'red-teaming': '🔴',
    'nusawork': '🏢',
    'nusawork-legacy': '🏚️',
  };

  let selectedIndex = $state(0);
  let filterText = $state('');

  // Build combined list: commands + skills from API
  let allItems = $derived.by(() => {
    const skillItems: SlashItem[] = $skills.map((s: SkillInfo) => ({
      id: `skill:${s.name}`,
      label: `/${s.name}`,
      icon: categoryIcons[s.category || ''] || '🧠',
      description: s.description,
      type: 'skill' as const,
      category: s.category || undefined,
    }));
    return [...builtinCommands, ...skillItems];
  });

  let filteredItems = $derived.by(() => {
    if (!filterText) return allItems;
    const q = filterText.toLowerCase().replace(/^\//, '');
    return allItems.filter(item => {
      const name = item.label.toLowerCase().replace(/^\//, '');
      const desc = item.description.toLowerCase();
      const cat = (item.category || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || cat.includes(q);
    });
  });

  // Group filtered items by category for display
  let groupedItems = $derived.by(() => {
    const groups: { label: string; items: SlashItem[] }[] = [];
    const commands = filteredItems.filter(i => i.type === 'command');
    const skillItems = filteredItems.filter(i => i.type === 'skill');

    if (commands.length > 0) {
      groups.push({ label: 'Commands', items: commands });
    }

    // Group skills by category
    const catMap = new Map<string, SlashItem[]>();
    for (const s of skillItems) {
      const cat = s.category || 'Uncategorized';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(s);
    }
    for (const [cat, items] of catMap) {
      groups.push({ label: cat, items });
    }

    return groups;
  });

  // Flat list for keyboard navigation index
  let flatFiltered = $derived(groupedItems.flatMap(g => g.items));

  // Clamp selectedIndex when list changes
  $effect(() => {
    if (selectedIndex >= flatFiltered.length) {
      selectedIndex = Math.max(0, flatFiltered.length - 1);
    }
  });

  export function handleKeydown(e: KeyboardEvent): boolean {
    if (!$showSlashPopup) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % flatFiltered.length;
        return true;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + flatFiltered.length) % flatFiltered.length;
        return true;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (flatFiltered.length > 0) {
          selectItem(flatFiltered[selectedIndex]);
        }
        return true;
      case 'Escape':
        e.preventDefault();
        close();
        return true;
    }
    return false;
  }

  /** Callback set by parent to receive selected item */
  let _onSelect: ((item: SlashItem) => void) | null = null;

  export function onSelect(callback: (item: SlashItem) => void) {
    _onSelect = callback;
  }

  function selectItem(item: SlashItem) {
    if (_onSelect) {
      _onSelect(item);
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

  function isSelected(item: SlashItem): boolean {
    return flatFiltered[selectedIndex] === item;
  }
</script>

{#if $showSlashPopup}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="slash-popup" onclick={(e) => e.stopPropagation()}>
    <div class="slash-scroll">
      {#each groupedItems as group}
        <div class="slash-group-header">{group.label}</div>
        {#each group.items as item}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="slash-item"
            class:selected={isSelected(item)}
            onclick={() => selectItem(item)}
            onmouseenter={() => selectedIndex = flatFiltered.indexOf(item)}
          >
            <span class="slash-icon">{item.icon}</span>
            <div class="slash-info">
              <span class="slash-label">{item.label}</span>
              <span class="slash-desc">{item.description}</span>
            </div>
          </div>
        {/each}
      {/each}
      {#if flatFiltered.length === 0}
        <div class="slash-empty">No matching commands or skills</div>
      {/if}
    </div>
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

  .slash-scroll {
    max-height: 320px;
    overflow-y: auto;
  }

  .slash-group-header {
    padding: 6px 12px 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-muted);
    border-top: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--color-sidebar);
    z-index: 1;
  }

  .slash-group-header:first-child {
    border-top: none;
  }

  .slash-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .slash-item:hover,
  .slash-item.selected {
    background: var(--color-input-bg);
  }

  .slash-icon {
    font-size: 14px;
    flex-shrink: 0;
    width: 22px;
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
    font-size: 10px;
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
