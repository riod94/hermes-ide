<script lang="ts">
  import { vscode } from '../lib/vscode';
  import { settings, showSettingsPanel, availableRuleFiles, models, activeModel } from '../lib/store';
  import { DEFAULT_SETTINGS } from '../lib/types';
  import type { Settings } from '../lib/types';

  // Local state derived from store — always reactive
  let localSettings: Settings = $derived({ ...$settings });

  // Scan rule files when panel opens
  $effect(() => {
    if ($showSettingsPanel) {
      vscode.postMessage({ type: 'scanRuleFiles' });
    }
  });

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const updated = { ...localSettings, [key]: value };
    settings.set(updated);
    vscode.postMessage({ type: 'updateSettings', settings: updated });
  }

  function handleFontSize(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    updateSetting('fontSize', val);
  }

  function toggleSetting(key: 'sendOnEnter' | 'autoScroll' | 'showTimestamps' | 'compactMode') {
    updateSetting(key, !localSettings[key]);
  }

  function toggleRule(path: string) {
    const current = localSettings.defaultRules;
    const next = current.includes(path)
      ? current.filter((p) => p !== path)
      : [...current, path];
    updateSetting('defaultRules', next);
  }

  function handleCustomInstructions(e: Event) {
    const val = (e.target as HTMLTextAreaElement).value;
    // Enforce max length
    updateSetting('customInstructions', val.slice(0, 1000));
  }

  function handleDefaultModel(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    updateSetting('defaultModel', val);
    // Sync model switcher immediately
    activeModel.set(val);
    vscode.postMessage({ type: 'setModel', value: { id: val } });
  }

  function resetToDefaults() {
    settings.set({ ...DEFAULT_SETTINGS });
    vscode.postMessage({ type: 'updateSettings', settings: { ...DEFAULT_SETTINGS } });
  }

  function closePanel() {
    showSettingsPanel.set(false);
  }

  function shortModelName(modelId: string): string {
    const slashIndex = modelId.indexOf('/');
    return slashIndex > -1 ? modelId.slice(slashIndex + 1) : modelId;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="settings-overlay" onclick={closePanel}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="settings-panel" onclick={(e) => e.stopPropagation()}>
    <!-- Header -->
    <div class="settings-header">
      <h2 class="settings-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        Settings
      </h2>
      <button class="close-btn" onclick={closePanel} title="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Scrollable content -->
    <div class="settings-body">
      <!-- ═══ Chat Section ═══ -->
      <div class="section">
        <h3 class="section-title">🔤 Chat</h3>

        <!-- Font Size -->
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Font Size</span>
            <span class="setting-desc">Chat message text size</span>
          </div>
          <div class="setting-control range-control">
            <input
              type="range"
              min="11"
              max="18"
              value={localSettings.fontSize}
              oninput={handleFontSize}
              class="range-slider"
            />
            <span class="range-value">{localSettings.fontSize}px</span>
          </div>
        </div>

        <!-- Send on Enter -->
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Send on Enter</span>
            <span class="setting-desc">Enter sends message, Shift+Enter for newline</span>
          </div>
          <button
            class="toggle-btn"
            class:active={localSettings.sendOnEnter}
            onclick={() => toggleSetting('sendOnEnter')}
          >
            <span class="toggle-knob"></span>
          </button>
        </div>

        <!-- Auto-scroll -->
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Auto-scroll</span>
            <span class="setting-desc">Scroll to bottom during streaming</span>
          </div>
          <button
            class="toggle-btn"
            class:active={localSettings.autoScroll}
            onclick={() => toggleSetting('autoScroll')}
          >
            <span class="toggle-knob"></span>
          </button>
        </div>

        <!-- Show Timestamps -->
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Show Timestamps</span>
            <span class="setting-desc">Display time on each message</span>
          </div>
          <button
            class="toggle-btn"
            class:active={localSettings.showTimestamps}
            onclick={() => toggleSetting('showTimestamps')}
          >
            <span class="toggle-knob"></span>
          </button>
        </div>

        <!-- Compact Mode -->
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Compact Mode</span>
            <span class="setting-desc">Reduce spacing between messages</span>
          </div>
          <button
            class="toggle-btn"
            class:active={localSettings.compactMode}
            onclick={() => toggleSetting('compactMode')}
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>

      <!-- ═══ Context Section ═══ -->
      <div class="section">
        <h3 class="section-title">📏 Context</h3>

        <!-- Default Rules -->
        <div class="setting-block">
          <span class="setting-label">Default Rules</span>
          <span class="setting-desc">Auto-attach these rule files to every message</span>
          {#if $availableRuleFiles.length === 0}
            <div class="empty-state">No rule files found in workspace</div>
          {:else}
            <div class="rules-list">
              {#each $availableRuleFiles as rule}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="rule-item"
                  class:selected={localSettings.defaultRules.includes(rule.path)}
                  onclick={() => toggleRule(rule.path)}
                >
                  <span class="rule-checkbox">
                    {#if localSettings.defaultRules.includes(rule.path)}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    {/if}
                  </span>
                  <span class="rule-icon">📏</span>
                  <span class="rule-name" title={rule.path}>{rule.name}</span>
                  <span class="rule-path">{rule.path}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Custom Instructions -->
        <div class="setting-block">
          <span class="setting-label">Custom Instructions</span>
          <span class="setting-desc">Always injected into every conversation ({localSettings.customInstructions.length}/1000)</span>
          <textarea
            class="instructions-textarea"
            placeholder="e.g. Always respond in Bahasa Indonesia. Use TypeScript with strict types..."
            value={localSettings.customInstructions}
            oninput={handleCustomInstructions}
            maxlength="1000"
            rows="3"
          ></textarea>
        </div>
      </div>

      <!-- ═══ Model Section ═══ -->
      <div class="section">
        <h3 class="section-title">🤖 Model</h3>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Default Model</span>
            <span class="setting-desc">Used when creating a new session</span>
          </div>
          <select
            class="model-select"
            value={localSettings.defaultModel}
            onchange={handleDefaultModel}
          >
            {#each $models as model (model.id)}
              <option value={model.id}>{shortModelName(model.id)}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Reset -->
      <div class="reset-section">
        <button class="reset-btn" onclick={resetToDefaults}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          Reset to Defaults
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: flex-end;
    animation: fade-in 0.15s ease-out;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .settings-panel {
    width: 100%;
    max-width: 360px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-sidebar);
    border-left: 1px solid var(--color-border);
    animation: slide-in 0.2s ease-out;
    overflow: hidden;
  }

  @keyframes slide-in {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .settings-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-fg);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--color-input-bg);
    color: var(--color-fg);
  }

  .settings-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px 24px;
  }

  /* ── Sections ── */
  .section {
    margin-bottom: 20px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-muted);
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--color-border);
  }

  /* ── Setting Rows ── */
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
  }

  .setting-row + .setting-row {
    border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .setting-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-fg);
  }

  .setting-desc {
    font-size: 10px;
    color: var(--color-muted);
  }

  /* ── Setting Blocks (for rules, textarea) ── */
  .setting-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
  }

  .setting-block + .setting-block {
    border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  }

  /* ── Toggle ── */
  .toggle-btn {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    border: none;
    background: var(--color-input-bg);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.2s;
    padding: 0;
  }

  .toggle-btn.active {
    background: var(--color-btn-bg);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-fg);
    transition: transform 0.2s;
  }

  .toggle-btn.active .toggle-knob {
    transform: translateX(16px);
    background: var(--color-btn-fg);
  }

  /* ── Range Slider ── */
  .range-control {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .range-slider {
    width: 90px;
    height: 4px;
    appearance: none;
    -webkit-appearance: none;
    background: var(--color-input-bg);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .range-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-btn-bg);
    border: none;
    cursor: pointer;
  }

  .range-value {
    font-size: 11px;
    color: var(--color-muted);
    min-width: 30px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* ── Rules List ── */
  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 4px;
  }

  .rule-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s;
    border: 1px solid transparent;
  }

  .rule-item:hover {
    background: var(--color-input-bg);
  }

  .rule-item.selected {
    background: color-mix(in srgb, var(--color-btn-bg) 12%, transparent);
    border-color: color-mix(in srgb, var(--color-btn-bg) 30%, transparent);
  }

  .rule-checkbox {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid var(--color-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .rule-item.selected .rule-checkbox {
    background: var(--color-btn-bg);
    border-color: var(--color-btn-bg);
    color: var(--color-btn-fg);
  }

  .rule-icon {
    font-size: 12px;
    flex-shrink: 0;
  }

  .rule-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rule-path {
    font-size: 10px;
    color: var(--color-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-left: auto;
    max-width: 120px;
  }

  .empty-state {
    font-size: 11px;
    color: var(--color-muted);
    padding: 8px;
    text-align: center;
    font-style: italic;
  }

  /* ── Custom Instructions ── */
  .instructions-textarea {
    width: 100%;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-input-border);
    background: var(--color-input-bg);
    color: var(--color-input-fg);
    font-size: 11px;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 60px;
    max-height: 120px;
    outline: none;
    transition: border-color 0.15s;
    margin-top: 4px;
  }

  .instructions-textarea:focus {
    border-color: var(--color-btn-bg);
  }

  .instructions-textarea::placeholder {
    color: var(--color-muted);
    opacity: 0.6;
  }

  /* ── Model Select ── */
  .model-select {
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--color-input-border);
    background: var(--color-input-bg);
    color: var(--color-input-fg);
    font-size: 11px;
    outline: none;
    cursor: pointer;
    max-width: 160px;
  }

  .model-select:focus {
    border-color: var(--color-btn-bg);
  }

  /* ── Reset Button ── */
  .reset-section {
    display: flex;
    justify-content: center;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .reset-btn:hover {
    background: var(--color-input-bg);
    color: var(--color-fg);
    border-color: var(--color-muted);
  }
</style>
