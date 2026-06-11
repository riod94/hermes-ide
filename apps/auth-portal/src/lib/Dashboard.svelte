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
  let showAddForm = false;
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
        showAddForm = false;
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

  function getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  // Color palette for profile avatars
  const avatarColors: Record<string, string> = {
    a: "from-rose-500 to-pink-600",
    b: "from-orange-500 to-amber-600",
    c: "from-amber-500 to-yellow-600",
    d: "from-emerald-500 to-green-600",
    e: "from-teal-500 to-cyan-600",
    f: "from-cyan-500 to-blue-600",
    g: "from-blue-500 to-indigo-600",
    h: "from-indigo-500 to-violet-600",
    i: "from-violet-500 to-purple-600",
    j: "from-purple-500 to-fuchsia-600",
    k: "from-fuchsia-500 to-pink-600",
    l: "from-rose-400 to-red-600",
    m: "from-sky-500 to-blue-600",
    n: "from-lime-500 to-green-600",
    o: "from-orange-400 to-red-500",
    p: "from-pink-500 to-rose-600",
    q: "from-teal-400 to-emerald-600",
    r: "from-blue-400 to-indigo-600",
    s: "from-violet-400 to-purple-600",
    t: "from-amber-400 to-orange-600",
    u: "from-cyan-400 to-teal-600",
    v: "from-indigo-400 to-blue-600",
    w: "from-green-400 to-emerald-600",
    x: "from-red-400 to-rose-600",
    y: "from-yellow-400 to-amber-600",
    z: "from-purple-400 to-violet-600",
  };

  function getAvatarColor(name: string): string {
    const firstChar = name.charAt(0).toLowerCase();
    return avatarColors[firstChar] || "from-zinc-500 to-zinc-600";
  }

  function getStatusDot(role: string): string {
    return role === "admin" ? "bg-blue-400" : "bg-emerald-400";
  }
</script>

<main class="min-h-screen w-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-zinc-950 to-black">
  
  <!-- Top Nav -->
  <nav class="border-b border-zinc-800/80 backdrop-blur-xl bg-zinc-950/60 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-white tracking-tight">Hermes IDE</h1>
          <p class="text-xs text-zinc-500">Admin Dashboard</p>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 rounded-full border border-zinc-700/50">
          <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span class="text-xs text-zinc-300 font-medium">{adminName}</span>
        </div>
        <button
          on:click={() => dispatch('logout')}
          class="px-3 py-1.5 text-xs text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
        >
          Logout
        </button>
      </div>
    </div>
  </nav>

  <div class="max-w-7xl mx-auto px-6 py-8">

    <!-- Message banner -->
    {#if message}
      <div class="mb-6 p-4 rounded-xl text-sm flex items-center gap-3 animate-in {messageType === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}">
        {#if messageType === 'success'}
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        {:else}
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        {/if}
        {message}
      </div>
    {/if}

    <!-- Stats Bar -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
        <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Profiles</p>
        <p class="text-2xl font-bold text-white">{profiles.length}</p>
      </div>
      <div class="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
        <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Admins</p>
        <p class="text-2xl font-bold text-blue-400">{profiles.filter(p => p.role === 'admin').length}</p>
      </div>
      <div class="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
        <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Developers</p>
        <p class="text-2xl font-bold text-emerald-400">{profiles.filter(p => p.role === 'developer').length}</p>
      </div>
      <div class="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
        <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Port Range</p>
        <p class="text-2xl font-bold text-amber-400 font-mono">51001-{51000 + profiles.length}</p>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-white">Workspaces</h2>
      <div class="flex items-center gap-3">
        <button
          on:click={() => { showAddForm = !showAddForm; }}
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add Profile
        </button>
        <button
          on:click={handleDeploy}
          disabled={deployLoading}
          class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if deployLoading}
            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Deploying...
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Sync & Deploy
          {/if}
        </button>
      </div>
    </div>

    <!-- Add Profile Form (Collapsible) -->
    {#if showAddForm}
      <div class="mb-6 bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-sm">
        <h3 class="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">New Profile</h3>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label for="newName" class="block text-xs text-zinc-500 mb-1.5">Profile Name</label>
            <input
              id="newName"
              type="text"
              bind:value={newName}
              placeholder="e.g. developer01"
              class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label for="newPass" class="block text-xs text-zinc-500 mb-1.5">Password</label>
            <input
              id="newPass"
              type="text"
              bind:value={newPassword}
              placeholder="workspace password"
              class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label for="newRole" class="block text-xs text-zinc-500 mb-1.5">Role</label>
            <select
              id="newRole"
              bind:value={newRole}
              class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all"
            >
              <option value="developer">Developer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="flex gap-2">
            <button
              on:click={handleAdd}
              class="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all text-sm"
            >
              Create
            </button>
            <button
              on:click={() => { showAddForm = false; }}
              class="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Profile Cards Grid -->
    {#if loading}
      <div class="text-center text-zinc-500 py-16">
        <svg class="animate-spin w-8 h-8 mx-auto mb-3 text-zinc-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        Loading profiles...
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {#each profiles as profile}
          <div class="group relative bg-zinc-900/70 hover:bg-zinc-900/90 border border-zinc-800/60 hover:border-zinc-700/80 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5">
            
            <!-- Top: Avatar + Info -->
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="relative">
                  <div class="w-11 h-11 rounded-xl bg-gradient-to-br {getAvatarColor(profile.name)} flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {getInitial(profile.name)}
                  </div>
                  <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full {getStatusDot(profile.role)} border-2 border-zinc-900"></div>
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-zinc-100">{profile.name}</h3>
                  <span class="text-xs {profile.role === 'admin' ? 'text-blue-400' : 'text-zinc-500'}">{profile.role}</span>
                </div>
              </div>

              <!-- Kebab menu -->
              <div class="relative">
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    on:click={() => { editingProfile = profile.name; editPassword = ""; }}
                    class="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition-all"
                    title="Ubah password"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  </button>
                  {#if profile.name !== "default"}
                    <button
                      on:click={() => { deletingProfile = profile.name; }}
                      class="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-all"
                      title="Hapus profil"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Port badge -->
            <div class="mb-4">
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/80 rounded-lg border border-zinc-700/40">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                <span class="text-xs font-mono text-zinc-400">Port {profile.port}</span>
              </div>
            </div>

            <!-- Open IDE Button -->
            <button
              on:click={() => openIDE(profile.port)}
              class="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600/90 to-indigo-600/90 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 flex items-center justify-center gap-2 group-hover:shadow-blue-500/20"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              Open IDE
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Footer -->
    <div class="mt-12 text-center">
      <p class="text-xs text-zinc-700">Hermes IDE Extension · Nusawork · v1.0</p>
    </div>
  </div>

  <!-- Edit Password Modal -->
  {#if editingProfile}
    <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-zinc-900 border border-zinc-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-zinc-100">Change Password</h3>
            <p class="text-xs text-zinc-500">{editingProfile}</p>
          </div>
        </div>
        <input
          type="text"
          bind:value={editPassword}
          placeholder="New password"
          class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-3 text-sm mb-5 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none transition-all placeholder:text-zinc-600"
        />
        <div class="flex gap-3">
          <button
            on:click={handleUpdatePassword}
            class="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
          >
            Save
          </button>
          <button
            on:click={() => { editingProfile = null; }}
            class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium rounded-xl text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Confirm Modal -->
  {#if deletingProfile}
    <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-zinc-900 border border-zinc-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-red-400">Delete Profile</h3>
            <p class="text-xs text-zinc-500">This action cannot be undone</p>
          </div>
        </div>
        <p class="text-sm text-zinc-400 mb-5">
          Are you sure you want to delete <span class="text-zinc-200 font-semibold">{deletingProfile}</span>? 
          The container and workspace will be removed on next deploy.
        </p>
        <div class="flex gap-3">
          <button
            on:click={handleDelete}
            class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-red-500/20"
          >
            Delete
          </button>
          <button
            on:click={() => { deletingProfile = null; }}
            class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium rounded-xl text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>
