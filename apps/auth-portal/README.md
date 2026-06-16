# Hermes IDE — Auth Portal

Admin portal for managing multi-profile code-server infrastructure. Handles authentication, profile management, and automated deployment pipeline.

## Overview

The Auth Portal serves two purposes:

1. **Authentication Gateway** — Login portal for code-server instances (each developer gets their own containerized VS Code)
2. **Admin Dashboard** — Deploy pipeline, profile management, and infrastructure controls

## Tech Stack

- **Frontend:** Svelte + Vite + TypeScript
- **Backend:** Bun HTTP server (port 51000)
- **Deployment:** systemd (`hermes-auth-portal.service`)

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth` | Authenticate user, set session cookie |
| GET | `/api/profiles` | List all developer profiles |
| GET | `/api/profile-names` | Get profile name list |
| POST | `/api/deploy` | Run full deploy pipeline |
| POST | `/api/open-ide` | Open/redirect to profile's code-server |
| POST | `/api/chat` | Proxy chat to Hermes |

## Deploy Pipeline

The `/api/deploy` endpoint runs an 8-step automated pipeline:

| Step | Name | Description |
|------|------|-------------|
| 1 | `docker_compose` | Generate `docker-compose.yml` from template |
| 2 | `containers` | Start/restart all code-server containers |
| 3 | `build_vsix` | Build extension `.vsix` on host |
| 4 | `extension` | Install extension into all containers via `docker cp` |
| 5 | `mcp_env` | Generate MCP `.env` files per profile |
| 6 | `settings` | Inject VS Code settings (file exclusions, search scope) |
| 6b | `mcp_config` | Inject MCP server config into Hermes profiles |
| 7 | `mcp_service` | Restart MCP Service (systemd) |
| 8 | `nginx` | Reload Nginx reverse proxy config |

## Development

```bash
# Dev mode (frontend + backend)
bun run dev

# Build frontend
bun run build

# Start production server
bun run start

# Or just the backend
bun run server
```

## Configuration

The portal reads infrastructure config from `../code-server-infra/` and manages:

- Docker Compose generation (`docker.ts`)
- Container lifecycle (start, stop, restart)
- Extension installation (`docker cp` based)
- MCP environment files
- VS Code settings injection
- Systemd service management (MCP Service, Nginx)

## Authentication

Cross-subdomain cookie authentication on `*.app.dev.nusa.work`. The portal sets a session cookie with `Domain=.app.dev.nusa.work` so all code-server subdomains share the auth state.
