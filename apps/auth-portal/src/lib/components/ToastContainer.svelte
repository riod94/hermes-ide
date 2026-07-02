<script lang="ts">
  import Toast from './Toast.svelte';

  interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration: number;
  }

  let toasts: ToastItem[] = [];
  let nextId = 0;

  export function toast(message: string, type: ToastItem['type'] = 'info', duration = 4000) {
    const id = nextId++;
    toasts = [...toasts, { id, message, type, duration }];
  }

  export function success(message: string, duration = 4000) { toast(message, 'success', duration); }
  export function error(message: string, duration = 5000) { toast(message, 'error', duration); }
  export function warning(message: string, duration = 4500) { toast(message, 'warning', duration); }
  export function info(message: string, duration = 4000) { toast(message, 'info', duration); }

  function remove(id: number) {
    toasts = toasts.filter(t => t.id !== id);
  }
</script>

<div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-auto">
  {#each toasts as t (t.id)}
    <Toast message={t.message} type={t.type} duration={t.duration} onClose={() => remove(t.id)} />
  {/each}
</div>
