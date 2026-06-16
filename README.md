# Hermes IDE Extension

Agentic Browser IDE platform for [Hermes AI](https://hermes-agent.nousresearch.com/) — provides AI-powered coding assistance directly inside browser-based VS Code (code-server).

## Architecture

Monorepo with 5 apps, managed as Bun workspaces:

```
hermes-ide-extension/
├── apps/
│   ├── extension/        # VS Code extension (Chat + Diff Review UI)
│   ├── webview-ui/        # Svelte chat interface (rendered inside extension)
│   ├── mcp-service/       # Standalone MCP server (systemd + Nginx)
│   ├── auth-portal/       # Admin portal (auth, deploy pipeline, profile management)
│   └── code-server-infra/ # Docker Compose + config for multi-profile code-server
```

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Hermes Agent (Host)                                    │
│    ↕ MCP Protocol (Streamable HTTP)                     │
├─────────────────────────────────────────────────────────┤
│  MCP Service (systemd)        ← Nginx reverse proxy     │
│    ↕ REST API + SSE                                     │
├─────────────────────────────────────────────────────────┤
│  VS Code Extension (inside code-server container)       │
│    ↕ Webview messages                                   │
│  Webview UI (Svelte)          ← Chat interface          │
├─────────────────────────────────────────────────────────┤
│  Auth Portal (Bun server)     ← Admin + Deploy pipeline │
│    ↕ Docker API                                         │
│  code-server containers (1 per developer profile)       │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Extension:** VS Code Extension API + esbuild
- **Webview:** Svelte + Vite + TypeScript
- **MCP Service:** Hono + MCP SDK (@modelcontextprotocol/sdk)
- **Auth Portal:** Svelte (frontend) + Bun (backend server)
- **Infrastructure:** Docker (LinuxServer code-server), systemd, Nginx

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- Docker & Docker Compose
- Node.js >= 18 (for `vsce` packaging)
- Nginx (reverse proxy for MCP Service + code-server)

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Build extension

```bash
# Build webview → copy to extension → compile extension
bun run build

# Package as .vsix
bun run package
```

### 3. Build MCP Service

```bash
cd apps/mcp-service
bun run build
```

### 4. Deploy (via Auth Portal)

The Auth Portal provides a one-click deploy pipeline that handles:

1. Generate Docker Compose from template
2. Start/restart all containers
3. Build & install extension VSIX into containers
4. Generate MCP env files per profile
5. Inject VS Code settings (file exclusions, search scope)
6. Inject MCP config into Hermes profiles
7. Start/restart MCP Service (systemd)
8. Start/restart Nginx proxy

See [Auth Portal README](apps/auth-portal/README.md) for details.

## Development

```bash
# Dev webview with HMR
bun run dev:webview

# Watch extension compilation
cd apps/extension && bun run watch

# Dev MCP service
cd apps/mcp-service && bun run dev
```

## Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `HERMES_API_URL` | Extension | MCP Service endpoint URL |
| `DEFAULT_WORKSPACE` | Extension | Container workspace root (default: `/projects`) |
| `HOST_PROJECTS_BASE` | Extension | Host-side project path base for path translation |

## License

Internal — Nusawork Team
