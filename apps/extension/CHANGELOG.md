# Changelog

All notable changes to the Hermes IDE extension will be documented in this file.

## [0.9.9] — 2026-06-25

### Added
- **SSH Keys sharing** — Volume mount host `~/.ssh` to all containers (fixes `git pull` failing in terminal)
- `GIT_SSH_COMMAND` env for auto-accept new host keys

### Fixed
- **Chat overflow** — Long URLs, code blocks, and tables no longer extend beyond chat bubble width
  - `overflow-x: hidden` on messages container
  - `max-width: 100%` + `min-width: 0` + `overflow-wrap: anywhere` on all content
  - Full-width assistant bubble (`max-w-full`) vs constrained user bubble (`max-w-[85%]`)

## [0.9.8] — 2026-06-19

### Added
- **Settings Panel** — Persistent user preferences via `globalState`
  - Chat: font size (12-20px), send-on-enter, auto-scroll, timestamps, compact mode
  - Context: default rule files (multi-select), custom instructions (1000 char)
  - Model: default model selector
  - Gear icon toggle in ChatHeader
- **Custom instructions** — Auto-injected to context before every AI message
- **Rule file scanning** — Finds `.cursorrules`, `AGENTS.md`, `.github/copilot-instructions.md` etc.

### Changed
- `_handleChatMessage()` auto-injects default rules + custom instructions into context string

## [0.9.7] — 2026-06-19

### Added
- **Streaming UX Polish**
  - Typing indicator (bouncing dots animation)
  - Streaming cursor (▌) at end of live response
  - Stop generation button (AbortController via SSE)
  - Smart auto-scroll (follows content unless user scrolled up manually)

## [0.9.6] — 2026-06-19

### Added
- **Slash Commands** (`/` palette)
  - Dynamically loads ALL skills from Hermes API `/v1/skills` (93+)
  - Grouped by category with emoji icons
  - Built-in: `/new-skill`, `/expert`
  - Searchable by name, description, and category
- **Auth Redirect Flow Fix**
  - Developer login uses `/api/open-ide` proxy (not direct port, fixes HTTPS)
  - Nginx `location = /login` intercepts code-server login page, redirects to auth portal

## [0.9.5] — 2026-06-18

### Fixed
- MCP Service multi-session transport (single-session bug blocking concurrent clients)

## [0.9.4] — 2026-06-18

### Added
- **Drag & Drop files** onto chat input (visual overlay during drag)
- **Clipboard paste image** (Ctrl+V pastes screenshots as image attachments)
- **Image thumbnail** in attachment chips (22×22 preview instead of emoji)

## [0.9.3] — 2026-06-18

### Added
- **Rich Text Input** — `contenteditable` div replacing `<textarea>`
  - Inline selection chips (✂️) mixed with regular text
  - Atomic chip elements with remove button
  - Paste strips rich formatting to plain text
  - Proper extraction of text + chips on send
- **Add Selection to Chat** (Ctrl+Shift+L / Cmd+Shift+L)
  - Multi-cursor editor support with line:col ranges
  - Terminal selection capture via clipboard
  - Context menu entries in editor and terminal

## [0.9.2] — 2026-06-18

### Added
- Keyboard shortcut Ctrl+Shift+L to add selection as attachment chip

## [0.9.1] — 2026-06-18

### Fixed
- `vscode.diff` fails on new files (virtual URI fallback for non-existent files)
- MCP port conflict during systemd → Docker migration

## [0.9.0] — 2026-06-18

### Added
- **Phase 5: Checkpoints & Code Review UI**
  - MarkdownRenderer with `marked` + DOMPurify (XSS-safe)
  - Code blocks with language label + copy button
  - Tables with horizontal scroll
  - CheckpointCard — structured approval UI with progress bar, checklist items
  - ToolUseCard — collapsible tool-use progress indicators
  - Content parser splits assistant response into 3 segment types (markdown, checkpoint, tool-use)

### Changed
- ChatBubble now renders structured segments instead of raw markdown

## [0.8.0–0.8.7] — 2026-06-18

### Added
- **Phase 4A: Session Management** (v0.7.0 → merged as v0.8.0)
  - Persistent session storage via `globalState` (max 50, auto-prune)
  - Auto-save, auto-title, auto-restore
  - Session history panel (slide-in overlay, search, delete, rename)
- **Model Switcher** (Phase 4B) — real-time model dropdown in input toolbar
- **Rich Input Mentions** (`@`) (Phase 4C) — file, folder, terminal, rules, URL
- **@url Mention** (Phase 4D) — server-side fetch + CSP-safe content injection
- **Attachment Button [+]** (Phase 4E) — file upload from local/workspace, multimodal support
- Lucide SVG icons (replaced emoji) for interactive controls

### Changed
- Unsend/Edit restores attachment chips (not just text)

## [0.6.0] — 2026-06-16

### Added
- **MCP Diff Interception** — Review AI-proposed code changes via VS Code diff editor
  - Accept/Reject buttons for each diff proposal
  - Automatic file creation for new files
  - Path mapping for containerized environments (host ↔ container)
- **MCP Bridge** — HTTP client connecting to standalone MCP Service (replaces embedded MCP server)
- **SSE real-time notifications** — Instant diff proposal alerts from MCP Service
- **Deploy pipeline** — One-click deploy via Auth Portal (8 automated steps)
  - Auto-build VSIX on host
  - Install extension via `docker cp` (no volume mount needed)
  - MCP config injection into Hermes profiles
  - VS Code settings injection (file/search exclusions)

### Changed
- Extension architecture: lightweight UI-only (Chat + Diff Viewer), MCP logic moved to standalone service
- Container UID/GID aligned with host user for proper file permissions

### Removed
- Embedded MCP server (`mcpServer.ts`, `mcpStandalone.ts`)
- Volume mount `/hermes-extension:ro` (replaced by `docker cp` install)

## [0.5.0] — 2026-06-15

### Added
- **Chat UI** — Svelte-based chat interface in sidebar
  - Streaming AI responses with markdown rendering
  - Tool-use progress indicators
  - Typing indicator animation
  - Welcome screen with quick actions
- **Diff Alert component** — Notification banner for pending diff proposals
- **Hermes API Gateway connection** — REST/SSE integration for chat

## [0.4.0] — 2026-06-14

### Added
- **Auth Portal** — Fullstack login + admin dashboard
  - Profile management (CRUD)
  - Auto port allocation (alphabetical)
  - Docker Compose generation
  - Role-based access (admin/developer)
- **Code-server infrastructure** — Multi-profile Docker setup
  - Per-developer isolated containers
  - Nginx reverse proxy with wildcard SSL

## [0.3.0] — 2026-06-13

### Added
- VS Code extension boilerplate with Svelte webview
- ChatViewProvider for sidebar webview hosting
- Basic extension activation and command registration
