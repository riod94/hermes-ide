# Hermes IDE

**Agentic Browser IDE Extension for Hermes AI** — Chat with AI, review code diffs, and accept/reject proposed changes directly in your editor.

Built for **code-server** environments running inside Docker containers, Hermes IDE transforms your browser-based IDE into an AI-powered development workspace with persistent sessions, rich context injection, and real-time code change proposals.

---

## ✨ Features

### 🤖 AI Chat
- **Streaming responses** with markdown rendering (headings, code blocks, tables, lists, blockquotes)
- **Syntax-highlighted code blocks** with one-click copy
- **Tool-use progress indicators** — collapsible cards showing which tools the AI is using
- **Typing indicator** with bouncing dots animation
- **Stop generation** button to cancel mid-stream responses
- **Smart auto-scroll** — follows new content unless you scroll up
- **Retry on error** — one-click retry for failed requests

### 📝 Session Management
- **Persistent sessions** stored in VS Code globalState (survives container restarts)
- **Session history panel** — slide-in overlay with search, relative timestamps, delete
- **Auto-title** from first user message
- **Conversation context preservation** across session switches
- Max 50 sessions with auto-prune of oldest

### 🔧 Rich Context Injection
- **`@file`** — include single file content as context
- **`@folder`** — include directory listing
- **`@terminal`** — capture terminal output via clipboard
- **`@rules`** — inject project rule files (`.cursorrules`, `AGENTS.md`, etc.)
- **`@url`** — fetch and inject web page content (server-side, CSP-safe)
- **`[+]` Attachment button** — upload files from local machine or workspace
  - Drag & drop files onto chat input
  - Clipboard paste images (Ctrl+V)
  - Image thumbnails in attachment chips
  - Multi-file support (up to 5 files, 2MB each)
- **Add Selection to Chat** (Ctrl+Shift+L) — send editor/terminal selection as inline chip

### 💡 Slash Commands
- **`/` command palette** — loads all available Hermes skills dynamically from API
- Skills grouped by category with search
- Built-in commands: `/new-skill`, `/expert`

### ⚙️ Settings Panel
- Persistent user preferences via `globalState`
- **Chat**: font size, send-on-enter, auto-scroll, timestamps, compact mode
- **Context**: default rule files, custom instructions (auto-injected to every message)
- **Model**: default model selector

### 🔄 Model & Provider Switcher
- Real-time model dropdown in input toolbar
- Models fetched from 9router API, grouped by provider
- Per-request model override

### 📋 Checkpoints & Code Review
- **Checkpoint detection** — structured approval UI when AI proposes a plan
- **Approve / Revise** buttons with progress tracking
- **Diff proposals** via MCP `ide_propose_diff` tool — review changes in VS Code diff editor
- Accept/Reject individual proposals
- New file creation support

### 🔐 Auth & Multi-Profile
- Auth Portal with role-based access (admin / developer)
- Per-developer isolated Docker containers
- Session-based authentication with Nginx reverse proxy
- Automatic workspace provisioning

---

## 🏗 Architecture

```
┌──────────────────────────────────┐
│  Browser (code-server)           │
│  ┌────────────────────────────┐  │
│  │ Extension (UI only)        │──┼──→ Hermes API (chat SSE)
│  │ - Chat + Diff Viewer       │  │
│  │ - McpBridge.ts (HTTP)      │──┼──→ MCP Service (localhost)
│  │ - SessionManager.ts        │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│  Systemd Service (Bun)           │
│  MCP Service (apps/mcp-service/) │
│  - ide_propose_diff tool         │
│  - Always running (24/7)         │
│  - 127.0.0.1:56xxx               │
└──────────────────────────────────┘
```

**Hybrid Architecture**: Extension runs inside code-server (Node.js Extension Host), while MCP Service runs as a standalone Bun systemd service on the host. This ensures MCP availability regardless of browser sessions.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension Host | TypeScript, VS Code API |
| Frontend | Svelte 5, TailwindCSS v4, Vite |
| MCP Service | Bun, Hono, MCP SDK |
| Build | esbuild (extension + MCP), Vite (webview) |
| Packaging | `@vscode/vsce` |
| Infrastructure | Docker (LSIO code-server), Nginx, systemd |

---

## 📂 Project Structure

```
hermes-ide-extension/
├── apps/
│   ├── extension/            ← VS Code Extension (backend)
│   │   ├── src/
│   │   │   ├── extension.ts         ← Activation, commands
│   │   │   ├── ChatViewProvider.ts  ← Webview bridge
│   │   │   ├── HermesClient.ts      ← Hermes API client (SSE)
│   │   │   ├── SessionManager.ts    ← Persistent sessions
│   │   │   ├── McpBridge.ts         ← MCP Service HTTP client
│   │   │   └── pathMapper.ts        ← Host↔container paths
│   │   └── dist/                    ← esbuild output
│   ├── webview-ui/           ← Svelte + Vite frontend
│   │   ├── src/components/          ← ChatBubble, ChatInput, etc.
│   │   └── src/lib/                 ← Store, types, VS Code bridge
│   ├── mcp-service/          ← Standalone MCP Server (Bun + Hono)
│   ├── auth-portal/          ← Login + deploy API (Bun + Hono)
│   └── code-server-infra/    ← Docker compose, Nginx configs
├── PRD.md                    ← Product Requirements Document
└── CHANGELOG.md
```

---

## 🗺 Roadmap

### ✅ Completed (v0.3.0 — v0.9.9)

| Phase | Feature | Version |
|-------|---------|---------|
| 1–3 | Auth Portal, RBAC, Docker Infra, Extension Boilerplate | v0.3.0–v0.4.0 |
| 4A | Session Management | v0.7.0 |
| 4B | Model Switcher | v0.8.0 |
| 4C | Rich Input Mentions (`@`) | v0.8.1 |
| 4D | `@url` Mention | v0.8.1 |
| 4E | Attachment Button `[+]`, Drag & Drop, Paste Image | v0.8.4–v0.8.7 |
| 5 | Markdown Rendering, Checkpoints, Tool-Use Cards | v0.9.0 |
| 6 | MCP Service & Diff Interception | v0.6.0–v0.9.0 |
| — | Add Selection to Chat (Ctrl+Shift+L) | v0.9.3 |
| — | Rich Text Input (contenteditable + inline chips) | v0.9.3 |
| — | Streaming UX Polish (cursor, stop button, auto-scroll) | v0.9.7 |
| — | Settings Panel | v0.9.8 |
| — | Slash Commands | v0.9.6 |
| — | Auth Redirect Flow Fix | v0.9.6 |

### 🔜 Planned

| Phase | Feature | Priority |
|-------|---------|----------|
| 7 | Qoder Expert Mode — multi-agent orchestration tree view | Medium |
| 8 | E2E Testing (Playwright) & CI/CD | Low |

---

## 📄 License

UNLICENSED — Internal Nusawork project.
