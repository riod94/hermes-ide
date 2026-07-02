<script lang="ts">
  import { onMount } from 'svelte';
  import { login } from './lib/api';
  import Dashboard from './lib/Dashboard.svelte';

  let selectedProfile = "";
  let password = "";
  let isLoading = false;
  let showPassword = false;
  let errorMsg = "";
  let checkingSession = true;

  // Session state
  let loggedIn = false;
  let sessionName = "";
  let sessionPassword = "";
  let sessionRole = "";
  let sessionPort = 0;

  // Profiles for dropdown (fetched from API on mount)
  let profileNames: string[] = [];

  onMount(async () => {
    // 1. Try restore session from localStorage
    const saved = localStorage.getItem("hermes-ide-session");
    if (saved) {
      try {
        const session = JSON.parse(saved);
        // Validate session is still valid via API
        const result = await login(session.name, session.password);
        if (result.success && result.profile) {
          sessionName = result.profile.name;
          sessionRole = result.profile.role;
          sessionPort = result.profile.port;
          sessionPassword = session.password;
          loggedIn = true;
          checkingSession = false;
          return;
        }
      } catch {
        // Session invalid, clear
        localStorage.removeItem("hermes-ide-session");
      }
    }

    checkingSession = false;

    // 2. Fetch profile names for dropdown
    try {
      const res = await fetch("/api/profile-names");
      if (res.ok) {
        const data = await res.json();
        profileNames = data.names || [];
        if (profileNames.length > 0) selectedProfile = profileNames[0];
      }
    } catch {
      profileNames = ["default"];
      selectedProfile = "default";
    }
  });

  async function handleLogin() {
    if (!selectedProfile || !password) {
      errorMsg = "Pilih profil dan masukkan password";
      return;
    }

    isLoading = true;
    errorMsg = "";

    try {
      const result = await login(selectedProfile, password);

      if (result.success && result.profile) {
        sessionName = result.profile.name;
        sessionRole = result.profile.role;
        sessionPort = result.profile.port;
        sessionPassword = password;

        // Save session to localStorage
        localStorage.setItem("hermes-ide-session", JSON.stringify({
          name: sessionName,
          password: sessionPassword,
        }));

        if (sessionRole === "admin" || sessionRole === "developer") {
          loggedIn = true;
        }
      } else {
        errorMsg = result.error || "Login gagal";
      }
    } catch (e: any) {
      errorMsg = "Koneksi ke server gagal";
    } finally {
      isLoading = false;
    }
  }

  function handleLogout() {
    loggedIn = false;
    sessionName = "";
    sessionPassword = "";
    sessionRole = "";
    sessionPort = 0;
    password = "";
    localStorage.removeItem("hermes-ide-session");
  }

  function togglePassword() {
    showPassword = !showPassword;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") handleLogin();
  }
</script>

{#if checkingSession}
  <!-- Loading splash while checking session -->
  <main class="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black">
    <div class="flex flex-col items-center gap-4">
      <svg class="animate-spin w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      <p class="text-zinc-400 text-sm">Checking session...</p>
    </div>
  </main>
{:else if loggedIn}
  <Dashboard
    userName={sessionName}
    userPassword={sessionPassword}
    userRole={sessionRole}
    on:logout={handleLogout}
  />
{:else}
  <!-- Login Page -->
  <main class="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black p-4">
    
    <div class="relative w-full max-w-md">
      <!-- Glow effect behind the card -->
      <div class="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25"></div>
      
      <!-- Main Card -->
      <div class="relative bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 p-8 rounded-2xl shadow-2xl">
        
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 mb-4 ring-1 ring-blue-500/30">
            <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
          </div>
          <h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
            Hermes IDE
          </h1>
          <p class="mt-2 text-sm text-zinc-400">Agentic Workspace Authentication</p>
        </div>

        <!-- Error message -->
        {#if errorMsg}
          <div class="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {errorMsg}
          </div>
        {/if}

        <!-- Profile Selector -->
        <div class="space-y-5">
          <div>
            <label for="profile" class="block text-sm font-medium text-zinc-300 mb-2">Workspace Profile</label>
            <select
              id="profile"
              bind:value={selectedProfile}
              class="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            >
              {#each profileNames as profile}
                <option value={profile}>{profile}</option>
              {/each}
            </select>
          </div>

          <!-- Password Input -->
          <div>
            <label for="password" class="block text-sm font-medium text-zinc-300 mb-2">Password</label>
            <div class="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                bind:value={password}
                on:keydown={handleKeydown}
                placeholder="Enter workspace password"
                class="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-4 py-3 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
              <button
                type="button"
                on:click={togglePassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {#if showPassword}
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.5 6.5m7.378 7.378L17.5 17.5M3 3l18 18"/></svg>
                {:else}
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                {/if}
              </button>
            </div>
          </div>

          <!-- Login Button -->
          <button
            on:click={handleLogin}
            disabled={isLoading}
            class="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {#if isLoading}
              <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Connecting...
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Connect to IDE
            {/if}
          </button>
        </div>

        <!-- Footer -->
        <div class="mt-6 text-center space-y-2">
          <p class="text-xs text-zinc-500">Lupa password? Hubungi admin untuk reset.</p>
          <p class="text-xs text-zinc-600">Hermes IDE Extension · Nusawork</p>
        </div>
      </div>
    </div>
  </main>
{/if}
