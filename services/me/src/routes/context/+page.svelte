<script lang="ts">
  import {
    type CoValueContext,
    JazzAccount,
    navigateToCoValueContext,
    resolveCoValue,
  } from "@hominio/data";
  import type { CoID, RawCoValue } from "cojson";
  import { AccountCoState } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";
  import ObjectContextDisplay from "$lib/components/data-explorer/ObjectContextDisplay.svelte";
  import { Context, MetadataSidebar } from "$lib/components/data-explorer";

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
    if (!me?.$isLoaded) return undefined;
    try {
      const raw = (me as any).$jazz?.raw;
      if (!raw) return undefined;
      return raw.core?.node;
    } catch (_e) {
      return undefined;
    }
  });

  // Navigation stack - tracks the path through CoValues and objects
  type NavigationItem =
    | {
        type: "covalue";
        label: string;
        coValueId: CoID<RawCoValue>;
        context: CoValueContext;
      }
    | {
        type: "object";
        label: string;
        object: any;
        parentCoValue: any;
        parentKey: string;
        parentContext: CoValueContext;
      };
  let navigationStack = $state<NavigationItem[]>([]);

  // Current context is derived from the last item in the stack (like legacy)
  const currentContext = $derived(() => {
    if (navigationStack.length === 0) return null;
    const lastItem = navigationStack[navigationStack.length - 1];
    if (lastItem.type === "covalue") {
      return lastItem.context;
    }
    // For objects, return null (we'll handle rendering separately)
    return null;
  });

  // Current object context (for object navigation)
  const currentObjectContext = $derived(() => {
    if (navigationStack.length === 0) return null;
    const lastItem = navigationStack[navigationStack.length - 1];
    if (lastItem.type === "object") {
      return lastItem;
    }
    return null;
  });

  let isLoading = $state(false);

  // Initialize with root context
  $effect(() => {
    const currentNode = node();
    const rootId =
      me.$isLoaded && me.root?.$isLoaded ? me.root.$jazz?.id : undefined;
    if (!currentNode || !rootId || navigationStack.length > 0) return; // Load root context
    (async () => {
      isLoading = true;
      try {
        const context = await navigateToCoValueContext(rootId, currentNode);

        // Add profile to root context if available (using resolveCoValue utility, same as navigateToCoValueContext)
        // Extract profile ID from me.profile (handle both CoID string and CoValue object)
        let profileId: string | undefined;
        if (me.$isLoaded && me.profile) {
          const profile: any = me.profile as any;
          if (
            typeof profile === "string" &&
            (profile as string).startsWith("co_")
          ) {
            profileId = profile as string;
          } else if (
            typeof profile === "object" &&
            profile &&
            "$jazz" in profile &&
            profile.$jazz?.id
          ) {
            profileId = profile.$jazz.id;
          }
        }

        if (profileId && currentNode) {
          // Check if profile is already in directChildren
          const hasProfile = context.directChildren.some(
            (c) => c.coValueId === profileId,
          );
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
                const profileResolved = await resolveCoValue(
                  profileId,
                  currentNode,
                );
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
                  // Update context in navigation stack to trigger reactivity
                  if (
                    navigationStack.length > 0 &&
                    navigationStack[0]?.type === "covalue"
                  ) {
                    navigationStack = [
                      { ...navigationStack[0], context: { ...context } },
                    ];
                  }
                }
              } catch (_e) {}
            })();
          }
        }

        navigationStack = [
          { type: "covalue", label: "DB", coValueId: rootId, context },
        ];
      } catch (_e) {
      } finally {
        isLoading = false;
      }
    })();
  });

  // Navigate to a CoValue (non-blocking - update UI immediately)
  async function navigateToCoValue(
    coValueId: CoID<RawCoValue>,
    label?: string,
  ) {
    const currentNode = node();
    if (!currentNode) return;

    // Update navigation stack immediately (non-blocking UI)
    const newLabel = label || `${coValueId.slice(0, 8)}...`;
    // Add placeholder context (will be updated when loaded)
    navigationStack = [
      ...navigationStack,
      { type: "covalue", label: newLabel, coValueId, context: null as any },
    ];

    // Load context in background (non-blocking)
    (async () => {
      try {
        const context = await navigateToCoValueContext(coValueId, currentNode);
        // Update the context in the navigation stack
        const updatedStack = [...navigationStack];
        const lastIndex = updatedStack.length - 1;
        if (updatedStack[lastIndex]?.type === "covalue") {
          updatedStack[lastIndex] = { ...updatedStack[lastIndex], context };
        }
        navigationStack = updatedStack;
      } catch (_e) {
        // Revert navigation stack on error
        navigationStack = navigationStack.slice(0, -1);
      }
    })();
  }

  // Navigate to an object (push new context)
  function navigateToObject(
    object: any,
    label: string,
    parentCoValue: any,
    parentKey: string,
  ) {
    // Store the current context as parent context for metadata display
    const parentContext = currentContext();
    if (!parentContext) {
      return;
    }
    navigationStack = [
      ...navigationStack,
      {
        type: "object",
        object,
        label,
        parentCoValue,
        parentKey,
        parentContext,
      },
    ];
  }

  // Navigate back (non-blocking)
  async function navigateBack() {
    if (navigationStack.length <= 1) return;

    const currentNode = node();
    if (!currentNode) return;

    // Update stack immediately
    navigationStack = navigationStack.slice(0, -1);
    const previous = navigationStack[navigationStack.length - 1];

    // Load previous context in background (if it's a covalue and doesn't have context yet)
    if (previous.type === "covalue" && !previous.context) {
      (async () => {
        try {
          const context = await navigateToCoValueContext(
            previous.coValueId,
            currentNode,
          );
          // Update the context in the navigation stack
          const updatedStack = [...navigationStack];
          const lastIndex = updatedStack.length - 1;
          if (updatedStack[lastIndex]?.type === "covalue") {
            updatedStack[lastIndex] = { ...updatedStack[lastIndex], context };
          }
          navigationStack = updatedStack;
        } catch (_e) {}
      })();
    }
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
    if (target.type === "covalue") {
      (async () => {
        try {
          const context = await navigateToCoValueContext(
            target.coValueId,
            currentNode,
          );
          // Update the context in the navigation stack
          const updatedStack = [...navigationStack];
          const targetIndex = updatedStack.findIndex(
            (item) =>
              item.type === "covalue" && item.coValueId === target.coValueId,
          );
          if (
            targetIndex !== -1 &&
            updatedStack[targetIndex]?.type === "covalue"
          ) {
            updatedStack[targetIndex] = {
              ...updatedStack[targetIndex],
              context,
            };
          }
          navigationStack = updatedStack;
        } catch (_e) {}
      })();
    }
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
            <span class="text-sm font-semibold text-slate-900"
              >{item.label}</span
            >
          {/if}
        {/each}
      </div>

      <!-- Two-column layout: Main + Metadata -->
      <div class="flex gap-6 items-start">
        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          {#if currentObjectContext()}
            <!-- Object context view -->
            {@const objCtx = currentObjectContext()!}
            <ObjectContextDisplay object={objCtx.object} label={objCtx.label} />
          {:else if currentContext()}
            <!-- CoValue context view -->
            {@const ctx = currentContext()!}
            <Context
              context={ctx}
              node={node()}
              onNavigate={(coValueId, label) =>
                navigateToCoValue(coValueId as CoID, label)}
              onObjectNavigate={navigateToObject}
              onBack={navigationStack.length > 1 ? navigateBack : undefined}
              view="list"
            />
          {:else}
            <!-- Loading or no context -->
            <div class="text-center pt-8 pb-4">
              <p class="text-slate-500">Loading...</p>
            </div>
          {/if}
        </div>

        <!-- Right Aside: Metadata (show for CoValue contexts and objects - use parent context for objects) -->
        {#if currentContext() || currentObjectContext()}
          {@const ctx = currentContext()}
          {@const objCtx = currentObjectContext()}
          {@const metadataContext = ctx || objCtx?.parentContext}
          {#if metadataContext}
            <div class="w-80 shrink-0">
              <aside class="sticky top-6">
                <!-- Metadata Title (matching main content header spacing exactly) -->
                <div class="mb-6">
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
                <MetadataSidebar
                  context={metadataContext}
                  node={node()}
                  {currentAccount}
                  onNavigate={(coValueId, label) =>
                    navigateToCoValue(coValueId as CoID, label)}
                />
              </aside>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>
