<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { JazzAccount } from "@hominio/data";
  import { AccountCoState, Image } from "jazz-tools/svelte";

  let { title, description } = $props();

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Load Jazz account to access profile data
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      profile: true,
    },
  });
  const me = $derived(account.current);

  // Get profile data
  const profile = $derived(me.$isLoaded && me.profile?.$isLoaded ? (me.profile as any) : null);

  const firstName = $derived(profile?.firstName?.trim() || "");
  const lastName = $derived(profile?.lastName?.trim() || "");

  // Get profile image
  const avatarImage = $derived(
    profile?.image && profile.image.$isLoaded && profile.image.$jazz?.id ? profile.image : null,
  );

  let signingOut = $state(false);
  let dropdownOpen = $state(false);
  let dropdownRef: HTMLDivElement | null = $state(null);

  // Close dropdown when clicking outside
  if (browser) {
    $effect(() => {
      if (!dropdownOpen) return;

      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
          dropdownOpen = false;
        }
      }

      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    });
  }

  async function handleGoogleSignIn() {
    if (!browser) return;

    try {
      const callbackURL = window.location.href;
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
    } catch (error) {
      console.error("Google sign-in error:", error);
    }
  }

  async function handleBetterAuthSignOut() {
    signingOut = true;
    try {
      await authClient.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
      signingOut = false;
    }
  }
</script>

<header class="fixed top-0 left-0 right-0 z-50">
  <nav
    class="bg-gray-200 relative flex justify-between items-center py-4 px-4 border-b border-slate-200"
  >
    <!-- Left: Logo and Route Title/Description -->
    <div class="flex items-center gap-4 flex-shrink-0">
      <!-- Logo -->
      <a href="/" class="flex-shrink-0">
        <img src="/brand/logo_clean.png" alt="Hominio" class="h-10 w-auto" />
      </a>
      {#if title || description}
        <div class="flex flex-col">
          {#if title}
            <h1 class="text-lg font-bold text-slate-900 leading-tight">{title}</h1>
          {/if}
          {#if description}
            <p class="text-xs text-slate-500 mt-0.5">{description}</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Center: Navigation Links -->
    <div class="flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
      <a
        href="/"
        class="text-sm font-medium px-3 py-1.5 rounded-md transition-colors {$page.url.pathname ===
        '/'
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}"
      >
        Home
      </a>
      <a
        href="/data"
        class="text-sm font-medium px-3 py-1.5 rounded-md transition-colors {$page.url.pathname ===
        '/data'
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}"
      >
        Data
      </a>
      <a
        href="/vibes"
        class="text-sm font-medium px-3 py-1.5 rounded-md transition-colors {$page.url.pathname.startsWith(
          '/vibes',
        )
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}"
      >
        Vibes
      </a>
      <a
        href="/schema"
        class="text-sm font-medium px-3 py-1.5 rounded-md transition-colors {$page.url.pathname ===
        '/schema'
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}"
      >
        Schema
      </a>
      <a
        href="/context"
        class="text-sm font-medium px-3 py-1.5 rounded-md transition-colors {$page.url.pathname ===
        '/context'
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}"
      >
        Context
      </a>
    </div>

    <!-- Right: Account Metadata -->
    <div class="flex gap-2 items-center flex-shrink-0">
      {#if isBetterAuthPending}
        <span class="text-sm text-slate-500">Loading...</span>
      {:else if isBetterAuthSignedIn && me.$isLoaded && profile}
        <!-- User Avatar and Name with Dropdown -->
        <div class="relative" bind:this={dropdownRef}>
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              dropdownOpen = !dropdownOpen;
            }}
            class="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <!-- Name and Email (left, right-aligned) -->
            <div class="flex flex-col text-right">
              {#if firstName || lastName}
                <div class="text-sm font-medium text-slate-900 leading-tight">
                  {firstName}
                  {lastName}
                </div>
              {:else}
                <div class="text-sm font-medium text-slate-900 leading-tight">
                  {betterAuthUser?.email || "User"}
                </div>
              {/if}
              {#if betterAuthUser?.email}
                <div class="text-xs text-slate-500 leading-tight truncate max-w-[150px]">
                  {betterAuthUser.email}
                </div>
              {/if}
            </div>
            <!-- Avatar Image (right) -->
            {#if avatarImage}
              <div
                class="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0"
              >
                <Image
                  imageId={avatarImage.$jazz.id}
                  width={40}
                  height={40}
                  alt="Profile"
                  class="w-full h-full object-cover"
                />
              </div>
            {:else}
              <div
                class="w-10 h-10 rounded-full bg-slate-200 border-2 border-slate-200 flex items-center justify-center flex-shrink-0"
              >
                <svg
                  class="w-6 h-6 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            {/if}
            <!-- Dropdown Arrow -->
            <svg
              class="w-4 h-4 text-slate-400 transition-transform {dropdownOpen ? 'rotate-180' : ''}"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <!-- Dropdown Menu -->
          {#if dropdownOpen}
            <div
              class="absolute right-0 top-full w-48 rounded-lg bg-white border border-slate-200 shadow-lg z-50"
            >
              <div class="py-1">
                <button
                  type="button"
                  onclick={() => {
                    dropdownOpen = false;
                    handleBetterAuthSignOut();
                  }}
                  disabled={signingOut}
                  class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                >
                  {#if signingOut}
                    <span>Signing out...</span>
                  {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign out
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      {:else if isBetterAuthSignedIn}
        <span class="text-sm text-slate-600">
          {betterAuthUser?.email || "Logged in"}
        </span>
      {:else if !isBetterAuthPending}
        <button
          type="button"
          onclick={handleGoogleSignIn}
          class="bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-4 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      {:else}
        <span class="text-sm text-slate-500">Not signed in</span>
      {/if}
    </div>
  </nav>
</header>
