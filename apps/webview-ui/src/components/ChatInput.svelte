<script lang="ts">
  import { vscode } from '../lib/vscode';
  import { activeModel, showModelSelector, attachments, showMentionPopup } from '../lib/store';
  import type { ContextAttachment } from '../lib/types';
  import MentionPopup from './MentionPopup.svelte';

  interface Props {
    disabled?: boolean;
  }

  let { disabled = false }: Props = $props();

  let inputText = $state('');
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let mentionPopupComponent: MentionPopup | undefined = $state();

  function send() {
    const trimmed = inputText.trim();
    if (!trimmed || disabled) return;

    // Collect current attachments
    let currentAttachments: ContextAttachment[] = [];
    attachments.subscribe((v: ContextAttachment[]) => currentAttachments = v)();

    vscode.postMessage({
      type: 'chatMessage',
      value: trimmed,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    });
    inputText = '';

    // Clear attachments after sending
    attachments.set([]);
    showMentionPopup.set(false);

    // Reset textarea height
    if (textareaEl) {
      textareaEl.style.height = 'auto';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Let mention popup handle keys first
    if (mentionPopupComponent?.handleKeydown(e)) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleInput() {
    autoResize();
    detectMention();
  }

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 150) + 'px';
  }

  function detectMention() {
    if (!textareaEl) return;
    const cursorPos = textareaEl.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursorPos);

    // Check if there's an @ that starts a mention (@ at start or after whitespace)
    const atMatch = textBeforeCursor.match(/(?:^|\s)@(\w*)$/);
    if (atMatch) {
      showMentionPopup.set(true);
      mentionPopupComponent?.setFilter(atMatch[1]);
    } else {
      showMentionPopup.set(false);
      mentionPopupComponent?.reset();
    }
  }

  function removeAttachment(index: number) {
    attachments.update((items: ContextAttachment[]) => items.filter((_: ContextAttachment, i: number) => i !== index));
  }

  /** Strip @mention text from input after picker opens */
  function stripMentionText() {
    if (!textareaEl) return;
    const cursorPos = textareaEl.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(?:^|\s)@\w*$/);
    if (atMatch) {
      const matchStart = textBeforeCursor.length - atMatch[0].length;
      // Keep leading whitespace if it was a space+@ match
      const keepLeading = atMatch[0].startsWith(' ') ? matchStart + 1 : matchStart;
      inputText = inputText.slice(0, matchStart === 0 ? 0 : keepLeading) + inputText.slice(cursorPos);
    }
  }

  // Listen for attachmentAdded from extension host
  // (message handler is in App.svelte, which updates the store)

  function toggleModelSelector() {
    showModelSelector.update((v: boolean) => !v);
  }

  /** Display short model name (strip prefix like gc/, ag/, kr/) */
  function shortModelName(modelId: string): string {
    const slashIndex = modelId.indexOf('/');
    return slashIndex > -1 ? modelId.slice(slashIndex + 1) : modelId;
  }

  /** Strip mention text when popup closes due to a pick */
  $effect(() => {
    // When mention popup closes, clean up @ text in input
    if (!$showMentionPopup) {
      // Small delay to avoid racing with the pick action
    }
  });
</script>

<div class="input-container border-t" style="border-color: var(--color-border); background: var(--color-sidebar);">
  <!-- Attachment chips (above textarea) -->
  {#if $attachments.length > 0}
    <div class="attachment-chips px-3 pt-2">
      {#each $attachments as attachment, i}
        <div class="attachment-chip">
          <span class="chip-icon">{attachment.type === 'file' ? '📄' : '📁'}</span>
          <span class="chip-name" title={attachment.path}>{attachment.name}</span>
          <button class="chip-remove" onclick={() => removeAttachment(i)} title="Remove">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Input row: textarea + send button (with mention popup anchor) -->
  <div class="input-row-wrapper" style="position: relative;">
    <MentionPopup bind:this={mentionPopupComponent} />

    <div class="flex items-end gap-2 px-3 pt-3 pb-1">
      <textarea
        bind:this={textareaEl}
        bind:value={inputText}
        onkeydown={handleKeydown}
        oninput={handleInput}
        placeholder="Ask Hermes something… (type @ for context)"
        rows="1"
        {disabled}
        class="flex-1 resize-none rounded-lg px-3 py-2 text-[13px] leading-normal outline-none transition-colors placeholder:opacity-50"
        style="background: var(--color-input-bg);
               color: var(--color-input-fg);
               border: 1px solid var(--color-input-border);
               max-height: 150px;"
      ></textarea>

      <button
        onclick={send}
        disabled={disabled || !inputText.trim()}
        class="flex-shrink-0 rounded-lg p-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style="background: var(--color-btn-bg); color: var(--color-btn-fg);"
        title="Send (Enter)"
      >
        <!-- Send icon (arrow up) -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </button>
    </div>
  </div>

  <!-- Toolbar row: [+] attachment ... [model selector] -->
  <div class="toolbar-row flex items-center justify-between px-3 pb-2 pt-1">
    <div class="flex items-center gap-1">
      <!-- Attachment button placeholder (future Phase 4E) -->
      <button
        class="toolbar-btn"
        title="Attach file (coming soon)"
        disabled
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>

    <div class="flex items-center gap-1">
      <!-- Model selector badge -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="model-badge" onclick={toggleModelSelector} title="Switch model">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
        <span class="model-badge-name">{shortModelName($activeModel)}</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
  </div>
</div>

<style>
  .input-container {
    flex-shrink: 0;
  }

  .input-row-wrapper {
    position: relative;
  }

  .toolbar-row {
    min-height: 24px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: var(--color-input-bg);
    color: var(--color-fg);
  }

  .toolbar-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .model-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    transition: all 0.15s;
    background: transparent;
  }

  .model-badge:hover {
    background: var(--color-input-bg);
    border-color: var(--color-muted);
  }

  .model-badge-name {
    font-size: 11px;
    color: var(--color-muted);
    max-width: 140px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .model-badge svg {
    color: var(--color-muted);
    flex-shrink: 0;
  }

  /* ── Attachment chips ── */
  .attachment-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .attachment-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px 3px 8px;
    border-radius: 6px;
    background: var(--color-input-bg);
    border: 1px solid var(--color-border);
    font-size: 11px;
    color: var(--color-fg);
    max-width: 200px;
  }

  .chip-icon {
    font-size: 12px;
    flex-shrink: 0;
  }

  .chip-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: all 0.15s;
  }

  .chip-remove:hover {
    background: var(--color-border);
    color: var(--color-fg);
  }
</style>
