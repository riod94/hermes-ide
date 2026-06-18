<script lang="ts">
  import { vscode } from '../lib/vscode';
  import MarkdownRenderer from './MarkdownRenderer.svelte';

  interface CheckpointData {
    /** Checkpoint number (1, 2, 3, ...) */
    number: number;
    /** Checkpoint title (e.g., "Plan", "Implementation") */
    title: string;
    /** Content body (markdown) */
    body: string;
    /** Checklist items parsed from the body */
    steps: { text: string; checked: boolean }[];
    /** Whether this checkpoint is actionable (needs approve/revise) */
    actionable: boolean;
  }

  interface Props {
    checkpoint: CheckpointData;
    isStreaming?: boolean;
  }

  let { checkpoint, isStreaming = false }: Props = $props();

  const icon = $derived(
    checkpoint.actionable
      ? '📋'
      : checkpoint.steps.length > 0 && checkpoint.steps.every(s => s.checked)
        ? '✅'
        : '📋'
  );

  const completedSteps = $derived(checkpoint.steps.filter(s => s.checked).length);
  const totalSteps = $derived(checkpoint.steps.length);
  const progressPct = $derived(totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0);

  /** Strip checklist items from body since we render them separately */
  const bodyWithoutChecklist = $derived(() => {
    if (checkpoint.steps.length === 0) return checkpoint.body;
    // Remove lines that are checklist items
    return checkpoint.body
      .split('\n')
      .filter(line => !/^\s*[-*]\s*\[([ xX])\]\s/.test(line))
      .join('\n')
      .trim();
  });

  function handleApprove() {
    vscode.postMessage({
      type: 'checkpointAction',
      action: 'approve',
      checkpoint: checkpoint.number,
    });
  }

  function handleRevise() {
    vscode.postMessage({
      type: 'checkpointAction',
      action: 'revise',
      checkpoint: checkpoint.number,
    });
  }
</script>

<div class="cp-card" class:actionable={checkpoint.actionable} class:streaming={isStreaming}>
  <!-- Header -->
  <div class="cp-header">
    <div class="cp-title-row">
      <span class="cp-icon">{icon}</span>
      <span class="cp-title">CHECKPOINT {checkpoint.number}</span>
      <span class="cp-sep">—</span>
      <span class="cp-subtitle">{checkpoint.title}</span>
    </div>
    {#if totalSteps > 0}
      <div class="cp-progress-row">
        <div class="cp-progress-bar">
          <div class="cp-progress-fill" style="width: {progressPct}%"></div>
        </div>
        <span class="cp-progress-text">{completedSteps}/{totalSteps}</span>
      </div>
    {/if}
  </div>

  <!-- Body content (non-checklist markdown) -->
  {#if bodyWithoutChecklist()}
    <div class="cp-body">
      <MarkdownRenderer content={bodyWithoutChecklist()} {isStreaming} />
    </div>
  {/if}

  <!-- Checklist items -->
  {#if checkpoint.steps.length > 0}
    <div class="cp-steps">
      {#each checkpoint.steps as step}
        <div class="cp-step" class:checked={step.checked}>
          <span class="cp-check">{step.checked ? '☑' : '☐'}</span>
          <span class="cp-step-text">{step.text}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Action buttons (only for actionable checkpoints) -->
  {#if checkpoint.actionable && !isStreaming}
    <div class="cp-actions">
      <button class="cp-btn approve" onclick={handleApprove}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Approve
      </button>
      <button class="cp-btn revise" onclick={handleRevise}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Revise
      </button>
    </div>
  {/if}
</div>

<style>
  .cp-card {
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    margin: 4px 0;
  }

  .cp-card.actionable {
    border-color: var(--color-accent);
    box-shadow: 0 0 12px rgba(var(--color-accent-rgb, 139, 233, 253), 0.08);
  }

  /* ── Header ── */
  .cp-header {
    padding: 10px 14px 8px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cp-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .cp-icon {
    font-size: 15px;
    flex-shrink: 0;
  }

  .cp-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--color-accent);
    text-transform: uppercase;
  }

  .cp-sep {
    color: var(--color-muted);
    font-size: 12px;
  }

  .cp-subtitle {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-fg);
  }

  /* ── Progress ── */
  .cp-progress-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .cp-progress-bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .cp-progress-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--color-accent);
    transition: width 0.3s ease;
  }

  .cp-progress-text {
    font-size: 11px;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  /* ── Body ── */
  .cp-body {
    padding: 8px 14px;
  }

  /* ── Steps ── */
  .cp-steps {
    padding: 4px 14px 10px;
  }

  .cp-step {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 3px 0;
    font-size: 12.5px;
    color: var(--color-fg);
    line-height: 1.4;
  }

  .cp-check {
    flex-shrink: 0;
    font-size: 14px;
    line-height: 1.3;
    color: var(--color-muted);
  }

  .cp-step.checked .cp-check {
    color: #a6e3a1;
  }

  .cp-step.checked .cp-step-text {
    color: var(--color-muted);
  }

  /* ── Actions ── */
  .cp-actions {
    display: flex;
    gap: 8px;
    padding: 8px 14px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cp-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
    font-family: inherit;
  }

  .cp-btn.approve {
    background: var(--color-accent);
    color: var(--color-bg);
    border-color: var(--color-accent);
  }

  .cp-btn.approve:hover {
    filter: brightness(1.15);
  }

  .cp-btn.revise {
    background: transparent;
    color: var(--color-muted);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .cp-btn.revise:hover {
    color: var(--color-fg);
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.05);
  }
</style>
