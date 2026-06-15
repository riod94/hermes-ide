<script lang="ts">
  import { vscode } from '../lib/vscode';
  import type { PendingDiff } from '../lib/types';

  interface Props {
    pendingDiffs?: PendingDiff[];
    onResolved?: (diffId: string) => void;
  }

  let { pendingDiffs = [], onResolved }: Props = $props();

  function handleApprove(diff: PendingDiff) {
    vscode.postMessage({
      type: 'resolveDiff',
      value: { diffId: diff.id, action: 'approve', filepath: diff.filepath, newContent: diff.new_content }
    });
    onResolved?.(diff.id);
  }

  function handleReject(diff: PendingDiff) {
    vscode.postMessage({
      type: 'resolveDiff',
      value: { diffId: diff.id, action: 'reject', filepath: diff.filepath }
    });
    onResolved?.(diff.id);
  }

  function handleReview(diff: PendingDiff) {
    vscode.postMessage({
      type: 'openDiff',
      value: { filepath: diff.filepath, originalContent: diff.original_content, newContent: diff.new_content }
    });
  }
</script>

{#if pendingDiffs.length > 0}
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
    {#each pendingDiffs as diff (diff.id)}
      <div class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] shadow-lg rounded-md p-3 flex flex-col gap-2 w-72">
        <div class="flex items-center gap-2 text-sm font-semibold text-[var(--vscode-editor-foreground)]">
          <span class="codicon codicon-git-compare"></span>
          ⚡ Diff Proposal
        </div>
        <div class="text-xs text-[var(--vscode-descriptionForeground)] truncate">
          {diff.filepath.split('/').pop()}
        </div>
        <div class="flex gap-2 mt-1">
          <button 
            onclick={() => handleReview(diff)}
            class="flex-1 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] px-2 py-1 rounded text-xs">
            Review Diff
          </button>
        </div>
        <div class="flex gap-2">
          <button 
            onclick={() => handleApprove(diff)}
            class="flex-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] px-2 py-1 rounded text-xs">
            ✅ Accept
          </button>
          <button 
            onclick={() => handleReject(diff)}
            class="flex-1 bg-[var(--vscode-errorForeground)] text-white hover:opacity-80 px-2 py-1 rounded text-xs">
            ❌ Reject
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}
