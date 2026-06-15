<script lang="ts">
  import { vscode } from '../lib/vscode';
  import type { PendingDiff } from '../lib/types';

  interface Props {
    pendingDiffs?: PendingDiff[];
    onResolved?: (diffId: string) => void;
  }

  let { pendingDiffs = [], onResolved }: Props = $props();

  function getFileAction(diff: PendingDiff) {
    if (!diff.original_content) return 'Create';
    if (!diff.new_content) return 'Delete';
    return 'Modify';
  }

  function getActionColor(action: string) {
    switch(action) {
      case 'Create': return 'text-[var(--vscode-gitDecoration-untrackedResourceForeground)]';
      case 'Delete': return 'text-[var(--vscode-gitDecoration-deletedResourceForeground)]';
      default: return 'text-[var(--vscode-gitDecoration-modifiedResourceForeground)]';
    }
  }

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
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-3 max-h-[calc(100vh-2rem)] overflow-y-auto pr-2">
    {#each pendingDiffs as diff (diff.id)}
      {@const action = getFileAction(diff)}
      {@const colorClass = getActionColor(action)}
      <div class="bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-widget-border)] shadow-xl rounded-lg p-4 flex flex-col gap-3 w-80 animate-slide-in">
        
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm font-semibold text-[var(--vscode-editor-foreground)]">
            <span class="codicon codicon-git-pull-request text-[var(--vscode-gitDecoration-addedResourceForeground)]"></span>
            Hermes Proposal
          </div>
          <span class="text-[0.65rem] px-2 py-0.5 rounded-full border border-[var(--vscode-widget-border)] {colorClass} bg-[var(--vscode-editor-background)]">
            {action}
          </span>
        </div>

        <!-- File path -->
        <div class="bg-[var(--vscode-editor-background)] px-3 py-2 rounded border border-[var(--vscode-widget-border)] flex items-center gap-2">
          <span class="codicon codicon-file-code text-[var(--vscode-symbolIcon-fileForeground)]"></span>
          <div class="text-xs text-[var(--vscode-descriptionForeground)] font-mono truncate cursor-help" title={diff.filepath}>
            {diff.filepath.split('/').pop()}
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-2 mt-1">
          <button 
            onclick={() => handleReview(diff)}
            class="w-full flex items-center justify-center gap-2 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] px-3 py-2 rounded text-xs transition-colors border border-transparent hover:border-[var(--vscode-contrastActiveBorder,transparent)]">
            <span class="codicon codicon-open-preview"></span>
            Review Diff
          </button>
          
          <div class="flex gap-2">
            <button 
              onclick={() => handleApprove(diff)}
              class="flex-1 flex items-center justify-center gap-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] px-2 py-2 rounded text-xs transition-colors shadow-sm">
              <span class="codicon codicon-check"></span>
              Accept
            </button>
            <button 
              onclick={() => handleReject(diff)}
              class="flex-1 flex items-center justify-center gap-1 bg-transparent border border-[var(--vscode-errorForeground)] text-[var(--vscode-errorForeground)] hover:bg-[var(--vscode-errorForeground)] hover:text-white px-2 py-2 rounded text-xs transition-colors">
              <span class="codicon codicon-close"></span>
              Reject
            </button>
          </div>
        </div>

      </div>
    {/each}
  </div>
{/if}

<style>
  .animate-slide-in {
    animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0) translateY(0);
    }
  }
</style>
