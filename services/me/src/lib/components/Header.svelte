<script lang="ts">
  import { Image } from "jazz-tools/svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { authClient } from "$lib/auth-client";
  import { getJazzAccountContext } from "$lib/utils/jazz-account-context";

  const { title, description } = $props();

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Get global Jazz account from context
  const account = getJazzAccountContext();
  const me = $derived(account ? account.current : null);

  // Get profile data
  const profile = $derived(
    me && me.$isLoaded && me.profile?.$isLoaded ? (me.profile as any) : null,
  );

  const firstName = $derived(profile?.firstName?.trim() || "");
  const lastName = $derived(profile?.lastName?.trim() || "");

  // Get profile image
  const avatarImage = $derived(
    profile?.image?.$isLoaded && profile.image.$jazz?.id ? profile.image : null,
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
    } catch (_error) {}
  }

  async function handleBetterAuthSignOut() {
    signingOut = true;
    try {
      await authClient.signOut();
    } catch (_error) {
      signingOut = false;
    }
  }
</script>

<header class="fixed top-0 left-0 right-0 z-50 bg-white/30 backdrop-blur-2xl border-b border-[#1F4269]/10 shadow-sm transition-all duration-300">
  <nav
    class="relative flex justify-between items-center py-4 px-4"
  >
    <!-- Left: Logo and Route Title/Description -->
    <div class="flex items-center gap-4 shrink-0">
      <!-- Logo -->
      <a href="/" class="shrink-0">
        <img src="/brand/MaiaCity.svg" alt="Maia City" class="h-10 w-auto opacity-100" />
      </a>
      {#if title || description}
        <div class="flex flex-col">
          {#if title}
            <h1 class="text-lg font-bold text-[#0A274D] leading-tight">
              {title}
            </h1>
          {/if}
          {#if description}
            <p class="text-xs text-[#0A274D]/70 font-medium mt-0.5">{description}</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Center: Navigation Links -->
    <div class="flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
      <a
        href="/"
        class="text-sm font-bold px-4 py-2 rounded-full transition-all {$page
          .url.pathname === '/'
          ? 'bg-[#0A274D]/10 text-[#0A274D]'
          : 'text-[#0A274D]/60 hover:text-[#0A274D] hover:bg-white/20'}"
      >
        Home
      </a>

      <a
        href="/vibes"
        class="text-sm font-bold px-4 py-2 rounded-full transition-all {$page.url.pathname.startsWith(
          '/vibes',
        )
          ? 'bg-[#0A274D]/10 text-[#0A274D]'
          : 'text-[#0A274D]/60 hover:text-[#0A274D] hover:bg-white/20'}"
      >
        Vibes
      </a>
      <a
        href="/db"
        class="text-sm font-bold px-4 py-2 rounded-full transition-all {$page
          .url.pathname === '/db'
          ? 'bg-[#0A274D]/10 text-[#0A274D]'
          : 'text-[#0A274D]/60 hover:text-[#0A274D] hover:bg-white/20'}"
      >
        DB
      </a>
      <a
        href="/sandbox"
        class="text-sm font-bold px-4 py-2 rounded-full transition-all {$page
          .url.pathname === '/sandbox'
          ? 'bg-[#0A274D]/10 text-[#0A274D]'
          : 'text-[#0A274D]/60 hover:text-[#0A274D] hover:bg-white/20'}"
      >
        Sandbox
      </a>
    </div>

    <!-- Right: Account Metadata -->
    <div class="flex gap-2 items-center shrink-0">
      {#if isBetterAuthPending}
        <span class="text-sm text-[#0A274D]/50">Loading...</span>
      {:else if isBetterAuthSignedIn && me && me.$isLoaded && profile}
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
                <div class="text-sm font-bold text-[#0A274D] leading-tight">
                  {firstName}
                  {lastName}
                </div>
              {:else}
                <div class="text-sm font-bold text-[#0A274D] leading-tight">
                  {betterAuthUser?.email || "User"}
                </div>
              {/if}
              {#if betterAuthUser?.email}
                <div
                  class="text-[10px] font-mono text-[#0A274D]/50 leading-tight truncate max-w-[150px]"
                >
                  {betterAuthUser.email}
                </div>
              {/if}
            </div>
            <!-- Avatar Image (right) -->
            {#if avatarImage}
              <div
                class="w-10 h-10 rounded-full overflow-hidden border-2 border-[#0A274D]/10 shrink-0 shadow-sm"
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
                class="w-10 h-10 rounded-full bg-[#0A274D]/5 border-2 border-[#0A274D]/10 flex items-center justify-center shrink-0"
              >
                <svg
                  class="w-6 h-6 text-[#0A274D]/30"
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
              class="w-4 h-4 text-[#0A274D]/30 transition-transform {dropdownOpen
                ? 'rotate-180'
                : ''}"
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
              class="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white border border-[#0A274D]/10 shadow-2xl z-50 overflow-hidden backdrop-blur-xl"
            >
              <div class="py-1">
                <button
                  type="button"
                  onclick={() => {
                    dropdownOpen = false;
                    handleBetterAuthSignOut();
                  }}
                  disabled={signingOut}
                  class="w-full text-left px-4 py-3 text-sm font-bold text-[#0A274D] hover:bg-[#0A274D]/5 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {#if signingOut}
                    <span>Signing out...</span>
                  {:else}
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
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
        <span class="text-sm text-[#0A274D]/70">
          {betterAuthUser?.email || "Logged in"}
        </span>
      {:else if !isBetterAuthPending}
        <button
          type="button"
          onclick={handleGoogleSignIn}
          class="bg-[#0A274D] hover:bg-[#1F4269] text-white py-2 px-6 text-sm font-bold rounded-full transition-all duration-300 shadow-lg hover:scale-[1.05] active:scale-[0.95] flex items-center gap-2"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              class="opacity-80"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              class="opacity-60"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              class="opacity-40"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Talk to Maia
        </button>
      {:else}
        <span class="text-sm text-[#0A274D]/50 font-bold">Not signed in</span>
      {/if}
    </div>
  </nav>
</header>
