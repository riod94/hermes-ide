<script lang="ts">
</script>

<div class="flex-1 flex flex-col items-center justify-center px-6 text-center">
  <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
       style="background: var(--color-agent-bubble);">
    ⚡
  </div>
  <h2 class="text-[15px] font-semibold mb-2" style="color: var(--color-fg);">
    Welcome to Hermes IDE
  </h2>
  <p class="text-[12px] leading-relaxed mb-6" style="color: var(--color-muted);">
    Your AI coding assistant. Ask questions, generate code, debug issues, or explore your project.
  </p>

  <div class="grid gap-2 w-full max-w-[260px]">
    {#each suggestions as suggestion}
      <button
        class="text-left px-3 py-2 rounded-lg text-[12px] transition-colors hover:opacity-90 border"
        style="background: var(--color-agent-bubble); color: var(--color-fg); border-color: var(--color-border);"
        onclick={() => {
          // Simulate click to focus input
          const ta = document.querySelector('textarea');
          if (ta) {
            ta.value = suggestion;
            ta.dispatchEvent(new Event('input'));
            ta.focus();
          }
        }}
      >
        {suggestion}
      </button>
    {/each}
  </div>
</div>

<script module lang="ts">
  const suggestions = [
    '💡 Explain this codebase structure',
    '🐛 Help me debug an error',
    '✨ Generate a new component',
    '📖 Write documentation for a file',
  ];
</script>
