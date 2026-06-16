# Hermes IDE — MCP Service

Standalone MCP (Model Context Protocol) server for Hermes IDE. Runs as a systemd service on the host, independent of code-server containers.

## Overview

The MCP Service acts as the bridge between Hermes AI Agent and the VS Code extension running inside code-server. It receives code change proposals from the agent, stores them as pending diffs, and notifies the extension in real-time via SSE.

```
Hermes Agent ──▶ Hermes Gateway ──MCP──▶ MCP Service ──REST/SSE──▶ Extension
                                              │
                                              ├── Stores pending diffs
                                              ├── Notifies extension (SSE push)
                                              └── Resolves decisions back to agent
```

## Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **HTTP Framework:** [Hono](https://hono.dev/)
- **MCP SDK:** `@modelcontextprotocol/sdk` (Streamable HTTP transport)
- **Deployment:** systemd service per developer profile

## MCP Tool

### `ide_propose_diff`

Proposes file changes to the developer. Opens a Diff view in the IDE and pauses execution until the developer approves or rejects.

```json
{
  "name": "ide_propose_diff",
  "inputSchema": {
    "properties": {
      "filepath": { "type": "string", "description": "Absolute path to file" },
      "new_content": { "type": "string", "description": "Proposed new content" }
    },
    "required": ["filepath", "new_content"]
  }
}
```

**Flow:**
1. Agent calls `ide_propose_diff(filepath, new_content)`
2. MCP Service stores proposal, generates `diffId`
3. Extension receives SSE notification → opens VS Code diff editor
4. Developer clicks Accept or Reject
5. Decision sent back → MCP Service resolves → Agent continues

## HTTP Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/mcp` | MCP Streamable HTTP protocol (Hermes Gateway) |
| `GET` | `/mcp` | SSE stream (MCP protocol) |
| `DELETE` | `/mcp` | Close MCP session |
| `GET` | `/health` | Health check |
| `GET` | `/api/pending` | Extension polls for pending diff proposals |
| `POST` | `/api/resolve` | Extension sends Accept/Reject decision |
| `GET` | `/api/events` | SSE push stream to Extension |

## Port Scheme

Each developer profile gets its own MCP Service instance:

```
Port = code-server port + 5000
Example: rio (code-server :51007) → MCP Service 127.0.0.1:56007
```

MCP Services bind to `127.0.0.1` only. External access goes through Nginx:
`https://ide-{profile}.app.dev.nusa.work/mcp`

## Development

```bash
# Install dependencies
bun install

# Dev mode (hot reload)
bun run dev

# Build (esbuild → dist/)
bun run build

# Start production
bun run start
```

## Deployment

MCP Service is deployed as a systemd service per profile:

```bash
# Check service status
sudo systemctl status hermes-mcp-rio

# View logs
sudo journalctl -u hermes-mcp-rio -f

# Restart
sudo systemctl restart hermes-mcp-rio
```

The Auth Portal deploy pipeline handles systemd unit generation and service management automatically.

## Architecture Notes

### Why standalone (not embedded in Extension Host)?

| Problem (embedded) | Solution (standalone) |
|---|---|
| MCP server only starts when browser connects | Runs 24/7 via systemd, independent of browser |
| Extension install/update breaks MCP server | Update MCP Service without touching extension |
| Single-session transport, reconnect = errors | Multi-session with auto-cleanup (30 min idle) |
| Silent errors inside container | Debug via `journalctl`, restart via `systemctl` |

### Session Management

Each MCP client connection creates a new `Server + Transport` pair. Sessions are automatically cleaned up after 30 minutes of inactivity to prevent resource leaks.
