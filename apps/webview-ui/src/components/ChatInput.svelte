<script lang="ts">
  import { vscode } from '../lib/vscode';
  import { activeModel, showModelSelector, attachments, showMentionPopup, editText } from '../lib/store';
  import type { ContextAttachment } from '../lib/types';
  import MentionPopup from './MentionPopup.svelte';

  interface Props {
    disabled?: boolean;
  }

  let { disabled = false }: Props = $props();

  let editorEl: HTMLDivElement | undefined = $state();
  let mentionPopupComponent: MentionPopup | undefined = $state();
  let showAttachMenu = $state(false);
  let fileInputEl: HTMLInputElement | undefined = $state();

  // ─── Rich text helpers ───

  /** Get plain text from contenteditable, preserving chip placeholders */
  function getPlainText(): string {
    if (!editorEl) return '';
    let text = '';
    for (const node of editorEl.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.classList.contains('inline-chip')) {
          // Reconstruct the chip reference for display
          const chipType = el.getAttribute('data-chip-type') || 'selection';
          const chipName = el.getAttribute('data-chip-name') || '';
          if (chipType === 'selection') {
            text += `✂️ ${chipName}`;
          } else {
            text += chipName;
          }
        } else if (el.tagName === 'BR') {
          text += '\n';
        } else {
          text += el.textContent || '';
        }
      }
    }
    return text;
  }

  /** Extract inline selection chips from contenteditable as attachments */
  function extractInlineChips(): ContextAttachment[] {
    if (!editorEl) return [];
    const chips: ContextAttachment[] = [];
    const chipEls = editorEl.querySelectorAll('.inline-chip');
    chipEls.forEach((el) => {
      const chipData = el.getAttribute('data-chip-json');
      if (chipData) {
        try {
          chips.push(JSON.parse(chipData));
        } catch {}
      }
    });
    return chips;
  }

  /** Check if editor is empty */
  function isEditorEmpty(): boolean {
    if (!editorEl) return true;
    const text = editorEl.textContent?.trim() || '';
    const hasChips = editorEl.querySelectorAll('.inline-chip').length > 0;
    return text === '' && !hasChips;
  }

  /** Insert an inline chip at the current cursor position */
  function insertChipAtCursor(attachment: ContextAttachment) {
    if (!editorEl) return;
    editorEl.focus();

    const chip = createChipElement(attachment);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Only insert if cursor is inside our editor
      if (editorEl.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(chip);
        // Move cursor after the chip
        range.setStartAfter(chip);
        range.setEndAfter(chip);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        // Cursor not in editor — append at end
        editorEl.appendChild(chip);
        placeCaretAtEnd();
      }
    } else {
      editorEl.appendChild(chip);
      placeCaretAtEnd();
    }
  }

  /** Create a chip DOM element */
  function createChipElement(attachment: ContextAttachment): HTMLSpanElement {
    const chip = document.createElement('span');
    chip.className = 'inline-chip';
    chip.contentEditable = 'false';
    chip.setAttribute('data-chip-type', attachment.type);
    chip.setAttribute('data-chip-name', attachment.name);
    chip.setAttribute('data-chip-json', JSON.stringify(attachment));

    // Icon
    const icon = document.createElement('span');
    icon.className = 'inline-chip-icon';
    icon.textContent = attachment.type === 'selection' ? '✂️' : '📄';
    chip.appendChild(icon);

    // Label
    const label = document.createElement('span');
    label.className = 'inline-chip-label';
    label.textContent = attachment.name;
    chip.appendChild(label);

    // Remove button
    const removeBtn = document.createElement('span');
    removeBtn.className = 'inline-chip-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chip.remove();
    });
    chip.appendChild(removeBtn);

    return chip;
  }

  /** Place caret at end of contenteditable */
  function placeCaretAtEnd() {
    if (!editorEl) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ─── Core handlers ───

  // Watch editText store for unsend/edit population
  $effect(() => {
    const text = $editText;
    if (text && editorEl) {
      editorEl.textContent = text;
      editText.set('');
      requestAnimationFrame(() => {
        if (editorEl) {
          editorEl.focus();
          placeCaretAtEnd();
          autoResize();
        }
      });
    }
  });

  // Listen for selection attachments from extension host
  // When attachmentAdded fires for type=selection, insert inline instead of adding to attachment bar
  $effect(() => {
    function handleSelectionAttachment(e: MessageEvent) {
      const msg = e.data;
      if (msg?.type === 'attachmentAdded' && msg.attachment?.type === 'selection') {
        insertChipAtCursor(msg.attachment);
      }
    }
    window.addEventListener('message', handleSelectionAttachment);
    return () => window.removeEventListener('message', handleSelectionAttachment);
  });

  function send() {
    if (isEditorEmpty() || disabled) return;

    const plainText = getPlainText().trim();
    if (!plainText) return;

    // Collect attachments: inline chips + attachment bar items
    const inlineChips = extractInlineChips();
    let barAttachments: ContextAttachment[] = [];
    attachments.subscribe((v: ContextAttachment[]) => barAttachments = v)();
    const allAttachments = [...barAttachments, ...inlineChips];

    vscode.postMessage({
      type: 'chatMessage',
      value: plainText,
      attachments: allAttachments.length > 0 ? allAttachments : undefined,
    });

    // Clear editor
    if (editorEl) {
      editorEl.innerHTML = '';
    }

    // Clear attachment bar
    attachments.set([]);
    showMentionPopup.set(false);

    autoResize();
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
    if (!editorEl) return;
    editorEl.style.height = 'auto';
    editorEl.style.height = Math.min(editorEl.scrollHeight, 150) + 'px';
  }

  function detectMention() {
    if (!editorEl) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (!editorEl.contains(range.commonAncestorContainer)) return;

    // Get text before cursor in the current text node
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      showMentionPopup.set(false);
      mentionPopupComponent?.reset();
      return;
    }

    const textBeforeCursor = (node.textContent || '').slice(0, range.startOffset);
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

  /** Strip @mention text from input after picker selects */
  function stripMentionText() {
    if (!editorEl) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent || '';
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(?:^|\s)@\w*$/);
    if (atMatch) {
      const matchStart = textBeforeCursor.length - atMatch[0].length;
      const keepLeading = atMatch[0].startsWith(' ') ? matchStart + 1 : matchStart;
      const start = matchStart === 0 ? 0 : keepLeading;
      node.textContent = text.slice(0, start) + text.slice(cursorPos);
      // Restore cursor position
      const newRange = document.createRange();
      newRange.setStart(node, start);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }

  function toggleModelSelector() {
    showModelSelector.update((v: boolean) => !v);
  }

  function shortModelName(modelId: string): string {
    const slashIndex = modelId.indexOf('/');
    return slashIndex > -1 ? modelId.slice(slashIndex + 1) : modelId;
  }

  $effect(() => {
    if (!$showMentionPopup) {
      // Mention popup closed
    }
  });

  /** Close attach menu when clicking outside */
  $effect(() => {
    if (!showAttachMenu) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.attach-menu-container')) {
        showAttachMenu = false;
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  });

  function toggleAttachMenu() {
    showAttachMenu = !showAttachMenu;
  }

  function triggerFileUpload() {
    showAttachMenu = false;
    if (fileInputEl) {
      fileInputEl.value = '';
      fileInputEl.click();
    }
  }

  function openProjectPicker() {
    showAttachMenu = false;
    vscode.postMessage({ type: 'pickAttachment' });
  }

  const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']);
  const IMAGE_MIME_PREFIXES = ['image/'];
  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const MAX_FILES = 5;

  function showWarning(msg: string) {
    vscode.postMessage({ type: 'showWarning', value: msg });
  }

  function handleLocalFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    if (files.length > MAX_FILES) {
      showWarning(`Max ${MAX_FILES} files at a time. You selected ${files.length}.`);
      input.value = '';
      return;
    }

    let currentCount = 0;
    attachments.subscribe((v: ContextAttachment[]) => currentCount = v.length)();
    if (currentCount + files.length > MAX_FILES) {
      showWarning(`Max ${MAX_FILES} attachments total. Already have ${currentCount}, tried to add ${files.length}.`);
      input.value = '';
      return;
    }

    const oversized: string[] = [];
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        oversized.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      } else {
        validFiles.push(file);
      }
    }

    if (oversized.length > 0) {
      showWarning(`Files exceed 2MB limit:\n${oversized.join('\n')}`);
    }

    for (const file of validFiles) {
      processFile(file);
    }

    input.value = '';
  }

  function processFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImage = IMAGE_EXTENSIONS.has(ext) || IMAGE_MIME_PREFIXES.some(p => file.type.startsWith(p));

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const commaIdx = dataUrl.indexOf(',');
        const base64Data = dataUrl.slice(commaIdx + 1);
        const mimeType = file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

        vscode.postMessage({
          type: 'localFileAttached',
          file: {
            name: file.name,
            fileType: 'image',
            base64Data,
            mimeType,
            size: file.size,
          },
        });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        vscode.postMessage({
          type: 'localFileAttached',
          file: {
            name: file.name,
            fileType: 'file',
            content,
            size: file.size,
          },
        });
      };
      reader.readAsText(file);
    }
  }

  /** Prevent pasting rich content — strip to plain text */
  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    if (text) {
      document.execCommand('insertText', false, text);
    }
  }
</script>

<div class="input-container border-t" style="border-color: var(--color-border); background: var(--color-sidebar);">
  <!-- Attachment chips bar (file/folder/image/url/terminal — NOT selection) -->
  {#if $attachments.filter(a => a.type !== 'selection').length > 0}
    <div class="attachment-chips px-3 pt-2">
      {#each $attachments.filter(a => a.type !== 'selection') as attachment, i}
        <div class="attachment-chip">
          <span class="chip-icon">{attachment.type === 'file' ? '📄' : attachment.type === 'folder' ? '📁' : attachment.type === 'terminal' ? '⬛' : attachment.type === 'url' ? '🔗' : attachment.type === 'image' ? '🖼️' : '📏'}</span>
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

  <!-- Input row: rich text editor + send button -->
  <div class="input-row-wrapper" style="position: relative;">
    <MentionPopup bind:this={mentionPopupComponent} />

    <div class="flex items-end gap-2 px-3 pt-3 pb-1">
      <!-- Rich text input (contenteditable) -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={editorEl}
        contenteditable="true"
        role="textbox"
        tabindex="0"
        aria-label="Chat Input"
        aria-multiline="true"
        onkeydown={handleKeydown}
        oninput={handleInput}
        onpaste={handlePaste}
        data-placeholder="Ask Hermes something… (type @ for context)"
        class="rich-input flex-1 rounded-lg px-3 py-2 text-[13px] leading-normal outline-none transition-colors"
        style="background: var(--color-input-bg);
               color: var(--color-input-fg);
               border: 1px solid var(--color-input-border);
               max-height: 150px;
               overflow-y: auto;
               min-height: 36px;
               white-space: pre-wrap;
               word-break: break-word;"
      ></div>

      <button
        onclick={send}
        disabled={disabled}
        class="flex-shrink-0 rounded-lg p-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style="background: var(--color-btn-bg); color: var(--color-btn-fg);"
        title="Send (Enter)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </button>
    </div>
  </div>

  <!-- Toolbar row -->
  <div class="toolbar-row flex items-center justify-between px-3 pb-2 pt-1">
    <div class="flex items-center gap-1">
      <div class="attach-menu-container" style="position: relative;">
        <button
          class="toolbar-btn"
          title="Attach file or image"
          onclick={toggleAttachMenu}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        {#if showAttachMenu}
          <div class="attach-dropdown">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="attach-dropdown-item" onclick={triggerFileUpload}>
              <span class="attach-dropdown-icon">📤</span>
              <div class="attach-dropdown-text">
                <span class="attach-dropdown-label">Upload File</span>
                <span class="attach-dropdown-desc">From your computer</span>
              </div>
            </div>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="attach-dropdown-item" onclick={openProjectPicker}>
              <span class="attach-dropdown-icon">📂</span>
              <div class="attach-dropdown-text">
                <span class="attach-dropdown-label">From Project</span>
                <span class="attach-dropdown-desc">Browse workspace files</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <input
      bind:this={fileInputEl}
      type="file"
      multiple
      accept="image/*,.txt,.md,.json,.csv,.log,.yaml,.yml,.xml,.js,.ts,.py,.php,.html,.css,.scss,.sh,.bash,.sql,.env,.cfg,.ini,.toml"
      onchange={handleLocalFileSelected}
      style="display: none;"
    />

    <div class="flex items-center gap-1">
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

  /* ── Attachment chips (bar above input) ── */
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

  /* ── Rich text input (contenteditable) ── */
  .rich-input:empty::before {
    content: attr(data-placeholder);
    color: var(--color-muted);
    opacity: 0.5;
    pointer-events: none;
  }

  /* ── Inline chips inside rich input ── */
  :global(.inline-chip) {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 5px 1px 4px;
    margin: 0 2px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--color-btn-bg) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-btn-bg) 40%, transparent);
    font-size: 11px;
    line-height: 1.4;
    color: var(--color-fg);
    vertical-align: baseline;
    cursor: default;
    user-select: none;
    white-space: nowrap;
  }

  :global(.inline-chip-icon) {
    font-size: 11px;
    flex-shrink: 0;
  }

  :global(.inline-chip-label) {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.inline-chip-remove) {
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    color: var(--color-muted);
    margin-left: 1px;
    border-radius: 50%;
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
  }

  :global(.inline-chip-remove:hover) {
    background: var(--color-border);
    color: var(--color-fg);
  }

  /* ── Attach dropdown menu ── */
  .attach-dropdown {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    min-width: 200px;
    background: var(--color-sidebar);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 100;
    overflow: hidden;
  }

  .attach-dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .attach-dropdown-item:hover {
    background: var(--color-input-bg);
  }

  .attach-dropdown-item + .attach-dropdown-item {
    border-top: 1px solid var(--color-border);
  }

  .attach-dropdown-icon {
    font-size: 16px;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  .attach-dropdown-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .attach-dropdown-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-fg);
  }

  .attach-dropdown-desc {
    font-size: 10px;
    color: var(--color-muted);
  }
</style>
