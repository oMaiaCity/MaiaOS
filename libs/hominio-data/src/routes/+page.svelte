<script lang="ts">
  import { JazzAccount } from "$lib/schema";
  import { AccountCoState, Image } from "jazz-tools/svelte";
  import CoValueDisplay from "$lib/components/CoValueDisplay.svelte";
  import { authClient } from "$lib/auth-client";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Load Jazz account - Better Auth Jazz plugin automatically sets up the account
  // AccountCoState will use the current account from the Jazz provider
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        humans: true,
      },
    },
  });
  const me = $derived(account.current);

  // Get all humans
  const humans = $derived(
    me.$isLoaded && me.root?.humans?.$isLoaded ? Array.from(me.root.humans) : [],
  );

  // Get first human's avatar image for display
  const firstHumanAvatarImage = $derived(
    me.$isLoaded &&
      me.root?.humans?.[0]?.$isLoaded &&
      me.root.humans[0].$jazz.has("avatar") &&
      (me.root.humans[0].avatar as any)?.image &&
      (me.root.humans[0].avatar as any).image.$isLoaded
      ? (me.root.humans[0].avatar as any).image
      : null,
  );
</script>

<div class="w-full space-y-6 pb-20">
  {#if isBetterAuthPending}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading...</p>
    </div>
  {:else if !isBetterAuthSignedIn}
    <div class="text-center pt-8 pb-4">
      <h1 class="text-4xl font-bold text-slate-700 mb-4">Welcome</h1>
      <p class="text-slate-500 mb-6">Please sign in to access your data.</p>
    </div>
  {:else if !me.$isLoaded}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading your account...</p>
    </div>
  {:else if me.$isLoaded}
    <!-- Welcome Section -->
    <header class="text-center pt-8 pb-4">
      <!-- Profile Image -->
      {#if firstHumanAvatarImage}
        <div class="flex justify-center mb-6">
          <div
            class="relative w-64 h-64 rounded-full overflow-hidden border-4 border-white shadow-[0_0_12px_rgba(0,0,0,0.1)]"
          >
            <Image
              imageId={firstHumanAvatarImage.$jazz.id}
              width={256}
              height={256}
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
          class="text-transparent bg-clip-text bg-linear-to-r from-slate-600 to-slate-800"
        >
          {(me.root?.humans?.[0] && me.root.humans[0]?.$isLoaded && me.root.humans[0]["@label"]) ||
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

    <!-- Humans Section -->
    <section>
      <div class="flex items-center justify-between mb-4 px-2">
        <h2 class="text-lg font-semibold text-slate-700 flex items-center gap-2">
          <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Humans
        </h2>
        <span class="text-xs font-medium px-2 py-1 rounded-full bg-slate-100/50 text-slate-500">
          {humans.length}
        </span>
      </div>

      {#if humans.length > 0}
        <div class="grid gap-4">
          {#each humans as human}
            {#if human?.$isLoaded}
              <CoValueDisplay coValue={human} coValueType="human" />
            {/if}
          {/each}
        </div>
      {:else}
        <div
          class="p-8 rounded-3xl border border-dashed border-white bg-slate-50/40 text-center backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)]"
        >
          <p class="text-sm text-slate-500">No humans found.</p>
        </div>
      {/if}
    </section>
  {/if}
</div>
