<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { listProfiles, addProfile, updateProfilePassword, removeProfile, deploy, type ProfileInfo } from './api';

  export let adminName: string;
  export let adminPassword: string;

  const dispatch = createEventDispatcher();

  let profiles: ProfileInfo[] = [];
  let loading = false;
  let deployLoading = false;
  let message = "";
  let messageType: "success" | "error" = "success";

  // Add profile form
  let newName = "";
  let newPassword = "";
  let newRole = "developer";

  // Edit password modal
  let editingProfile: string | null = null;
  let editPassword = "";

  // Delete confirm
  let deletingProfile: string | null = null;

  onMount(() => fetchProfiles());

  async function fetchProfiles() {
    loading = true;
    try {
      const data = await listProfiles(adminName, adminPassword);
      profiles = data.profiles || [];
    } catch (e) {
      showMessage("Gagal memuat profil", "error");
    } finally {
      loading = false;
    }
  }

  async function handleAdd() {
    if (!newName || !newPassword) {
      showMessage("Nama dan password wajib diisi", "error");
      return;
    }
    try {
      const result = await addProfile(adminName, adminPassword, newName, newPassword, newRole);
      if (result.success) {
        showMessage(`Profil '${newName}' berhasil ditambahkan`, "success");
        newName = "";
        newPassword = "";
        newRole = "developer";
        await fetchProfiles();
      } else {
        showMessage(result.error || "Gagal menambah profil", "error");
      }
    } catch (e) {
      showMessage("Gagal menambah profil", "error");
    }
  }

  async function handleUpdatePassword() {
    if (!editingProfile || !editPassword) return;
    try {
      const result = await updateProfilePassword(adminName, adminPassword, editingProfile, editPassword);
      if (result.success) {
        showMessage(`Password '${editingProfile}' berhasil diubah`, "success");
        editingProfile = null;
        editPassword = "";
      } else {
        showMessage(result.error || "Gagal mengubah password", "error");
      }
    } catch (e) {
      showMessage("Gagal mengubah password", "error");
    }
  }

  async function handleDelete() {
    if (!deletingProfile) return;
    try {
      const result = await removeProfile(adminName, adminPassword, deletingProfile);
      if (result.success) {
        showMessage(`Profil '${deletingProfile}' berhasil dihapus`, "success");
        deletingProfile = null;
        await fetchProfiles();
      } else {
        showMessage(result.error || "Gagal menghapus profil", "error");
      }
    } catch (e) {
      showMessage("Gagal menghapus profil", "error");
    }
  }

  async function handleDeploy() {
    deployLoading = true;
    try {
      const result = await deploy(adminName, adminPassword);
      if (result.success) {
        showMessage("Docker Compose di-generate & container di-restart ✅", "success");
      } else {
        showMessage(result.message || "Deploy gagal", "error");
      }
    } catch (e) {
      showMessage("Deploy gagal", "error");
    } finally {
      deployLoading = false;
    }
  }

  function showMessage(msg: string, type: "success" | "error") {
    message = msg;
    messageType = type;
    setTimeout(() => { message = ""; }, 5000);
  }

  function openIDE(port: number) {
    const host = window.location.hostname;
    window.open(`http://${host}:${port}/`, "_blank");
  }
</script>

<main class="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black p-6">
  <div class="max-w-5xl mx-auto">
    
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
          Hermes IDE — Admin Dashboard
        </h1>
        <p class="text-sm text-zinc-400 mt-1">Logged in as <span class="text-blue-400 font-semibold">{adminName}</span></p>
      </div>
      <button
        on:click={() => dispatch('logout')}
        class="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg transition-all"
      >
        Logout
      </button>
    </div>

    <!-- Message banner -->
    {#if message}
      <div class="mb-6 p-3 rounded-lg text-sm text-center {messageType === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}">
        {message}
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Profile List -->
      <div class="lg:col-span-2">
        <div class="bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 rounded-2xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-zinc-200">Workspace Profiles</h2>
            <span class="text-xs text-zinc-500">{profiles.length} profil</span>
          </div>

          {#if loading}
            <div class="text-center text-zinc-500 py-8">Loading...</div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-zinc-400 border-b border-zinc-800">
                    <th class="text-left py-3 px-2">Profil</th>
                    <th class="text-left py-3 px-2">Role</th>
                    <th class="text-left py-3 px-2">Port</th>
                    <th class="text-right py-3 px-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {#each profiles as profile}
                    <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td class="py-3 px-2 font-medium text-zinc-200">{profile.name}</td>
                      <td class="py-3 px-2">
                        <span class="px-2 py-1 rounded-full text-xs {profile.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-700/50 text-zinc-400'}">
                          {profile.role}
                        </span>
                      </td>
                      <td class="py-3 px-2 text-zinc-400 font-mono">{profile.port}</td>
                      <td class="py-3 px-2 text-right">
                        <div class="flex items-center justify-end gap-2">
                          <button
                            on:click={() => openIDE(profile.port)}
                            class="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 rounded transition-all"
                            title="Buka IDE"
                          >
                            Open
                          </button>
                          <button
                            on:click={() => { editingProfile = profile.name; editPassword = ""; }}
                            class="px-2 py-1 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/50 rounded transition-all"
                            title="Ubah password"
                          >
                            Password
                          </button>
                          {#if profile.name !== "default"}
                            <button
                              on:click={() => { deletingProfile = profile.name; }}
                              class="px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 rounded transition-all"
                              title="Hapus profil"
                            >
                              Delete
                            </button>
                          {/if}
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}

          <!-- Deploy button -->
          <div class="mt-6 pt-4 border-t border-zinc-800">
            <button
              on:click={handleDeploy}
              disabled={deployLoading}
              class="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if deployLoading}
                <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Deploying...
              {:else}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Sync & Deploy
              {/if}
            </button>
            <p class="text-xs text-zinc-600 mt-2 text-center">Generate docker-compose.yml & restart semua container</p>
          </div>
        </div>
      </div>

      <!-- Add Profile -->
      <div>
        <div class="bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 rounded-2xl p-6">
          <h2 class="text-lg font-bold text-zinc-200 mb-4">Tambah Profil</h2>
          
          <div class="space-y-4">
            <div>
              <label for="newName" class="block text-sm text-zinc-400 mb-1">Nama Profil</label>
              <input
                id="newName"
                type="text"
                bind:value={newName}
                placeholder="contoh: developer01"
                class="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label for="newPass" class="block text-sm text-zinc-400 mb-1">Password</label>
              <input
                id="newPass"
                type="text"
                bind:value={newPassword}
                placeholder="password workspace"
                class="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label for="newRole" class="block text-sm text-zinc-400 mb-1">Role</label>
              <select
                id="newRole"
                bind:value={newRole}
                class="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="developer">Developer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              on:click={handleAdd}
              class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-all text-sm"
            >
              + Tambah Profil
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Password Modal -->
    {#if editingProfile}
      <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div class="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm">
          <h3 class="text-lg font-bold text-zinc-200 mb-4">Ubah Password: {editingProfile}</h3>
          <input
            type="text"
            bind:value={editPassword}
            placeholder="Password baru"
            class="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <div class="flex gap-3">
            <button
              on:click={handleUpdatePassword}
              class="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-sm transition-all"
            >
              Simpan
            </button>
            <button
              on:click={() => { editingProfile = null; }}
              class="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium rounded-lg text-sm transition-all"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Delete Confirm Modal -->
    {#if deletingProfile}
      <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div class="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm">
          <h3 class="text-lg font-bold text-red-400 mb-2">Hapus Profil</h3>
          <p class="text-sm text-zinc-400 mb-4">Yakin ingin menghapus profil <span class="text-zinc-200 font-semibold">{deletingProfile}</span>? Container & workspace-nya akan ikut dihapus saat deploy.</p>
          <div class="flex gap-3">
            <button
              on:click={handleDelete}
              class="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-sm transition-all"
            >
              Hapus
            </button>
            <button
              on:click={() => { deletingProfile = null; }}
              class="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium rounded-lg text-sm transition-all"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Footer -->
    <div class="mt-8 text-center">
      <p class="text-xs text-zinc-600">Hermes IDE Extension · Nusawork · Auth Portal v1.0</p>
    </div>
  </div>
</main>
