<script lang="ts">
  import { vscode } from '../lib/vscode';
  import { models, activeModel, showModelSelector } from '../lib/store';
  import type { ModelInfo } from '../lib/types';

  /** Group labels for owned_by categories */
  const GROUP_LABELS: Record<string, { label: string; icon: string }> = {
    combo: { label: 'Combo', icon: '⭐' },
    gc: { label: 'Google Cloud', icon: '☁️' },
    ag: { label: 'Agentic', icon: '🤖' },
    kr: { label: 'Premium', icon: '🔑' },
  };

  /** Group models by owned_by */
  function groupModels(modelList: ModelInfo[]): Map<string, ModelInfo[]> {
    const groups = new Map<string, ModelInfo[]>();
    for (const model of modelList) {
      const key = model.owned_by || 'other';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(model);
    }
    return groups;
  }

  function selectModel(modelId: string) {
    activeModel.set(modelId);
    showModelSelector.set(false);
    vscode.postMessage({ type: 'setModel', value: { id: modelId } });
  }

  function handleBackdropClick() {
    showModelSelector.set(false);
  }

  function getDisplayName(modelId: string): string {
    const slashIndex = modelId.indexOf('/');
    return slashIndex > -1 ? modelId.slice(slashIndex + 1) : modelId;
  }

  let grouped = $derived(groupModels($models));
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="model-backdrop" onclick={handleBackdropClick}></div>

<!-- Dropdown panel — anchored above input toolbar -->
<div class="model-dropdown">
  <div class="dropdown-header">
    <span class="dropdown-title">Select Model</span>
    <span class="model-count">{$models.length} available</span>
  </div>

  <div class="dropdown-body">
    {#each [...grouped.entries()] as [groupKey, groupModels] (groupKey)}
      {@const meta = GROUP_LABELS[groupKey] || { label: groupKey, icon: '📦' }}
      <div class="model-group">
        <div class="group-label">
          <span class="group-icon">{meta.icon}</span>
          <span>{meta.label}</span>
        </div>
        {#each groupModels as model (model.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="model-item"
               class:active={$activeModel === model.id}
               onclick={() => selectModel(model.id)}>
            <span class="model-name">{getDisplayName(model.id)}</span>
            {#if $activeModel === model.id}
              <span class="check-icon">✓</span>
            {/if}
          </div>
        {/each}
      </div>
    {/each}

    {#if $models.length === 0}
      <div class="empty-state">
        <span style="color: var(--color-muted);">No models available</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .model-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
  }

  .model-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    z-index: 100;
    border-top: 1px solid var(--color-border);
    background: var(--color-sidebar);
    max-height: 320px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
    border-radius: 8px 8px 0 0;
  }

  .dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .dropdown-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-fg);
  }

  .model-count {
    font-size: 10px;
    color: var(--color-muted);
  }

  .dropdown-body {
    overflow-y: auto;
    flex: 1;
  }

  .model-group {
    padding: 4px 0;
  }

  .model-group + .model-group {
    border-top: 1px solid var(--color-border);
  }

  .group-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: 10px;
    font-weight: 600;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .group-icon {
    font-size: 11px;
  }

  .model-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 12px 5px 28px;
    cursor: pointer;
    transition: background-color 0.1s;
  }

  .model-item:hover {
    background: var(--color-input-bg);
  }

  .model-item.active {
    background: var(--color-input-bg);
  }

  .model-name {
    font-size: 12px;
    color: var(--color-fg);
  }

  .model-item.active .model-name {
    font-weight: 600;
    color: var(--color-badge);
  }

  .check-icon {
    font-size: 12px;
    color: var(--color-badge);
    font-weight: 700;
  }

  .empty-state {
    padding: 16px;
    text-align: center;
    font-size: 12px;
  }
</style>
