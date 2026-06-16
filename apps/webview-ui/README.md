# Hermes IDE — Webview UI

Chat interface for the Hermes IDE extension, rendered as a VS Code webview panel.

## Tech Stack

- **Framework:** Svelte
- **Build:** Vite
- **Language:** TypeScript

## Overview

This app builds the chat UI that runs inside the VS Code extension's sidebar webview. It communicates with the extension host via the VS Code Webview API (`postMessage` / `onMessage`).

### Features

- Chat message input with send/clear controls
- Streaming AI response rendering
- Markdown formatting support
- Diff proposal notifications
- Theme-aware (inherits VS Code color theme)

## Development

```bash
# Dev server with HMR (standalone, outside VS Code)
bun run dev

# Build for production (output: dist/)
bun run build

# Preview production build
bun run preview
```

## Build Output

The `dist/` folder is copied into the extension package at `apps/extension/webview-dist/` during the monorepo build step:

```bash
# From project root
bun run build:webview   # Build this app
bun run build:copy      # Copy dist/ → extension/webview-dist/
```

## Communication Protocol

The webview exchanges messages with the extension host using `vscode.postMessage()`:

```typescript
// Webview → Extension
vscode.postMessage({ type: 'chat', message: 'Hello' });
vscode.postMessage({ type: 'resolve-diff', accepted: true });

// Extension → Webview
window.addEventListener('message', (event) => {
  const { type, content } = event.data;
  // type: 'response', 'stream', 'diff-proposal', 'error'
});
```
