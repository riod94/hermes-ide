<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  export let message: string;
  export let type: 'success' | 'error' | 'warning' | 'info' = 'info';
  export let duration: number = 4000;
  export let onClose: () => void = () => {};

  let visible = true;
  let progress = 100;
  let interval: ReturnType<typeof setInterval>;

  const icons: Record<string, string> = {
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  };

  const colors: Record<string, { bg: string; border: string; text: string; icon: string; bar: string }> = {
    success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: 'text-emerald-400', bar: 'bg-emerald-500' },
    error: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', icon: 'text-red-400', bar: 'bg-red-500' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', icon: 'text-amber-400', bar: 'bg-amber-500' },
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', icon: 'text-blue-400', bar: 'bg-blue-500' },
  };

  $: c = colors[type];

  onMount(() => {
    const step = 100 / (duration / 50);
    interval = setInterval(() => {
      progress -= step;
      if (progress <= 0) {
        clearInterval(interval);
        close();
      }
    }, 50);
    return () => clearInterval(interval);
  });

  function close() {
    visible = false;
    setTimeout(onClose, 300);
  }
</script>

{#if visible}
  <div
    transition:fly={{ y: -20, duration: 250 }}
    class="relative w-full max-w-sm {c.bg} border {c.border} rounded-xl overflow-hidden shadow-2xl shadow-black/30 backdrop-blur-sm"
  >
    <div class="flex items-start gap-3 p-4">
      <svg class="w-5 h-5 {c.icon} flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icons[type]} />
      </svg>
      <p class="text-sm {c.text} flex-1 leading-relaxed">{message}</p>
      <button on:click={close} class="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <!-- Progress bar -->
    <div class="h-0.5 w-full bg-zinc-800">
      <div class="h-full {c.bar} transition-all duration-50 ease-linear" style="width: {progress}%"></div>
    </div>
  </div>
{/if}
