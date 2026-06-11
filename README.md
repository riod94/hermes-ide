# Hermes Agentic Browser IDE

Browser IDE berbasis code-server (OpenVSCode Server) yang terintegrasi penuh dengan Hermes AI Agent. Membawa pengalaman "Vibe Coding" setara IDE modern dengan menggabungkan keunggulan Antigravity, Windsurf, Trae, dan Qoder.

## 📁 Struktur Monorepo (Bun Workspaces)

Proyek ini dipisahkan menjadi beberapa workspace untuk menjaga modularitas:

- `/apps/auth-portal/` : Vue 3 App (Portal login mandiri).
- `/apps/code-server-infra/` : Docker, Traefik proxy, dan Container config.
- `/extension/` : Logic Ekstensi (Node/TS API) & direktori `webview-ui/` yang berisi Vue 3 App khusus sidebar IDE.

## 🚀 Tech Stack

- **Runtime & Build**: Bun + Vite
- **UI Framework (Webview & Auth Portal)**: Svelte + Tailwind CSS + VS Code Webview UI Toolkit
- **Infrastructure**: OpenVSCode Server, Docker/LXC, Traefik Reverse Proxy

## 📚 Dokumentasi

Baca selengkapnya di [PRD.md](./PRD.md).
