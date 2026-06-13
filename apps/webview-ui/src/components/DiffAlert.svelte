<script lang="ts">
  import { onMount } from 'svelte';
  import { vscode } from '../lib/vscode';

  export let pendingDiffs: Array<{
    id: string;
    filepath: string;
    original_content: string;
    new_content: string;
  }> = [];

  function handleApprove(diffId: string, filepath: string, newContent: string) {
    vscode.postMessage({
      type: 'resolveDiff',
      value: { diffId, action: 'approve', filepath, newContent }
    });
  }

  function handleReject(diffId: string) {
    vscode.postMessage({
      type: 'resolveDiff',
      value: { diffId, action: 'reject' }
    });
  }

  function handleReview(filepath: string, originalContent: string, newContent: string) {
    vscode.postMessage({
      type: 'openDiff',
      value: { filepath, originalContent, newContent }
    });
  }
</script>

{#if pendingDiffs.length > 0}
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
    {#each pendingDiffs as diff}
      <div class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] shadow-lg rounded-md p-3 flex flex-col gap-2 w-72">
        <div class="flex items-center gap-2 text-sm font-semibold text-[var(--vscode-editor-foreground)]">
          <span class="codicon codicon-git-compare"></span>
          Diff Proposal
        </div>
        <div class="text-xs text-[var(--vscode-descriptionForeground)] truncate">
          {diff.filepath.split('/').pop()}
        </div>
        <div class="flex gap-2 mt-1">
          <button 
            on:click={() => handleReview(diff.filepath, diff.original_content, diff.new_content)}
            class="flex-1 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] px-2 py-1 rounded text-xs">
            Review Diff
          </button>
        </div>
        <div class="flex gap-2">
          <button 
            on:click={() => handleApprove(diff.id, diff.filepath, diff.new_content)}
            class="flex-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] px-2 py-1 rounded text-xs">
            Approve
          </button>
          <button 
            on:click={() => handleReject(diff.id)}
            class="flex-1 bg-[var(--vscode-errorForeground)] text-white hover:opacity-80 px-2 py-1 rounded text-xs">
            Reject
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}