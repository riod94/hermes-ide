<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { listProfiles, addProfile, updateProfilePassword, updateProfileRole, removeProfile, deploy, getMyProfile, changeMyPassword, type ProfileInfo } from './api';
  import ToastContainer from './components/ToastContainer.svelte';
  import ProfileModal from './components/ProfileModal.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';

  export let userName: string;
  export let userPassword: string;
  export let userRole: string;

  const dispatch = createEventDispatcher();

  $: isAdmin = userRole === 'admin';

  let profiles: ProfileInfo[] = [];
  let loading = false;
  let deployLoading = false;
  let toastContainer: ToastContainer;
  let profileModal: ProfileModal;

  // Profile modal state
  let modalShow = false;
  let modalMode: 'create' | 'edit' = 'edit';
  let modalProfile: ProfileInfo | null = null;
  let modalIsSelf = false;

  // Confirm dialog
  let confirmShow = false;
  let confirmTitle = '';
  let confirmMessage = '';
  let confirmVariant: 'danger' | 'warning' | 'info' = 'danger';
  let confirmLoading = false;
  let confirmAction: () => void = () => {};
  let pendingDeleteName = '';

  onMount(() => fetchProfiles());

  async function fetchProfiles() {
    loading = true;
    try {
      if (isAdmin) {
        const data = await listProfiles(userName, userPassword);
        profiles = data.profiles || [];
      } else {
        const data = await getMyProfile(userName, userPassword);
        profiles = data.profile ? [data.profile] : [];
      }
    } catch {
      toastContainer?.error('Gagal memuat profil');
    } finally {
      loading = false;
    }
  }

  // ── Card click → open profile modal ──
  function openEditModal(profile: ProfileInfo) {
    modalProfile = profile;
    modalMode = 'edit';
    modalIsSelf = profile.name === userName;
    modalShow = true;
  }

  function openCreateModal() {
    modalProfile = null;
    modalMode = 'create';
    modalIsSelf = false;
    modalShow = true;
  }

  function closeModal() {
    modalShow = false;
    profileModal?.resetSaving();
  }

  // ── Handlers from ProfileModal events ──
  async function handleCreate(e: CustomEvent<{ name: string; password: string; role: string }>) {
    const { name, password, role } = e.detail;
    try {
      const result = await addProfile(userName, userPassword, name, password, role);
      if (result.success) {
        toastContainer?.success(`Profil '${name}' berhasil ditambahkan`);
        closeModal();
        await fetchProfiles();
      } else {
        toastContainer?.error(result.error || 'Gagal menambah profil');
        profileModal?.resetSaving();
      }
    } catch {
      toastContainer?.error('Gagal menambah profil');
      profileModal?.resetSaving();
    }
  }

  async function handleUpdatePassword(e: CustomEvent<{ name: string; password: string }>) {
    const { name, password } = e.detail;
    try {
      const result = await updateProfilePassword(userName, userPassword, name, password);
      if (result.success) {
        toastContainer?.success(`Password '${name}' berhasil diubah`);
        closeModal();
      } else {
        toastContainer?.error(result.error || 'Gagal mengubah password');
        profileModal?.resetSaving();
      }
    } catch {
      toastContainer?.error('Gagal mengubah password');
      profileModal?.resetSaving();
    }
  }

  async function handleChangeOwnPassword(e: CustomEvent<{ oldPassword: string; newPassword: string }>) {
    const { oldPassword, newPassword } = e.detail;
    try {
      const result = await changeMyPassword(userName, userPassword, oldPassword, newPassword);
      if (result.success) {
        userPassword = newPassword;
        localStorage.setItem('hermes-ide-session', JSON.stringify({ name: userName, password: newPassword }));
        toastContainer?.success('Password berhasil diubah');
        closeModal();
      } else {
        toastContainer?.error(result.error || 'Gagal mengubah password');
        profileModal?.resetSaving();
      }
    } catch {
      toastContainer?.error('Gagal mengubah password');
      profileModal?.resetSaving();
    }
  }

  async function handleUpdateRole(e: CustomEvent<{ name: string; role: string }>) {
    const { name, role } = e.detail;
    try {
      const result = await updateProfileRole(userName, userPassword, name, role);
      if (result.success) {
        toastContainer?.success(`Role '${name}' diubah menjadi '${role}'`);
        closeModal();
        await fetchProfiles();
      } else {
        toastContainer?.error(result.error || 'Gagal mengubah role');
        profileModal?.resetSaving();
      }
    } catch {
      toastContainer?.error('Gagal mengubah role');
      profileModal?.resetSaving();
    }
  }

  function handleDeleteRequest(e: CustomEvent<{ name: string }>) {
    pendingDeleteName = e.detail.name;
    confirmTitle = 'Delete Profile';
    confirmMessage = `Are you sure you want to delete "${pendingDeleteName}"? The container and workspace will be destroyed on next deploy.`;
    confirmVariant = 'danger';
    confirmLoading = false;
    confirmAction = executeDelete;
    modalShow = false;
    confirmShow = true;
  }

  async function executeDelete() {
    confirmLoading = true;
    try {
      const result = await removeProfile(userName, userPassword, pendingDeleteName);
      if (result.success) {
        toastContainer?.success(`Profil '${pendingDeleteName}' berhasil dihapus`);
        confirmShow = false;
        await fetchProfiles();
      } else {
        toastContainer?.error(result.error || 'Gagal menghapus profil');
      }
    } catch {
      toastContainer?.error('Gagal menghapus profil');
    } finally {
      confirmLoading = false;
    }
  }

  function handleValidationError(e: CustomEvent<{ message: string }>) {
    toastContainer?.warning(e.detail.message);
  }

  // ── Deploy ──
  async function handleDeploy() {
    deployLoading = true;
    try {
      const result = await deploy(userName, userPassword);
      if (result.success) {
        toastContainer?.success('Docker Compose di-generate & container di-restart ✅');
      } else {
        toastContainer?.error(result.message || 'Deploy gagal');
      }
    } catch {
      toastContainer?.error('Deploy gagal');
    } finally {
      deployLoading = false;
    }
  }

  function openIDE(profileName: string) {
    const token = btoa(`${userName}:${userPassword}`);
    window.open(`${window.location.origin}/api/open-ide?name=${encodeURIComponent(profileName)}&token=${encodeURIComponent(token)}`, '_blank');
  }

  function getInitial(name: string): string { return name.charAt(0).toUpperCase(); }

  const avatarColors: Record<string, string> = {
    a: 'from-rose-500 to-pink-600', b: 'from-orange-500 to-amber-600',
    c: 'from-amber-500 to-yellow-600', d: 'from-emerald-500 to-green-600',
    e: 'from-teal-500 to-cyan-600', f: 'from-cyan-500 to-blue-600',
    g: 'from-blue-500 to-indigo-600', h: 'from-indigo-500 to-violet-600',
    i: 'from-violet-500 to-purple-600', j: 'from-purple-500 to-fuchsia-600',
    k: 'from-fuchsia-500 to-pink-600', l: 'from-rose-400 to-red-600',
    m: 'from-sky-500 to-blue-600', n: 'from-lime-500 to-green-600',
    o: 'from-orange-400 to-red-500', p: 'from-pink-500 to-rose-600',
    q: 'from-teal-400 to-emerald-600', r: 'from-blue-400 to-indigo-600',
    s: 'from-violet-400 to-purple-600', t: 'from-amber-400 to-orange-600',
    u: 'from-cyan-400 to-teal-600', v: 'from-indigo-400 to-blue-600',
    w: 'from-green-400 to-emerald-600', x: 'from-red-400 to-rose-600',
    y: 'from-yellow-400 to-amber-600', z: 'from-purple-400 to-violet-600',
  };

  function getAvatarColor(name: string): string {
    return avatarColors[name.charAt(0).toLowerCase()] || 'from-zinc-500 to-zinc-600';
  }
</script>

<!-- Toast Container -->
<ToastContainer bind:this={toastContainer} />

<main class="min-h-screen w-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-zinc-950 to-black">

  <!-- Nav -->
  <nav class="border-b border-zinc-800/80 backdrop-blur-xl bg-zinc-950/60 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
          </svg>
        </div>
        <div>
          <h1 class="text-base sm:text-lg font-bold text-white tracking-tight">Hermes IDE</h1>
          <p class="text-[10px] sm:text-xs text-zinc-500">{isAdmin ? 'Admin Dashboard' : 'My Workspace'}</p>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">

        <div class="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-zinc-800/50 rounded-full border border-zinc-700/50">
          <div class="w-2 h-2 rounded-full {isAdmin ? 'bg-blue-400' : 'bg-emerald-400'} animate-pulse"></div>
          <span class="text-xs text-zinc-300 font-medium">{userName}</span>
          <span class="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full {isAdmin ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}">{userRole}</span>
        </div>
        <button on:click={() => dispatch('logout')}
          class="p-2 sm:px-3 sm:py-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all" title="Logout">
          <svg class="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          <span class="hidden sm:inline text-xs">Logout</span>
        </button>
      </div>
    </div>
  </nav>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

    <!-- Stats (admin) -->
    {#if isAdmin}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div class="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 sm:p-4">
          <p class="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mb-1">Total</p>
          <p class="text-xl sm:text-2xl font-bold text-white">{profiles.length}</p>
        </div>
        <div class="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 sm:p-4">
          <p class="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mb-1">Admins</p>
          <p class="text-xl sm:text-2xl font-bold text-blue-400">{profiles.filter(p => p.role === 'admin').length}</p>
        </div>
        <div class="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 sm:p-4">
          <p class="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mb-1">Developers</p>
          <p class="text-xl sm:text-2xl font-bold text-emerald-400">{profiles.filter(p => p.role === 'developer').length}</p>
        </div>
        <div class="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 sm:p-4">
          <p class="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mb-1">Ports</p>
          <p class="text-xl sm:text-2xl font-bold text-amber-400 font-mono">51001‑{51000 + profiles.length}</p>
        </div>
      </div>
    {/if}

    <!-- Action Bar -->
    <div class="flex items-center justify-between mb-5 sm:mb-6">
      <h2 class="text-lg sm:text-xl font-bold text-white">{isAdmin ? 'Workspaces' : 'My Workspace'}</h2>
      {#if isAdmin}
        <div class="flex items-center gap-2 sm:gap-3">
          <button on:click={openCreateModal}
            class="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-1.5 sm:gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span class="hidden sm:inline">Add Profile</span>
            <span class="sm:hidden">Add</span>
          </button>
          <button on:click={handleDeploy} disabled={deployLoading}
            class="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 sm:gap-2">
            {#if deployLoading}
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {:else}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            {/if}
            <span class="hidden sm:inline">{deployLoading ? 'Deploying...' : 'Sync & Deploy'}</span>
            <span class="sm:hidden">{deployLoading ? '...' : 'Deploy'}</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Profile Cards -->
    {#if loading}
      <div class="text-center text-zinc-500 py-16">
        <svg class="animate-spin w-8 h-8 mx-auto mb-3 text-zinc-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        <p class="text-sm">Loading profiles...</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 {isAdmin ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'max-w-md mx-auto'} gap-3 sm:gap-4">
        {#each profiles as profile}
          <div
            class="group relative bg-zinc-900/70 hover:bg-zinc-900/90 border border-zinc-800/60 hover:border-zinc-700/80 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 cursor-pointer"
            on:click={() => openEditModal(profile)}
            on:keydown={(e) => { if (e.key === 'Enter') openEditModal(profile); }}
            role="button"
            tabindex="0"
          >
            <!-- Card content -->
            <div class="p-4 sm:p-5">
              <div class="flex items-center gap-3 mb-3 sm:mb-4">
                <div class="relative">
                  <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br {getAvatarColor(profile.name)} flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg">
                    {getInitial(profile.name)}
                  </div>
                  <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full {profile.role === 'admin' ? 'bg-blue-400' : 'bg-emerald-400'} border-2 border-zinc-900"></div>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-semibold text-zinc-100 truncate">{profile.name}</h3>
                  <div class="flex items-center gap-2">
                    <span class="text-xs {profile.role === 'admin' ? 'text-blue-400' : 'text-zinc-500'}">{profile.role}</span>
                    <span class="text-zinc-700">·</span>
                    <span class="text-xs font-mono text-zinc-500">:{profile.port}</span>
                  </div>
                </div>
                <!-- Settings icon (visible on hover) -->
                <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>

              <!-- Open IDE -->
              <button
                on:click|stopPropagation={() => openIDE(profile.name)}
                class="w-full py-2 sm:py-2.5 px-4 bg-gradient-to-r from-blue-600/90 to-indigo-600/90 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Open IDE
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Footer -->
    <div class="mt-10 sm:mt-12 text-center">
      <p class="text-[10px] sm:text-xs text-zinc-700">Hermes IDE · Nusawork · v1.0</p>
    </div>
  </div>
</main>

<!-- Profile Modal (unified create/edit) -->
<ProfileModal
  bind:this={profileModal}
  show={modalShow}
  mode={modalMode}
  profileName={modalProfile?.name || ''}
  profileRole={modalProfile?.role || 'developer'}
  profilePort={modalProfile?.port || 0}
  {isAdmin}
  isSelf={modalIsSelf}
  on:close={closeModal}
  on:create={handleCreate}
  on:update-password={handleUpdatePassword}
  on:change-own-password={handleChangeOwnPassword}
  on:update-role={handleUpdateRole}
  on:delete={handleDeleteRequest}
  on:validation-error={handleValidationError}
/>

<!-- Confirm Dialog (delete, deploy) -->
<ConfirmDialog
  show={confirmShow}
  title={confirmTitle}
  message={confirmMessage}
  variant={confirmVariant}
  loading={confirmLoading}
  confirmText="Delete"
  onConfirm={confirmAction}
  onCancel={() => { confirmShow = false; }}
/>
