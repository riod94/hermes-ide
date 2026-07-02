<script lang="ts">
  import Modal from './Modal.svelte';

  export let show = false;
  export let title = 'Confirm';
  export let message = 'Are you sure?';
  export let confirmText = 'Confirm';
  export let cancelText = 'Cancel';
  export let variant: 'danger' | 'warning' | 'info' = 'danger';
  export let loading = false;
  export let onConfirm: () => void = () => {};
  export let onCancel: () => void = () => {};

  const variantStyles: Record<string, { icon: string; iconBg: string; iconColor: string; btn: string }> = {
    danger: {
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      btn: 'bg-red-600 hover:bg-red-500 shadow-red-500/20',
    },
    warning: {
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      btn: 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20',
    },
    info: {
      icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      btn: 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20',
    },
  };

  $: v = variantStyles[variant];
</script>

<Modal {show} size="sm" on:close={onCancel}>
  <div class="text-center">
    <div class="mx-auto w-12 h-12 rounded-xl {v.iconBg} flex items-center justify-center mb-4">
      <svg class="w-6 h-6 {v.iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={v.icon} />
      </svg>
    </div>
    <h3 class="text-lg font-bold text-zinc-100 mb-2">{title}</h3>
    <p class="text-sm text-zinc-400 leading-relaxed">{message}</p>
  </div>

  <div slot="footer" class="flex gap-3">
    <button
      on:click={onCancel}
      disabled={loading}
      class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium rounded-xl text-sm transition-all disabled:opacity-50"
    >
      {cancelText}
    </button>
    <button
      on:click={onConfirm}
      disabled={loading}
      class="flex-1 py-2.5 {v.btn} text-white font-medium rounded-xl text-sm transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {#if loading}
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      {/if}
      {confirmText}
    </button>
  </div>
</Modal>
