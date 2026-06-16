# Hermes IDE

> Agentic Browser IDE extension for Hermes AI

AI-powered coding assistant that runs inside your browser-based VS Code. Chat with Hermes AI, review code diffs, and accept/reject proposed changes — all without leaving the editor.

## Features

### 💬 AI Chat
- Chat with Hermes AI directly from the sidebar
- Streaming responses with markdown rendering
- Context-aware conversations about your codebase

### 📝 Diff Review
- Visual diff viewer for AI-proposed code changes
- Accept or reject changes with one click
- Automatic file creation for new files
- Path-aware: works seamlessly inside containerized code-server

### ⚡ MCP Integration
- Connects to Hermes MCP Service via REST API + SSE
- Real-time notifications for pending diff proposals
- Automatic reconnection on connection loss

## Commands

| Command | Description |
|---------|-------------|
| `Hermes: Focus Chat` | Open and focus the Hermes chat sidebar |
| `Hermes: Resolve Diff` | Accept or reject a pending diff proposal |
| `Hermes: Show Diff Controls` | Show diff control buttons for the active diff |

## How It Works

```
Hermes Agent ──MCP──▶ MCP Service ──REST/SSE──▶ Extension ──Webview──▶ Chat UI
                                                    │
                                                    ├── Diff proposals → VS Code Diff Editor
                                                    └── Accept/Reject → back to MCP Service
```

1. Hermes Agent sends code proposals via MCP protocol to the MCP Service
2. MCP Service stores pending diffs and notifies the extension via SSE
3. Extension opens a VS Code diff editor showing proposed changes
4. Developer reviews and accepts/rejects
5. Decision is sent back to MCP Service → Hermes Agent

## Requirements

- code-server (browser-based VS Code)
- Hermes MCP Service running and accessible
- `HERMES_API_URL` environment variable set to MCP Service endpoint

## Version

Current: **0.6.0**

---

Built by the [Nusawork](https://nusawork.com) team.
