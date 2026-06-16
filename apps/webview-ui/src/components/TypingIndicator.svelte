<script lang="ts">
  let dots = $state('');

  $effect(() => {
    const interval = setInterval(() => {
      dots = dots.length >= 3 ? '' : dots + '.';
    }, 500);
    return () => clearInterval(interval);
  });
</script>

<div class="flex w-full mb-3 justify-start">
  <div class="max-w-[85%] flex flex-col items-start">
    <div class="flex items-center gap-1.5 mb-1 px-1">
      <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
           style="background: var(--color-badge); color: var(--color-badge-fg);">
        H
      </div>
      <span class="text-[11px] font-medium" style="color: var(--color-muted);">Hermes</span>
    </div>

    <div class="px-3 py-2 rounded-xl text-[13px] leading-relaxed"
         style="background: var(--color-agent-bubble); color: var(--color-fg); border-bottom-left-radius: 4px;">
      <div class="flex items-center gap-1">
        <span class="animate-pulse" style="color: var(--color-accent);">●</span>
        <span style="color: var(--color-muted);">Thinking{dots}</span>
      </div>
    </div>
  </div>
</div>
