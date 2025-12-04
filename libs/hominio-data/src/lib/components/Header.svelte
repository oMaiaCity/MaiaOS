<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";

  let { appName } = $props();

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Get Jazz account ID from Better Auth user (set by jazzPlugin)
  // The jazzPlugin stores the Jazz account ID in the accountID field
  // Falls back to first 8 chars of Better Auth user ID if accountID not available
  const jazzAccountId = $derived(
    (betterAuthUser as any)?.accountID
      ? String((betterAuthUser as any).accountID).slice(0, 8)
      : betterAuthUser?.id
        ? betterAuthUser.id.slice(0, 8)
        : null,
  );

  let signingOut = $state(false);

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

<header>
  <nav class="flex justify-between items-center py-4 px-4 border-b border-slate-200">
    <div class="flex items-center gap-4">
      <!-- Navigation Links -->
      <div class="flex items-center gap-3">
        <a
          href="/"
          class="text-sm font-medium px-3 py-1.5 rounded-md transition-colors {$page.url
            .pathname === '/'
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}"
        >
          Home
        </a>
        <a
          href="/data"
          class="text-sm font-medium px-3 py-1.5 rounded-md transition-colors {$page.url
            .pathname === '/data'
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}"
        >
          Data
        </a>
      </div>

      {#if isBetterAuthPending}
        <span class="text-sm text-slate-500">Loading...</span>
      {:else if isBetterAuthSignedIn}
        <span class="text-sm text-slate-600">
          Account: {jazzAccountId || betterAuthUser?.name || betterAuthUser?.email || "Logged in"}
        </span>
      {:else}
        <span class="text-sm text-slate-500">Not signed in</span>
      {/if}
    </div>

    <div class="flex gap-2 items-center">
      {#if isBetterAuthSignedIn}
        <button
          type="button"
          onclick={handleBetterAuthSignOut}
          disabled={signingOut}
          class="bg-[#002455] hover:bg-[#002455] disabled:opacity-50 border border-[#001a3d] text-white py-1.5 px-3 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
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
      {/if}
    </div>
  </nav>
</header>
