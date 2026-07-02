<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  export let show = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let closeable = true;

  const dispatch = createEventDispatcher();

  const sizes: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  function close() {
    if (!closeable) return;
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && closeable) close();
  }

  function handleBackdrop() {
    if (closeable) close();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <div
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click|self={handleBackdrop}
    role="dialog"
    aria-modal="true"
  >
    <div
      transition:scale={{ start: 0.95, duration: 200 }}
      class="bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl shadow-black/40 w-full {sizes[size]} overflow-hidden"
    >
      <!-- Header -->
      {#if $$slots.header}
        <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <slot name="header" />
          {#if closeable}
            <button on:click={close} class="text-zinc-500 hover:text-zinc-300 transition-colors p-1 -mr-1 rounded-lg hover:bg-zinc-800">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>
      {/if}

      <!-- Body -->
      <div class="px-6 py-5">
        <slot />
      </div>

      <!-- Footer -->
      {#if $$slots.footer}
        <div class="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950/30">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}
