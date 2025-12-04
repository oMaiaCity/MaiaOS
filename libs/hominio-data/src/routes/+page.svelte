<script lang="ts">
  import { JazzAccount } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";
  import { createCoop, removeCoop } from "$lib/groups";
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
        o: {
          humans: true,
          coops: true,
        },
      },
    },
  });
  const me = $derived(account.current);

  // Get all humans
  const humans = $derived(
    me.$isLoaded && me.root.o?.humans?.$isLoaded ? Array.from(me.root.o.humans) : [],
  );

  // Get all coops
  const coops = $derived(
    me.$isLoaded && me.root.o?.coops?.$isLoaded ? Array.from(me.root.o.coops) : [],
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
      <h1
        class="text-4xl font-bold bg-clip-text text-transparent bg-linear-to-br from-slate-700 to-slate-800 tracking-tight"
      >
        Welcome Back, <span
          class="text-transparent bg-clip-text bg-linear-to-r from-slate-600 to-slate-800"
        >
          {(me.root?.o?.humans?.[0] &&
            me.root.o.humans[0]?.$isLoaded &&
            me.root.o.humans[0].name) ||
            betterAuthUser?.name ||
            betterAuthUser?.email?.split("@")[0] ||
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

    <!-- BetterAuth User Profile Properties -->
    {#if betterAuthUser}
      <section
        class="rounded-3xl border border-white bg-slate-50/40 backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)] p-6"
      >
        <h2 class="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Google Profile Data
        </h2>
        <div class="grid gap-3">
          {#each Object.entries(betterAuthUser) as [key, value]}
            {#if value !== null && value !== undefined}
              <div class="flex items-start gap-3 py-2 border-b border-slate-200/50 last:border-b-0">
                <span
                  class="text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px] shrink-0"
                >
                  {key}:
                </span>
                <div class="flex-1 min-w-0">
                  {#if typeof value === "object" && value !== null && !Array.isArray(value)}
                    <pre
                      class="text-xs font-mono text-slate-700 bg-slate-200/50 p-2 rounded overflow-x-auto break-all break-words">{JSON.stringify(
                        value,
                        null,
                        2,
                      )}</pre>
                  {:else if Array.isArray(value)}
                    <pre
                      class="text-xs font-mono text-slate-700 bg-slate-200/50 p-2 rounded overflow-x-auto break-all break-words">{JSON.stringify(
                        value,
                        null,
                        2,
                      )}</pre>
                  {:else}
                    <span class="text-sm text-slate-700 break-all break-words">{String(value)}</span
                    >
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </section>
    {/if}

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

    <!-- Coops Section -->
    <section>
      <div class="flex items-center justify-between mb-4 px-2">
        <h2 class="text-lg font-semibold text-slate-700 flex items-center gap-2">
          <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          Coops
        </h2>
        <button
          type="button"
          class="group relative overflow-hidden px-4 py-1.5 rounded-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white text-xs font-semibold transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
          onclick={async () => {
            try {
              if (!me.$isLoaded) return;
              const coop = await createCoop(me);
              console.log("Coop created:", coop.$jazz.id);
            } catch (error) {
              alert(`Failed: ${error}`);
            }
          }}
        >
          <span class="relative z-10 flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Coop
          </span>
          <div
            class="absolute inset-0 bg-linear-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
          ></div>
        </button>
      </div>

      <div class="space-y-4">
        {#if coops.length > 0}
          <div class="grid gap-4">
            {#each coops as coop}
              {#if coop.$isLoaded}
                <div class="group relative">
                  <CoValueDisplay coValue={coop} coValueType="coop" />
                  <button
                    type="button"
                    class="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-[0_0_4px_rgba(239,68,68,0.2)] scale-90 hover:scale-110"
                    onclick={async (e) => {
                      e.stopPropagation();
                      try {
                        if (!me.$isLoaded) return;
                        await removeCoop(me, coop);
                      } catch (error) {
                        alert(`Failed: ${error}`);
                      }
                    }}
                    title="Remove coop"
                  >
                    <span class="text-xs leading-none">×</span>
                  </button>
                </div>
              {/if}
            {/each}
          </div>
        {:else}
          <div
            class="p-8 rounded-3xl border border-dashed border-white bg-slate-50/40 text-center backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)]"
          >
            <p class="text-sm text-slate-500 italic">
              No coops yet. Start your journey by creating one.
            </p>
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>
