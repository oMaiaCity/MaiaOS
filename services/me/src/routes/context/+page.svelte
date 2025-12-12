<script lang="ts">
  import {
    JazzAccount,
    navigateToCoValueContext,
    type CoValueContext,
    isCoID,
    resolveCoValue,
  } from "@hominio/data";
  import type { CoID, RawCoValue } from "cojson";
  import { AccountCoState } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";
  import { Context, MetadataSidebar } from "$lib/components/data-explorer";
  import Card from "$lib/components/leafs/Card.svelte";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Load Jazz account
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: true, // Resolve root
    },
  });
  const me = $derived(account.current);
  const currentAccount = $derived(me);

  // Get node for resolving CoValues
  const node = $derived(() => {
    const raw = me?.$jazz?.raw;
    if (!raw) return undefined;
    try {
      return raw.core?.node;
    } catch (e) {
      return undefined;
    }
  });

  // Navigation stack - tracks the path through CoValues
  let navigationStack = $state<Array<{ label: string; coValueId: CoID<RawCoValue> }>>([]);

  // Current context
  let currentContext = $state<CoValueContext | null>(null);
  let isLoading = $state(false);

  // Initialize with root context
  $effect(() => {
    const currentNode = node();
    const rootId = me.$isLoaded && me.root?.$isLoaded ? me.root.$jazz?.id : undefined;
    if (!currentNode || !rootId || currentContext) return;

    // Load root context
    (async () => {
      isLoading = true;
      try {
        const context = await navigateToCoValueContext(rootId, currentNode);

        // Add profile to root context if available (using resolveCoValue utility, same as navigateToCoValueContext)
        // Extract profile ID from me.profile (handle both CoID string and CoValue object)
        let profileId: string | undefined;
        if (me.$isLoaded && me.profile) {
          if (typeof me.profile === "string" && me.profile.startsWith("co_")) {
            profileId = me.profile;
          } else if (typeof me.profile === "object" && me.profile.$jazz?.id) {
            profileId = me.profile.$jazz.id;
          }
        }

        if (profileId && currentNode) {
          // Check if profile is already in directChildren
          const hasProfile = context.directChildren.some((c) => c.coValueId === profileId);
          if (
            !hasProfile &&
            context.resolved.snapshot &&
            typeof context.resolved.snapshot === "object"
          ) {
            // Add profile to snapshot
            (context.resolved.snapshot as any).profile = profileId;

            // Add profile immediately (without resolved) - will show loading state until resolved
            context.directChildren.push({
              key: "profile",
              coValueId: profileId,
            });

            // Resolve profile using resolveCoValue utility (same as navigateToCoValueContext does)
            // This is async but we add it immediately and resolve in background
            (async () => {
              try {
                const profileResolved = await resolveCoValue(profileId, currentNode);
                // Update the context with resolved profile - trigger reactivity
                const profileChildIndex = context.directChildren.findIndex(
                  (c) => c.coValueId === profileId,
                );
                if (profileChildIndex !== -1) {
                  // Create new array to trigger reactivity
                  const updatedChildren = [...context.directChildren];
                  updatedChildren[profileChildIndex] = {
                    ...updatedChildren[profileChildIndex],
                    resolved: profileResolved,
                  };
                  context.directChildren = updatedChildren;
                  // Update currentContext to trigger reactivity
                  currentContext = { ...context };
                }
              } catch (e) {
                console.warn(`Failed to resolve profile ${profileId}:`, e);
              }
            })();
          }
        }

        currentContext = context;
        navigationStack = [{ label: "DB", coValueId: rootId }];
      } catch (e) {
        console.error("Error loading root context:", e);
      } finally {
        isLoading = false;
      }
    })();
  });

  // Navigate to a CoValue (non-blocking - update UI immediately)
  async function navigateToCoValue(coValueId: CoID<RawCoValue>, label?: string) {
    const currentNode = node();
    if (!currentNode) return;

    // Update navigation stack immediately (non-blocking UI)
    const newLabel = label || coValueId.slice(0, 8) + "...";
    navigationStack = [...navigationStack, { label: newLabel, coValueId }];

    // Load context in background (non-blocking)
    (async () => {
      try {
        const context = await navigateToCoValueContext(coValueId, currentNode);
        currentContext = context;
      } catch (e) {
        console.error(`Error navigating to CoValue ${coValueId}:`, e);
        // Revert navigation stack on error
        navigationStack = navigationStack.slice(0, -1);
      }
    })();
  }

  // Navigate back (non-blocking)
  async function navigateBack() {
    if (navigationStack.length <= 1) return;

    const currentNode = node();
    if (!currentNode) return;

    // Update stack immediately
    navigationStack = navigationStack.slice(0, -1);
    const previous = navigationStack[navigationStack.length - 1];

    // Load previous context in background
    (async () => {
      try {
        const context = await navigateToCoValueContext(previous.coValueId, currentNode);
        currentContext = context;
      } catch (e) {
        console.error(`Error loading previous context:`, e);
      }
    })();
  }

  // Navigate to a specific item in the breadcrumb (non-blocking)
  async function navigateToBreadcrumb(index: number) {
    const currentNode = node();
    if (!currentNode) return;

    const target = navigationStack[index];
    if (!target) return;

    // Update stack immediately
    navigationStack = navigationStack.slice(0, index + 1);

    // Load context in background
    (async () => {
      try {
        const context = await navigateToCoValueContext(target.coValueId, currentNode);
        currentContext = context;
      } catch (e) {
        console.error(`Error loading breadcrumb context:`, e);
      }
    })();
  }
</script>

<div class="w-full max-w-7xl mx-auto px-6 pt-24 pb-20">
  {#if isBetterAuthPending}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading...</p>
    </div>
  {:else if !isBetterAuthSignedIn}
    <div class="text-center pt-8 pb-4">
      <h1 class="text-4xl font-bold text-slate-700 mb-4">Welcome</h1>
      <p class="text-slate-500 mb-6">Please sign in to access your data.</p>
    </div>
  {:else if !currentContext && isLoading}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading context...</p>
    </div>
  {:else if !currentContext}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">No context available</p>
    </div>
  {:else}
    <div>
      <!-- Breadcrumb Navigation -->
      <div class="flex items-center gap-2 mb-6">
        {#if navigationStack.length > 1}
          <button
            type="button"
            onclick={navigateBack}
            class="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
          >
            ← Back
          </button>
          <span class="text-slate-400">|</span>
        {/if}
        {#each navigationStack as item, index}
          {#if index < navigationStack.length - 1}
            <button
              type="button"
              onclick={() => navigateToBreadcrumb(index)}
              class="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
            >
              {item.label}
            </button>
            <span class="text-slate-400">/</span>
          {:else}
            <span class="text-sm font-semibold text-slate-900">{item.label}</span>
          {/if}
        {/each}
      </div>

      <!-- Two-column layout: Main + Metadata -->
      <div class="flex gap-6 items-start">
        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          <Context
            context={currentContext}
            node={node()}
            onNavigate={(coValueId, label) => navigateToCoValue(coValueId as CoID, label)}
            onBack={navigationStack.length > 1 ? navigateBack : undefined}
            view="list"
          />
        </div>

        <!-- Right Aside: Metadata -->
        <div class="w-80 shrink-0">
          <aside class="sticky top-6">
            <!-- Metadata Title (outside card, like legacy) - matching main content header spacing exactly -->
            <div class="mb-6">
              <div class="mb-2">
                <h2
                  class="text-lg font-semibold text-slate-700 flex items-center justify-end gap-2 m-0"
                >
                  <span>Metadata</span>
                  <svg
                    class="w-5 h-5 text-slate-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </h2>
              </div>
            </div>
            <MetadataSidebar context={currentContext} node={node()} {currentAccount} />
          </aside>
        </div>
      </div>
    </div>
  {/if}
</div>
