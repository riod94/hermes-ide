<script lang="ts">
  import type { ChatMessage } from '../lib/types';
  import { vscode } from '../lib/vscode';
  import { isLoading } from '../lib/store';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import CheckpointCard from './CheckpointCard.svelte';
  import ToolUseCard from './ToolUseCard.svelte';

  interface Props {
    message: ChatMessage;
    isLast?: boolean;
  }

  let { message, isLast = false }: Props = $props();

  const isUser = $derived(message.role === 'user');
  const isError = $derived(
    message.role === 'assistant' && message.status === 'error'
  );
  const hasError = $derived(
    message.role === 'assistant' && message.content.includes('Error:')
  );
  const isStreaming = $derived(message.status === 'streaming');
  const timeStr = $derived(
    new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  /** Whether unsend button is visible (hover state) */
  let showUnsend = $state(false);

  /** Icon for attachment type */
  function attachIcon(type: string): string {
    switch (type) {
      case 'file': return '📄';
      case 'folder': return '📁';
      case 'terminal': return '⬛';
      case 'url': return '🔗';
      case 'image': return '🖼️';
      case 'rules': return '📏';
      default: return '📎';
    }
  }

  // ─────────── Content Parsing ───────────

  /** Checkpoint pattern: ## CHECKPOINT N — Title or ## 📋 CHECKPOINT N — Title */
  const CHECKPOINT_RE = /^#{1,3}\s*(?:📋|✅|⚠️)?\s*CHECKPOINT\s+(\d+)\s*[—–-]\s*(.+)/im;

  /** Tool use pattern: ⏳ Using tool: tool_name or ⏳ tool_name(args) */
  const TOOL_USE_RE = /^⏳\s*(?:Using tool:\s*)?(\S+?)(?:\(([^)]*)\))?\s*$/gm;

  /** Checklist item pattern: - [ ] text or - [x] text */
  const CHECKLIST_RE = /^\s*[-*]\s*\[([ xX])\]\s+(.+)/gm;

  interface ContentSegment {
    type: 'markdown' | 'checkpoint' | 'toolgroup';
    content?: string;
    checkpoint?: {
      number: number;
      title: string;
      body: string;
      steps: { text: string; checked: boolean }[];
      actionable: boolean;
    };
    tools?: { name: string; status: 'running' | 'done'; args?: string }[];
  }

  /**
   * Parse assistant content into structured segments:
   * - Detects checkpoints and renders as CheckpointCard
   * - Groups consecutive tool-use lines into ToolUseCard
   * - Everything else rendered as markdown
   */
  function parseContent(raw: string, streaming: boolean): ContentSegment[] {
    if (!raw) return [];

    const segments: ContentSegment[] = [];
    const lines = raw.split('\n');
    let currentBlock: string[] = [];
    let currentTools: { name: string; status: 'running' | 'done'; args?: string }[] = [];
    let inCheckpoint = false;
    let checkpointLines: string[] = [];
    let checkpointNumber = 0;
    let checkpointTitle = '';

    function flushMarkdown() {
      if (currentBlock.length > 0) {
        const text = currentBlock.join('\n').trim();
        if (text) {
          segments.push({ type: 'markdown', content: text });
        }
        currentBlock = [];
      }
    }

    function flushTools() {
      if (currentTools.length > 0) {
        segments.push({ type: 'toolgroup', tools: [...currentTools] });
        currentTools = [];
      }
    }

    function flushCheckpoint() {
      if (checkpointLines.length > 0) {
        const body = checkpointLines.join('\n');
        const steps: { text: string; checked: boolean }[] = [];
        let match: RegExpExecArray | null;
        const checklistRe = /^\s*[-*]\s*\[([ xX])\]\s+(.+)/gm;
        while ((match = checklistRe.exec(body)) !== null) {
          steps.push({
            checked: match[1].toLowerCase() === 'x',
            text: match[2].trim(),
          });
        }

        // Checkpoint is actionable if it's a Plan checkpoint that has unchecked steps
        // or explicitly asks for approval, and we're not streaming
        const isActionable = !streaming && (
          /plan/i.test(checkpointTitle) ||
          /approve|approval|review/i.test(body)
        );

        segments.push({
          type: 'checkpoint',
          checkpoint: {
            number: checkpointNumber,
            title: checkpointTitle,
            body,
            steps,
            actionable: isActionable,
          },
        });
        checkpointLines = [];
        inCheckpoint = false;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for checkpoint header
      const cpMatch = line.match(CHECKPOINT_RE);
      if (cpMatch) {
        // Flush any previous content
        flushTools();
        flushMarkdown();
        flushCheckpoint();

        inCheckpoint = true;
        checkpointNumber = parseInt(cpMatch[1], 10);
        checkpointTitle = cpMatch[2].trim();
        checkpointLines = [];
        continue;
      }

      // If we're inside a checkpoint, collect lines until next heading or end
      if (inCheckpoint) {
        // Another top-level heading means checkpoint ended
        if (/^#{1,3}\s+\S/.test(line) && !CHECKPOINT_RE.test(line)) {
          flushCheckpoint();
          // This line is not part of checkpoint — process normally
          currentBlock.push(line);
          continue;
        }
        checkpointLines.push(line);
        continue;
      }

      // Check for tool use line
      const toolMatch = line.match(/^⏳\s*(?:Using tool:\s*)?(\S+?)(?:\(([^)]*)\))?\s*$/);
      if (toolMatch) {
        flushMarkdown();
        const toolName = toolMatch[1].replace(/[.:]+$/, '');
        const toolArgs = toolMatch[2] || undefined;
        // If next line is also a tool or this is the last line → running, otherwise done
        const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
        const isLast = i === lines.length - 1;
        const nextIsTool = /^⏳/.test(nextLine);
        currentTools.push({
          name: toolName,
          status: (isLast && streaming) ? 'running' : 'done',
          args: toolArgs,
        });
        continue;
      }

      // If we had tool lines and now hit non-tool, flush the tool group
      if (currentTools.length > 0 && !/^\s*$/.test(line)) {
        // Set all tools to done since we've moved past them
        currentTools = currentTools.map(t => ({ ...t, status: 'done' as const }));
        flushTools();
      }

      currentBlock.push(line);
    }

    // Flush remaining content
    flushCheckpoint();
    if (currentTools.length > 0) {
      // Last tool group — if streaming, the last tool is still running
      if (streaming) {
        currentTools[currentTools.length - 1].status = 'running';
      }
      flushTools();
    }
    flushMarkdown();

    return segments;
  }

  const contentSegments = $derived(
    isUser ? [] : parseContent(message.content, isStreaming)
  );

  function handleRetry() {
    vscode.postMessage({
      type: 'retryMessage',
    });
  }

  function handleUnsend() {
    vscode.postMessage({
      type: 'unsendMessage',
      messageId: message.id,
    });
  }
</script>

<div class="flex w-full mb-3 {isUser ? 'justify-end' : 'justify-start'}">
  <div class="max-w-[85%] flex flex-col {isUser ? 'items-end' : 'items-start'}">
    <!-- Avatar + Name -->
    <div class="flex items-center gap-1.5 mb-1 px-1">
      {#if !isUser}
        <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
             style="background: var(--color-badge); color: var(--color-badge-fg);">
          H
        </div>
        <span class="text-[11px] font-medium" style="color: var(--color-muted);">Hermes</span>
      {:else}
        <span class="text-[11px] font-medium" style="color: var(--color-muted);">You</span>
      {/if}
    </div>

    <!-- Attachment chips (above bubble, for user messages) -->
    {#if isUser && message.attachments && message.attachments.length > 0}
      <div class="bubble-attachments mb-1">
        {#each message.attachments as att}
          <div class="bubble-att-chip">
            <span class="bubble-att-icon">{attachIcon(att.type)}</span>
            <span class="bubble-att-name" title={att.path}>{att.name}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Bubble with hover for unsend -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bubble-wrapper"
         onmouseenter={() => { if (isUser) showUnsend = true; }}
         onmouseleave={() => showUnsend = false}>

      {#if isUser}
        <!-- User messages: plain text (no markdown) -->
        <div class="px-3 py-2 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap break-words"
             style="background: var(--color-user-bubble);
                    color: var(--color-btn-fg);
                    border-bottom-right-radius: 4px;">
          {message.content}
        </div>
      {:else}
        <!-- Assistant messages: structured rendering -->
        <div class="assistant-bubble rounded-xl"
             style="background: var(--color-agent-bubble);
                    color: var(--color-fg);
                    border-bottom-left-radius: 4px;">
          {#if contentSegments.length === 0}
            <!-- Empty or still loading -->
            <div class="px-3 py-2">
              <MarkdownRenderer content={message.content} {isStreaming} />
            </div>
          {:else}
            {#each contentSegments as segment}
              {#if segment.type === 'markdown' && segment.content}
                <div class="px-3 py-2">
                  <MarkdownRenderer content={segment.content} {isStreaming} />
                </div>
              {:else if segment.type === 'checkpoint' && segment.checkpoint}
                <div class="px-1 py-1">
                  <CheckpointCard checkpoint={segment.checkpoint} {isStreaming} />
                </div>
              {:else if segment.type === 'toolgroup' && segment.tools}
                <div class="px-2 py-1">
                  <ToolUseCard tools={segment.tools} />
                </div>
              {/if}
            {/each}
          {/if}
        </div>
      {/if}

      <!-- Unsend button (visible on hover, only for user messages, not while loading) -->
      {#if isUser && showUnsend && !$isLoading}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="unsend-actions">
          <span class="unsend-btn" onclick={handleUnsend} title="Unsend & edit this message">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 14 4 9 9 4"></polyline>
              <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
            </svg>
            Unsend
          </span>
        </div>
      {/if}
    </div>

    <!-- Timestamp + Status + Retry -->
    <div class="flex items-center gap-1.5 mt-0.5 px-1">
      <span class="text-[10px]" style="color: var(--color-muted);">{timeStr}</span>
      {#if message.status === 'sending'}
        <span class="text-[10px]" style="color: var(--color-muted);">⏳</span>
      {:else if message.status === 'streaming'}
        <span class="text-[10px] animate-pulse" style="color: var(--color-accent);">●</span>
      {:else if message.status === 'error' || hasError}
        <span class="text-[10px]" style="color: #f38ba8;">✗ Error</span>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span class="retry-btn" onclick={handleRetry} title="Retry message">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          Retry
        </span>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ── Assistant bubble container ── */
  .assistant-bubble {
    overflow: hidden;
  }

  /* ── Attachment chips in bubble ── */
  .bubble-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 100%;
  }

  .bubble-att-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-size: 10px;
    color: var(--color-muted);
    max-width: 160px;
  }

  .bubble-att-icon {
    font-size: 11px;
    flex-shrink: 0;
  }

  .bubble-att-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  /* ── Retry button ── */
  .retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: var(--color-accent);
    cursor: pointer;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--color-accent);
    transition: all 0.15s;
    user-select: none;
  }

  .retry-btn:hover {
    background: var(--color-accent);
    color: var(--color-bg);
  }

  /* ── Unsend button ── */
  .bubble-wrapper {
    position: relative;
  }

  .unsend-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 2px;
  }

  .unsend-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: var(--color-muted);
    cursor: pointer;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.15s;
    user-select: none;
  }

  .unsend-btn:hover {
    background: #f38ba8;
    color: var(--color-bg);
    border-color: #f38ba8;
  }
</style>
