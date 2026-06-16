# Implementation Plan: VS Code Extension as MCP Server

## 1. Analisis Masalah Saat Ini
Sistem sebelumnya menggunakan **Client-side SSE stream interception** via HTTP Proxy di `auth-portal` untuk mendeteksi `write_file` atau `patch`. Masalah dari pendekatan ini:
1. **Bypass oleh Terminal:** LLM menyadari dirinya berjalan di lingkungan terminal (via system prompt Hermes), sehingga seringkali mem-bypass tool `write_file` dan menggunakan `terminal` (menjalankan `echo`, `sed`, `cat`, atau `patch`) untuk mengubah file. Proxy tidak bisa mencegah perintah terminal ini karena output-nya di-stream sebagai raw text.
2. **Keterbatasan Proxy:** Meng-intercept stream JSON di proxy sangat rentan patah (broken JSON chunks) dan tidak bisa benar-benar *pause* eksekusi tool di core Hermes. Hermes menganggap tool sukses dipanggil, padahal UI webview sedang menunggu user klik "Approve".
3. **Out-of-Sync State:** Agent merasa file sudah ditulis, padahal perubahan tertahan di IDE. Ketika agent melanjutkan task (misal `npm run build`), build akan gagal karena file di disk belum benar-benar berubah.

## 2. Solusi Arsitektur Baru: IDE as an MCP Server
Mengikuti [HANDOVER NOTE], kita akan mengubah peran VS Code Extension dari sekadar "pasif pembaca stream" menjadi **MCP Server Aktif**. Ekstensi akan mendaftarkan tool khusus ke Hermes, dan mengeksekusinya secara lokal dengan `vscode.diff`.

### Alur Kerja (Windsurf UX)
1. VS Code Extension menjalankan server MCP lokal (stdio atau HTTP/SSE transport) menggunakan `@modelcontextprotocol/sdk`.
2. Server MCP ini mengekspos tool baru, misalnya `ide_propose_diff`.
3. Agent Hermes akan memanggil tool `ide_propose_diff` (berisi file path, original content, dan proposed content).
4. Pemanggilan tool akan ditangkap oleh Ekstensi (MCP Server).
5. Ekstensi membuka **Diff Editor tab** via `vscode.diff` dan menunggu *human input* (Accept/Reject).
6. Tool *hangs/awaits* sampai user menekan Accept/Reject.
7. Setelah user menekan Accept (file ditulis ke disk), server MCP mengembalikan `status: success` ke Hermes. Jika Reject, mengembalikan `status: rejected`.
8. Hermes menerima hasil tool dan melanjutkan reasoning-nya.

## 3. Langkah Implementasi (Milestones)

### Milestone 1: Setup MCP SDK di Ekstensi
- Install dependensi `@modelcontextprotocol/sdk` pada `apps/extension`.
- Buat class `HermesMCPServer` di `apps/extension/src/mcp/server.ts`.
- Konfigurasi transport: karena ekstensi berjalan di dalam *browser/webview* atau node context VS Code, pendekatan terbaik adalah **SSE transport** (HTTP server ringan di extension host) atau langsung integrasi via `native-mcp` (jika core Hermes berada di host yang sama). Karena arsitektur `code-server` di-dockerize, **stdio** lebih sulit di-route. Kita akan gunakan HTTP Server (Express/Fastify) sederhana di dalam *Extension Host*.

### Milestone 2: Expose Tool `ide_propose_diff`
Mendefinisikan tool pada MCP Server:
```json
{
  "name": "ide_propose_diff",
  "description": "Propose file changes to the human developer. Opens a Diff view in the IDE. Execution pauses until the human approves or rejects.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filepath": { "type": "string", "description": "Absolute path to the file" },
      "original_content": { "type": "string" },
      "new_content": { "type": "string" }
    },
    "required": ["filepath", "new_content"]
  }
}
```

### Milestone 3: Integrasi VS Code API (Diff Editor)
- Ketika tool `ide_propose_diff` dipanggil, Extension Host menggunakan `vscode.commands.executeCommand('vscode.diff', ...)` seperti yang sudah ada di `ChatViewProvider.ts`.
- Gunakan mekanisme `Promise` dengan *resolver* yang disimpan di memori.
- Munculkan tombol "Accept" atau "Reject" di WebView UI (atau CodeLens/Editor Title menu).
- Resolve `Promise` dan kembalikan result MCP berdasarkan klik user.

### Milestone 4: Registrasi MCP ke Profil Hermes
- Mengubah `apps/auth-portal/server/routes/deploy.ts` agar saat men-generate `docker-compose`, juga men-generate konfigurasi `~/.hermes/profiles/<nama>/config.yaml` untuk mengaktifkan MCP client Hermes mengarah ke port lokal *Extension Host* (misal: localhost:51600).
- Memastikan prompt Hermes (system prompt atau rules) di-update agar LLM diinstruksikan untuk **selalu menggunakan `ide_propose_diff`** saat mengedit kode, dan DILARANG keras menggunakan `terminal` (sed/patch/echo) untuk pengeditan file.

## 4. Keuntungan Pendekatan Ini
1. **True Pause Execution:** Agen benar-benar "menunggu" (*blocking*) hasil tool call dari MCP Server.
2. **Tidak Ada Out-of-Sync:** Agen baru tahu file berubah *setelah* user meng-klik "Approve".
3. **Resilient:** Tidak ada lagi stream proxy rentan patah di tengah jalan.
4. **Lebih Aman:** LLM dipaksa melewati gate MCP lokal IDE.

---
**Prepared by Sapri for Nusawork Team.**
