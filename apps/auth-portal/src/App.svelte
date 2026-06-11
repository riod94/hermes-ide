<script lang="ts">
  import { onMount } from 'svelte';

  let profiles = ["rio", "default", "sabrino"];
  let selectedProfile = "rio";
  let password = "";
  let isLoading = false;
  let showPassword = false;

  function handleLogin() {
    isLoading = true;
    setTimeout(() => {
      console.log(`Login attempt for ${selectedProfile}`);
      window.location.href = `http://${selectedProfile}.hermes-ide.local/`;
      isLoading = false;
    }, 1000);
  }

  function togglePassword() {
    showPassword = !showPassword;
  }
</script>

<!-- Container utama layar penuh, flex, items-center dan justify-center untuk memastikan card di tengah absolute -->
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

      <!-- Form -->
      <form on:submit|preventDefault={handleLogin} class="space-y-6">
        
        <!-- Profile Dropdown -->
        <div class="space-y-1.5">
          <label for="profile" class="block text-sm font-medium text-zinc-300">Profile Select</label>
          <div class="relative">
            <select 
              id="profile" 
              bind:value={selectedProfile}
              class="appearance-none w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
            >
              {#each profiles as profile}
                <option value={profile}>{profile}</option>
              {/each}
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>

        <!-- Password Input -->
        <div class="space-y-1.5">
          <label for="password" class="block text-sm font-medium text-zinc-300">Passkey / Password</label>
          <div class="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              id="password" 
              bind:value={password}
              placeholder="Enter credentials..."
              class="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 placeholder:text-zinc-600"
              required
            />
            <button 
              type="button"
              class="absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400 hover:text-zinc-200 focus:outline-none"
              on:click={togglePassword}
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {#if showPassword}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                {:else}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                {/if}
              </svg>
            </button>
          </div>
        </div>

        <!-- Submit Button -->
        <button 
          type="submit"
          disabled={isLoading}
          class="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-blue-500 transition-all duration-200 disabled:opacity-70"
        >
          {#if isLoading}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Authenticating...
          {:else}
            Connect Workspace
            <svg class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
          {/if}
        </button>
      </form>
    </div>
  </div>
</main>
