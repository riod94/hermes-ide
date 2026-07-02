<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from './Modal.svelte';

  export let show = false;
  export let mode: 'create' | 'edit' = 'edit';
  export let profileName = '';
  export let profileRole = 'developer';
  export let profilePort: number = 0;
  export let isAdmin = false;
  export let isSelf = false;

  const dispatch = createEventDispatcher();

  type Tab = 'password' | 'role' | 'danger';
  let activeTab: Tab = 'password';

  // Create mode
  let newName = '';
  let newPassword = '';
  let newRole = 'developer';

  // Edit password (admin)
  let editPassword = '';
  let editPasswordConfirm = '';

  // Self password change
  let oldPassword = '';
  let newOwnPassword = '';
  let confirmOwnPassword = '';

  // Edit role
  let selectedRole = profileRole;

  let saving = false;

  $: selectedRole = profileRole;

  $: if (show) {
    activeTab = 'password';
    editPassword = '';
    editPasswordConfirm = '';
    oldPassword = '';
    newOwnPassword = '';
    confirmOwnPassword = '';
    newName = '';
    newPassword = '';
    newRole = 'developer';
    selectedRole = profileRole;
    saving = false;
  }

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
    return avatarColors[name?.charAt(0).toLowerCase()] || 'from-zinc-500 to-zinc-600';
  }

  function close() { dispatch('close'); }

  function handleCreate() {
    if (!newName.trim() || !newPassword.trim()) return;
    saving = true;
    dispatch('create', { name: newName.trim(), password: newPassword, role: newRole });
  }

  function handleUpdatePassword() {
    if (isSelf) {
      if (!oldPassword || !newOwnPassword || !confirmOwnPassword) return;
      if (newOwnPassword !== confirmOwnPassword) {
        dispatch('validation-error', { message: 'Password baru tidak cocok dengan konfirmasi' });
        return;
      }
      if (newOwnPassword.length < 6) {
        dispatch('validation-error', { message: 'Password baru minimal 6 karakter' });
        return;
      }
      saving = true;
      dispatch('change-own-password', { oldPassword, newPassword: newOwnPassword });
    } else {
      if (!editPassword.trim()) return;
      if (editPassword !== editPasswordConfirm) {
        dispatch('validation-error', { message: 'Password tidak cocok dengan konfirmasi' });
        return;
      }
      saving = true;
      dispatch('update-password', { name: profileName, password: editPassword });
    }
  }

  function handleUpdateRole() {
    if (selectedRole === profileRole) return;
    saving = true;
    dispatch('update-role', { name: profileName, role: selectedRole });
  }

  function handleDelete() {
    dispatch('delete', { name: profileName });
  }

  $: editTabs = (() => {
    const tabs: { id: Tab; label: string; icon: string }[] = [
      { id: 'password', label: 'Password', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    ];
    if (isAdmin && !isSelf && profileName !== 'default') {
      tabs.push({ id: 'role', label: 'Role', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' });
      tabs.push({ id: 'danger', label: 'Danger Zone', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' });
    }
    return tabs;
  })();

  export function resetSaving() { saving = false; }
</script>

<Modal {show} on:close={close}>
  <div slot="header" class="flex items-center gap-3 flex-1">
    {#if mode === 'create'}
      <div class="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      </div>
      <h3 class="text-base font-bold text-zinc-100">New Profile</h3>
    {:else}
      <div class="w-9 h-9 rounded-xl bg-gradient-to-br {getAvatarColor(profileName)} flex items-center justify-center text-white font-bold text-sm shadow-lg">
        {profileName?.charAt(0).toUpperCase() || '?'}
      </div>
      <div>
        <h3 class="text-base font-bold text-zinc-100">{profileName}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs {profileRole === 'admin' ? 'text-blue-400' : 'text-zinc-500'}">{profileRole}</span>
          {#if profilePort}
            <span class="text-zinc-700">·</span>
            <span class="text-xs text-zinc-500 font-mono">Port {profilePort}</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if mode === 'create'}
    <div class="space-y-4">
      <div>
        <label for="pm-name" class="block text-xs font-medium text-zinc-400 mb-1.5">Profile Name</label>
        <input id="pm-name" type="text" bind:value={newName} placeholder="e.g. developer01"
          class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600" />
      </div>
      <div>
        <label for="pm-pass" class="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
        <input id="pm-pass" type="text" bind:value={newPassword} placeholder="Workspace password"
          class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600" />
      </div>
      <div>
        <label for="pm-role" class="block text-xs font-medium text-zinc-400 mb-1.5">Role</label>
        <select id="pm-role" bind:value={newRole}
          class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all">
          <option value="developer">Developer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <!-- Footer integrated -->
      <div class="flex gap-3 pt-4 border-t border-zinc-800/80">
        <button on:click={close}
          class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium rounded-xl text-sm transition-all">Cancel</button>
        <button on:click={handleCreate} disabled={saving || !newName.trim() || !newPassword.trim()}
          class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {#if saving}
            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          {/if}
          Create Profile
        </button>
      </div>
    </div>

  {:else}
    <!-- Edit Mode -->
    {#if editTabs.length > 1}
      <div class="flex gap-1 mb-5 p-1 bg-zinc-800/50 rounded-xl">
        {#each editTabs as tab}
          <button on:click={() => { activeTab = tab.id; }}
            class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all {activeTab === tab.id
              ? (tab.id === 'danger' ? 'bg-red-500/20 text-red-400' : 'bg-zinc-700 text-white shadow-sm')
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        {/each}
      </div>
    {/if}

    {#if activeTab === 'password'}
      <div class="space-y-4">
        {#if isSelf}
          <div>
            <label for="pm-old" class="block text-xs font-medium text-zinc-400 mb-1.5">Current Password</label>
            <input id="pm-old" type="password" bind:value={oldPassword} placeholder="Enter current password"
              class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600" />
          </div>
          <div>
            <label for="pm-new" class="block text-xs font-medium text-zinc-400 mb-1.5">New Password</label>
            <input id="pm-new" type="password" bind:value={newOwnPassword} placeholder="Min 6 characters"
              class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600" />
          </div>
          <div>
            <label for="pm-confirm" class="block text-xs font-medium text-zinc-400 mb-1.5">Confirm New Password</label>
            <input id="pm-confirm" type="password" bind:value={confirmOwnPassword} placeholder="Repeat new password"
              class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600" />
          </div>
        {:else}
          <p class="text-xs text-zinc-500 mb-1">Set new password for <span class="text-zinc-300 font-medium">{profileName}</span></p>
          <div>
            <label for="pm-reset" class="block text-xs font-medium text-zinc-400 mb-1.5">New Password</label>
            <input id="pm-reset" type="text" bind:value={editPassword} placeholder="New password"
              class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600" />
          </div>
          <div>
            <label for="pm-reset-c" class="block text-xs font-medium text-zinc-400 mb-1.5">Confirm Password</label>
            <input id="pm-reset-c" type="text" bind:value={editPasswordConfirm} placeholder="Repeat password"
              class="w-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-zinc-600" />
          </div>
        {/if}
        <div class="pt-4 border-t border-zinc-800/80">
          <button on:click={handleUpdatePassword} disabled={saving}
            class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
            {#if saving}
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {/if}
            {isSelf ? 'Update Password' : 'Reset Password'}
          </button>
        </div>
      </div>

    {:else if activeTab === 'role'}
      <div class="space-y-4">
        <p class="text-xs text-zinc-500">Change role for <span class="text-zinc-300 font-medium">{profileName}</span></p>
        <div class="grid grid-cols-2 gap-3">
          <button on:click={() => { selectedRole = 'developer'; }}
            class="p-4 rounded-xl border-2 transition-all text-left {selectedRole === 'developer'
              ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600/50'}">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span class="text-sm font-medium {selectedRole === 'developer' ? 'text-emerald-300' : 'text-zinc-300'}">Developer</span>
            </div>
            <p class="text-[11px] text-zinc-500">Access own workspace only</p>
          </button>
          <button on:click={() => { selectedRole = 'admin'; }}
            class="p-4 rounded-xl border-2 transition-all text-left {selectedRole === 'admin'
              ? 'border-blue-500/50 bg-blue-500/5' : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600/50'}">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-2 h-2 rounded-full bg-blue-400"></div>
              <span class="text-sm font-medium {selectedRole === 'admin' ? 'text-blue-300' : 'text-zinc-300'}">Admin</span>
            </div>
            <p class="text-[11px] text-zinc-500">Full dashboard access</p>
          </button>
        </div>
        <div class="pt-4 border-t border-zinc-800/80">
          <button on:click={handleUpdateRole} disabled={saving || selectedRole === profileRole}
            class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {#if saving}
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {/if}
            Update Role
          </button>
        </div>
      </div>

    {:else if activeTab === 'danger'}
      <div class="space-y-4">
        <div class="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 class="text-sm font-semibold text-red-400">Delete Profile</h4>
              <p class="text-xs text-zinc-500 mt-1">
                This will remove <span class="text-zinc-300 font-medium">{profileName}</span> permanently.
                The workspace container will be destroyed on next deploy.
              </p>
            </div>
          </div>
        </div>
        <div class="pt-4 border-t border-zinc-800/80">
          <button on:click={handleDelete}
            class="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Profile
          </button>
        </div>
      </div>
    {/if}
  {/if}
</Modal>
