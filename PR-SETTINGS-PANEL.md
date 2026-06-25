## 🎯 Deskripsi

Menambahkan fitur **Settings Panel (v0.9.8)** ke Hermes IDE Extension untuk memberikan kontrol kepada user terhadap preferensi UI dan injeksi konteks.

### 🌟 Fitur Utama
- **UI Preferences**: Pengaturan font size, toggle send on enter, toggle auto-scroll, timestamp messages, dan compact mode.
- **Context Injection**: 
  - **Default Rules**: Auto-scan file guidelines di workspace (seperti `.cursorrules`, `AGENTS.md`, `CLAUDE.md`, `.eslintrc`) yang bisa dipilih untuk selalu di-attach secara otomatis ke payload chat.
  - **Custom Instructions**: Textarea untuk menambah prompt instruksi persisten (max 1000 karakter).
- **Default Model Setting**: Memilih model default secara global untuk sesi `New Chat` yang akan datang (terpisah logic-nya dengan model override per session).
- **Indikator Rules Badge (`📏 N`)**: Badge visual di sebelah model selector pada input chat agar user sadar ada hidden rules yang terkirim.
- **State Persistence**: Pengaturan disimpan menggunakan `globalState` dari extension host agar selamat dari webview reload/restart.

### 🔄 Perbaikan Minor
- Fix isu decoupling state `activeModel` (temporary session) dengan `defaultModel` (global settings)
- Handle read/inject file ukuran besar dengan pemotongan `slice(0, 10240)` pada rules context

### 📸 Tampilan
_(Silakan tambahkan screenshot panel settings di sini jika perlu)_

### 🛠️ Self-Review Checklist
- [x] Tidak ada debug statements tertinggal
- [x] Tidak ada TODO/FIXME
- [x] Build artifacts (dist/) di-update bersamaan dengan kode
- [x] Security: Tidak mengekspos variabel sensitif
- [x] Sinkronisasi `activeModel` vs `defaultModel` sudah tepat
