<script lang="ts">
  interface Props {
    onClear?: () => void;
  }

  let { onClear }: Props = $props();
</script>

<header class="flex items-center justify-between px-3 py-2 border-b"
        style="border-color: var(--color-border); background: var(--color-sidebar);">
  <div class="flex items-center gap-2">
    <div class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
         style="background: var(--color-badge); color: var(--color-badge-fg);">
      ⚡
    </div>
    <div>
      <h1 class="text-[13px] font-semibold leading-tight" style="color: var(--color-fg);">Hermes AI</h1>
      <p class="text-[10px] leading-tight" style="color: var(--color-muted);">Agentic Coding Assistant</p>
    </div>
  </div>

  <div class="flex items-center gap-1">
    <!-- Clear chat button -->
    <button onclick={() => onClear?.()}
            class="p-1.5 rounded-md transition-colors hover:opacity-80"
            style="color: var(--color-muted);"
            title="Clear chat">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
      </svg>
    </button>
  </div>
</header>
