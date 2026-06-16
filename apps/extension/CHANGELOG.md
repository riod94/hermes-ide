# Changelog

All notable changes to the Hermes IDE extension will be documented in this file.

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
