<script lang="ts">
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { vscode } from '../lib/vscode';

  interface Props {
    content: string;
    isStreaming?: boolean;
  }

  let { content, isStreaming = false }: Props = $props();

  // Configure marked for safe, clean rendering
  const renderer = new marked.Renderer();

  // Custom link renderer — open in new tab
  renderer.link = ({ href, title, text }) => {
    const titleAttr = title ? ` title="${title}"` : '';
    return `<a href="${href}"${titleAttr} class="md-link">${text}</a>`;
  };

  // Custom code block renderer with copy button and language label
  renderer.code = ({ text, lang }) => {
    const langLabel = lang || '';
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="md-code-block">
      <div class="md-code-header">
        <span class="md-code-lang">${langLabel}</span>
        <button class="md-copy-btn" data-code="${encodeURIComponent(text)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
      </div>
      <pre><code class="language-${langLabel}">${escaped}</code></pre>
    </div>`;
  };

  // Inline code
  renderer.codespan = ({ text }) => {
    return `<code class="md-inline-code">${text}</code>`;
  };

  // Table renderer — marked v18 passes full token, not pre-rendered strings
  renderer.table = (token) => {
    const alignAttr = (align: string | null) => align ? ` style="text-align:${align}"` : '';

    let headerHtml = '<tr>';
    for (const cell of token.header) {
      headerHtml += `<th${alignAttr(cell.align)}>${cell.text}</th>`;
    }
    headerHtml += '</tr>';

    let bodyHtml = '';
    for (const row of token.rows) {
      bodyHtml += '<tr>';
      for (const cell of row) {
        bodyHtml += `<td${alignAttr(cell.align)}>${cell.text}</td>`;
      }
      bodyHtml += '</tr>';
    }

    return `<div class="md-table-wrap"><table class="md-table"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`;
  };

  marked.setOptions({
    renderer,
    breaks: true,
    gfm: true,
  });

  // Configure DOMPurify
  const purifyConfig: DOMPurify.Config = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'a',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span', 'button', 'hr', 'img', 'sup', 'sub',
      'svg', 'path', 'rect', 'polyline', 'line', 'circle',
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'class', 'data-code',
      'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
      'd', 'x', 'y', 'width', 'height', 'rx', 'ry', 'points',
      'src', 'alt',
    ],
    ALLOW_DATA_ATTR: true,
  };

  /** Parse markdown → sanitized HTML */
  function renderMarkdown(md: string): string {
    if (!md) return '';
    try {
      const raw = marked.parse(md, { async: false }) as string;
      return DOMPurify.sanitize(raw, purifyConfig);
    } catch {
      // Fallback: escape and wrap in <p>
      const escaped = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<p>${escaped}</p>`;
    }
  }

  const renderedHtml = $derived(renderMarkdown(content));

  /** Handle clicks on copy buttons inside rendered HTML */
  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const copyBtn = target.closest('.md-copy-btn') as HTMLElement | null;
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const code = decodeURIComponent(copyBtn.dataset.code || '');
      vscode.postMessage({ type: 'copyCode', value: code });

      // Visual feedback
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.classList.remove('copied');
      }, 2000);
      return;
    }

    // Handle link clicks
    const link = target.closest('.md-link') as HTMLAnchorElement | null;
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      vscode.postMessage({ type: 'openLink', value: link.href });
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="md-content" class:streaming={isStreaming} onclick={handleClick}>
  {@html renderedHtml}
</div>

<style>
  .md-content {
    font-size: 13px;
    line-height: 1.6;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
    min-width: 0;
  }

  /* ── Headings ── */
  .md-content :global(h1),
  .md-content :global(h2),
  .md-content :global(h3),
  .md-content :global(h4) {
    margin: 12px 0 6px 0;
    font-weight: 600;
    line-height: 1.3;
    color: var(--color-fg);
  }
  .md-content :global(h1) { font-size: 1.3em; }
  .md-content :global(h2) { font-size: 1.15em; }
  .md-content :global(h3) { font-size: 1.05em; }
  .md-content :global(h4) { font-size: 1em; }
  .md-content :global(h1:first-child),
  .md-content :global(h2:first-child),
  .md-content :global(h3:first-child) {
    margin-top: 0;
  }

  /* ── Paragraphs ── */
  .md-content :global(p) {
    margin: 6px 0;
  }
  .md-content :global(p:first-child) {
    margin-top: 0;
  }
  .md-content :global(p:last-child) {
    margin-bottom: 0;
  }

  /* ── Lists ── */
  .md-content :global(ul),
  .md-content :global(ol) {
    margin: 6px 0;
    padding-left: 20px;
  }
  .md-content :global(li) {
    margin: 2px 0;
  }
  .md-content :global(li > p) {
    margin: 2px 0;
  }

  /* ── Inline code ── */
  .md-content :global(.md-inline-code) {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 1px 5px;
    font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 0.9em;
    color: var(--color-accent);
    word-break: break-all;
  }

  /* ── Code blocks ── */
  .md-content :global(.md-code-block) {
    margin: 8px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.3);
  }

  .md-content :global(.md-code-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .md-content :global(.md-code-lang) {
    font-size: 11px;
    color: var(--color-muted);
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    text-transform: lowercase;
  }

  .md-content :global(.md-copy-btn) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--color-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.15s;
    font-family: inherit;
  }

  .md-content :global(.md-copy-btn:hover) {
    color: var(--color-fg);
    background: rgba(255, 255, 255, 0.08);
  }

  .md-content :global(.md-copy-btn.copied) {
    color: #a6e3a1;
  }

  .md-content :global(pre) {
    margin: 0;
    padding: 10px 12px;
    overflow-x: auto;
  }

  .md-content :global(pre code) {
    font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-fg);
    background: transparent;
    border: none;
    padding: 0;
  }

  /* ── Blockquotes ── */
  .md-content :global(blockquote) {
    margin: 8px 0;
    padding: 4px 12px;
    border-left: 3px solid var(--color-accent);
    background: rgba(255, 255, 255, 0.03);
    border-radius: 0 4px 4px 0;
    color: var(--color-muted);
  }
  .md-content :global(blockquote p) {
    margin: 4px 0;
  }

  /* ── Tables ── */
  .md-content :global(.md-table-wrap) {
    overflow-x: auto;
    margin: 8px 0;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    max-width: 100%;
  }
  .md-content :global(.md-table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .md-content :global(.md-table th) {
    text-align: left;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-weight: 600;
    color: var(--color-fg);
  }
  .md-content :global(.md-table td) {
    padding: 5px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    color: var(--color-fg);
  }
  .md-content :global(.md-table tr:last-child td) {
    border-bottom: none;
  }

  /* ── Links ── */
  .md-content :global(.md-link) {
    color: var(--color-accent);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.15s;
    word-break: break-all;
  }
  .md-content :global(.md-link:hover) {
    border-bottom-color: var(--color-accent);
  }

  /* ── Horizontal rule ── */
  .md-content :global(hr) {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin: 12px 0;
  }

  /* ── Bold, italic, strikethrough ── */
  .md-content :global(strong) {
    font-weight: 600;
    color: var(--color-fg);
  }
  .md-content :global(em) {
    font-style: italic;
  }
  .md-content :global(del) {
    text-decoration: line-through;
    opacity: 0.6;
  }

  /* ── Images ── */
  .md-content :global(img) {
    max-width: 100%;
    border-radius: 6px;
    margin: 6px 0;
  }

  /* ── Streaming cursor ── */
  .md-content.streaming :global(p:last-child::after),
  .md-content.streaming :global(li:last-child::after),
  .md-content.streaming :global(code:last-child::after) {
    content: '▊';
    animation: blink 1s step-end infinite;
    color: var(--color-accent);
    margin-left: 1px;
  }

  @keyframes blink {
    50% { opacity: 0; }
  }
</style>
