<script lang="ts">
  import { setupComputedFieldsForCoValue } from "@maia/db";
  import { Image } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";
  import { getJazzAccountContext } from "$lib/contexts/jazz-account-context";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Get global Jazz account from context
  const account = getJazzAccountContext();
  const me = $derived(account ? account.current : null);

  // Set up computed fields for profile when it's loaded
  // This ensures name is computed from firstName + lastName
  $effect(() => {
    if (me && me.$isLoaded && me.profile?.$isLoaded) {
      setupComputedFieldsForCoValue(me.profile);
    }
  });

  // Get profile image for display
  const profileImage = $derived(
    me &&
      me.$isLoaded &&
      me.profile?.$isLoaded &&
      (me.profile as any).$jazz.has("image") &&
      (me.profile as any).image &&
      (me.profile as any).image.$isLoaded
      ? (me.profile as any).image
      : null,
  );
</script>

<div class="w-full h-full overflow-y-auto max-w-4xl mx-auto px-6 py-6 space-y-6">
  {#if isBetterAuthPending}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading...</p>
    </div>
  {:else if !isBetterAuthSignedIn}
    <!-- Landing Page Header -->
    <header class="text-center pb-20">
      <h1
        class="text-6xl md:text-7xl font-bold bg-clip-text text-transparent bg-linear-to-br from-slate-800 via-slate-700 to-slate-900 tracking-tight mb-6"
      >
        MaiaCity
      </h1>
      <p
        class="text-xl md:text-2xl text-slate-600 font-medium mb-4 max-w-2xl mx-auto"
      >
        Your personal voice assistant
      </p>
      <p
        class="text-lg md:text-xl text-slate-500 max-w-xl mx-auto leading-relaxed"
      >
        Own your data. Control your privacy. Experience AI that truly works for
        you.
      </p>
    </header>
  {:else if !me || !me.$isLoaded}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading your account...</p>
    </div>
  {:else if me && me.$isLoaded}
    <!-- Welcome Section -->
    <header class="text-center pb-4">
      <!-- Profile Image -->
      {#if profileImage}
        <div class="flex justify-center mb-6">
          <div
            class="relative w-48 h-48 rounded-full overflow-hidden border-4 border-white shadow-[0_0_12px_rgba(0,0,0,0.1)]"
          >
            <Image
              imageId={profileImage.$jazz.id}
              width={192}
              height={192}
              alt="Profile"
              class="w-full h-full object-cover"
            />
          </div>
        </div>
      {/if}
      <h1
        class="text-4xl font-bold bg-clip-text text-transparent bg-linear-to-br from-slate-700 to-slate-800 tracking-tight"
      >
        Welcome Back, <span
          class="text-transparent bg-clip-text bg-linear-to-r from-[#002455] to-[#001a3d]"
        >
          {(me.profile &&
            (me.profile as any).$isLoaded &&
            (me.profile as any).name) ||
            "Traveler"}
        </span>
      </h1>
      <div
        class="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-slate-50/60 border border-white shadow-[0_0_6px_rgba(0,0,0,0.03)] backdrop-blur-md"
      >
        <span class="text-xs font-medium text-slate-500">Account ID: </span>
        <span class="ml-2 font-mono text-xs text-slate-400">{me.$jazz.id}</span>
      </div>
    </header>
  {/if}
</div>
