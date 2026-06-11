<script lang="ts">
  import { vscode } from '../lib/vscode';

  interface Props {
    disabled?: boolean;
  }

  let { disabled = false }: Props = $props();

  let inputText = $state('');
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  function send() {
    const trimmed = inputText.trim();
    if (!trimmed || disabled) return;

    vscode.postMessage({ type: 'chatMessage', value: trimmed });
    inputText = '';

    // Reset textarea height
    if (textareaEl) {
      textareaEl.style.height = 'auto';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 150) + 'px';
  }
</script>

<div class="flex items-end gap-2 p-3 border-t" style="border-color: var(--color-border); background: var(--color-sidebar);">
  <textarea
    bind:this={textareaEl}
    bind:value={inputText}
    onkeydown={handleKeydown}
    oninput={autoResize}
    placeholder="Ask Hermes something…"
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
