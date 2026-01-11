<script lang="ts">
  import { browser } from "$app/environment";
  import {
    type CoValueContext,
  } from "@maia/db";
  import { executeSkill, registerAllSkills } from "$lib/compositor/skills";
  import type { CoID, RawCoValue } from "cojson";
  import { CoState } from "jazz-tools/svelte";
  import { CoMap } from "jazz-tools";
  import { authClient } from "$lib/auth-client";
  import { getJazzAccountContext } from "$lib/utils/jazz-account-context";
  import ObjectContextDisplay from "$lib/components/data-explorer/ObjectContextDisplay.svelte";
  import { Context, MetadataSidebar } from "$lib/components/data-explorer";
  import { deriveContextFromCoState } from "$lib/utils/costate-navigation";

  // Register all skills on page load (only in browser to avoid SSR issues)
  if (browser) {
    registerAllSkills();
  }

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Get global Jazz account from context
  const account = getJazzAccountContext();
  const me = $derived(account ? account.current : null);
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
  // Uses property paths for reactive navigation within the root
  type NavigationItem =
    | {
        type: "root-property"; // Direct property of root (like schemata, entities)
        label: string;
        propertyPath: string[]; // Path from root, e.g., ["schemata"] or ["entities"]
      }
    | {
        type: "covalue";
        label: string;
        coValueId: CoID<RawCoValue>;
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

  // GLOBAL CoState Registry: ONE CoState instance per unique CoID (singleton pattern)
  // This ensures all references to the same CoValue share the same reactive subscription
  let coValueStates = $state<Map<CoID<RawCoValue>, CoState<typeof CoMap>>>(
    new Map(),
  );

  // Create or reuse CoState instances reactively for all CoValues in navigation stack
  // KEY: We REUSE existing CoStates to share subscriptions across the app
  $effect(() => {
    const newStates = new Map<CoID<RawCoValue>, CoState<typeof CoMap>>();

    for (const item of navigationStack) {
      if (item.type === "covalue") {
        // Check if CoState already exists (SINGLETON PATTERN)
        let coValueState = coValueStates.get(item.coValueId);
        if (!coValueState) {
          try {
            // Create new CoState ONLY if it doesn't exist
            // Use universal resolve query that works for all CoValue types
            // [] subscribes to array changes (works for CoLists and is ignored for CoMaps)
            coValueState = new CoState(CoMap, item.coValueId, []);
          } catch (e) {
            console.error(
              "[Navigation] Failed to create CoState for:",
              item.coValueId,
              e,
            );
            continue;
          }
        }
        // Store in new map (reuse existing or new)
        newStates.set(item.coValueId, coValueState);
      }
    }

    // Only update if there are actual changes (prevent infinite loop!)
    if (
      newStates.size !== coValueStates.size ||
      Array.from(newStates.keys()).some((id) => !coValueStates.has(id))
    ) {
      coValueStates = newStates;
    }
  });

  // Current context is derived reactively from CoState (reactive updates)
  const currentContext = $derived.by(() => {
    if (navigationStack.length === 0 || !me) return null;

    const lastItem = navigationStack[navigationStack.length - 1];

    // Handle root properties (like schemata, entities) - access directly from root
    if (
      lastItem.type === "root-property" &&
      me.$isLoaded &&
      me.root?.$isLoaded
    ) {
      const propertyPath = lastItem.propertyPath;
      let current: any = me.root;

      // Navigate to the property
      for (const key of propertyPath) {
        current = current[key];
        if (!current) return null;
      }

      // Get CoID from the property
      const coValueId = current.$jazz?.id;
      if (!coValueId) return null;

      // Derive context from the LIVE property reference (reactive!)
      // This reuses the root's subscription, ensuring reactivity
      const rawValue = current.$jazz.raw;
      const type = rawValue.type as
        | "comap"
        | "costream"
        | "colist"
        | "coplaintext";
      const snapshot = rawValue.toJSON() as Record<string, any>;

      return {
        coValueId,
        resolved: {
          value: rawValue,
          snapshot,
          type,
          extendedType: undefined,
          id: coValueId,
          groupId: undefined,
          headerMeta: undefined,
        },
        directChildren: [],
      };
    }

    if (lastItem.type === "covalue") {
      // Get CoState from map (created reactively in $effect)
      const coValueState = coValueStates.get(lastItem.coValueId);
      if (!coValueState) return null;

      // Derive context reactively from CoState
      return deriveContextFromCoState(coValueState, lastItem.coValueId);
    }
    // For objects, return null (we'll handle rendering separately)
    return null;
  });

  // Current object context (for object navigation)
  const currentObjectContext = $derived.by(() => {
    if (navigationStack.length === 0) return null;
    const lastItem = navigationStack[navigationStack.length - 1];
    if (lastItem.type === "object") {
      return lastItem;
    }
    return null;
  });

  let isLoading = $state(false);

  // Initialize with root context using CoState (reactive)
  $effect(() => {
    if (!me) return;
    const rootId =
      me.$isLoaded && me.root?.$isLoaded ? me.root.$jazz?.id : undefined;
    if (!rootId || navigationStack.length > 0) return; // Load root context

    isLoading = true;

    // Add root to navigation stack (CoState will be created reactively)
    navigationStack = [
      {
        type: "covalue",
        label: "DB",
        coValueId: rootId,
      },
    ];

    isLoading = false;
  });

  // Navigate to a CoValue using CoState (reactive - updates automatically)
  function navigateToCoValue(coValueId: CoID<RawCoValue>, label?: string) {
    const newLabel = label || `${coValueId.slice(0, 8)}...`;

    // UNIVERSAL ID-BASED NAVIGATION with smart property-path detection
    // Check if this CoValue is already loaded via root (reuse root's subscription)
    if (me && me.$isLoaded && me.root?.$isLoaded) {
      // Check ALL root properties (not just from root navigation)
      const rootProperties = [
        "schemata",
        "entities",
        "contact",
      ];
      const matchingProperty = rootProperties.find((prop) => {
        const propValue = (me.root as any)[prop];
        return propValue && propValue.$jazz?.id === coValueId;
      });

      if (matchingProperty) {
        // This CoValue is a root property - use property-path to reuse root's subscription
        navigationStack = [
          ...navigationStack,
          {
            type: "root-property",
            label: newLabel,
            propertyPath: [matchingProperty],
          },
        ];
        return;
      }
    }

    // For all other CoValues: Use ID-based navigation with singleton CoState registry
    // The singleton ensures we don't create duplicate subscriptions for the same ID
    navigationStack = [
      ...navigationStack,
      { type: "covalue", label: newLabel, coValueId },
    ];
  }

  // Navigate to an object (push new context)
  function navigateToObject(
    object: any,
    label: string,
    parentCoValue: any,
    parentKey: string,
  ) {
    // Store the current context as parent context for metadata display
    const parentContext = currentContext;
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

  // Navigate back (reactive - CoState handles updates automatically)
  function navigateBack() {
    if (navigationStack.length <= 1) return;

    // Update stack immediately (contexts are derived reactively from CoState)
    navigationStack = navigationStack.slice(0, -1);
  }

  // Navigate to a specific item in the breadcrumb (reactive - CoState handles updates)
  // Instead of resetting the stack, append the item to continue the navigation history
  function navigateToBreadcrumb(index: number) {
    const target = navigationStack[index];
    if (!target) return;

    // Append the target item to the stack (continue history instead of resetting)
    if (target.type === "covalue") {
      navigateToCoValue(target.coValueId, target.label);
    } else if (target.type === "object") {
      navigateToObject(
        target.object,
        target.label,
        target.parentCoValue,
        target.parentKey,
      );
    } else if (target.type === "root-property") {
      // For root properties, we need to navigate via the property path
      // Get the actual CoValue from the root
      if (me && me.$isLoaded && me.root?.$isLoaded) {
        let current: any = me.root;
        for (const key of target.propertyPath) {
          current = current[key];
          if (!current) return;
        }
        const coValueId = current.$jazz?.id;
        if (coValueId) {
          navigateToCoValue(coValueId, target.label);
        }
      }
    }
  }

  // Handle reset data
  async function handleResetData() {
    if (!account || !me || !me.$isLoaded) return;

    try {
      console.log('[DB Page] Starting database reset...');
      await executeSkill('@database/resetDatabase', account);
      console.log('[DB Page] ✅ Database reset complete!');
      console.log('[DB Page] 📋 Reload the page manually to see changes.');
    } catch (error) {
      console.error("[DB Page] Error resetting data:", error);
    }
  }

  // Handle creating "assigned" Relation instance
  async function handleCreateAssignedToComposite() {
    if (!account || !me || !me.$isLoaded) return;

    try {
      // Ensure root is loaded
      const root = me.root;
      if (!root?.$isLoaded) {
        await me.$jazz.ensureLoaded({ resolve: { root: true } });
      }

      // Create new Todo and Human entities for testing
      await executeSkill('@entity/createEntity', account, {
        schemaName: 'Todo',
        entityData: {
          name: "test todo for assigned relation",
          status: "todo",
          endDate: new Date("2025-12-31").toISOString(),
          duration: 30,
        },
      });

      await executeSkill('@entity/createEntity', account, {
        schemaName: 'Human',
        entityData: {
          name: "Test Human",
          email: "test@example.com",
        },
      });

      // Wait a bit for entities to sync, then find them
      await new Promise(resolve => setTimeout(resolve, 200));

      // Reload root to get latest entities
      const reloadedRoot = await me.root.$jazz.ensureLoaded({
        resolve: { entities: true },
      });

      if (!reloadedRoot.entities?.$isLoaded) {
        throw new Error('Entities list not loaded');
      }

      let todoEntity: any = null;
      let humanEntity: any = null;

      for (const entity of reloadedRoot.entities) {
        if (!entity?.$isLoaded) continue;
        const snapshot = entity.$jazz?.raw?.toJSON();
        if (snapshot?.name === "test todo for assigned relation") {
          todoEntity = entity;
        } else if (snapshot?.name === "Test Human") {
          humanEntity = entity;
        }
      }

      if (!todoEntity || !humanEntity) {
        throw new Error('Could not find created entities');
      }

      // Create Relation instance relating Todo to Human
      await executeSkill('@relation/createRelation', account, {
        schemaName: 'AssignedTo',
        relationData: {
          x1: todoEntity,
          x2: humanEntity,
        },
      });

      console.log('Relation created successfully!');
      // Mutations are reactive - CoState will automatically update
      // No need to manually clear cache or reload
    } catch (error) {
      console.error("Error creating 'assigned' Relation:", error);
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
</script>

<div class="w-full h-full overflow-y-auto max-w-7xl mx-auto p-8">
  {#if isBetterAuthPending}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading...</p>
    </div>
  {:else if !isBetterAuthSignedIn}
    <div class="text-center pt-8 pb-4">
      <h1 class="text-4xl font-bold text-slate-700 mb-4">Welcome</h1>
      <p class="text-slate-500 mb-6">Please sign in to access your data.</p>
    </div>
  {:else if !currentContext && !currentObjectContext && isLoading}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading context...</p>
    </div>
  {:else if !currentContext && !currentObjectContext}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">No context available</p>
    </div>
  {:else if currentContext && currentContext.resolved.snapshot === undefined}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading...</p>
    </div>
  {:else if currentContext || currentObjectContext}
    <div>
      <!-- Three-column layout: Navigation Stack + Main + Metadata -->
      <div class="flex gap-6 items-start">
        <!-- Left Aside: Navigation Stack -->
        {#if navigationStack.length > 0}
          <div class="w-24 shrink-0">
            <aside class="sticky top-6">
              <!-- Tab (matching main area style, centered) -->
              <div
                class="flex items-end justify-center gap-1 mb-0 -mb-px relative z-10"
              >
                <button
                  type="button"
                  class="text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-t-lg transition-colors border border-b-0 bg-[var(--color-card-bg)] border-[var(--color-card-border)] text-slate-700"
                  style="border-bottom: none;"
                  disabled
                >
                  Nav
                </button>
              </div>

              <!-- Card Container (matching main area) -->
              <div class="card">
                <!-- Internal Header with Back Button -->
                {#if navigationStack.length > 1}
                  <div class="px-3 py-2 border-b border-slate-200">
                    <button
                      type="button"
                      onclick={navigateBack}
                      class="w-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1 px-2 text-[10px] rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1"
                    >
                      <svg
                        class="w-2.5 h-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      Back
                    </button>
                  </div>
                {/if}

                <!-- Content Area with Navigation History (styled like list items) -->
                <div class="p-1.5 space-y-0.5">
                  {#each [...navigationStack]
                    .reverse()
                    .map( (item, reverseIndex) => ({ item, originalIndex: navigationStack.length - 1 - reverseIndex }), )
                    .filter((entry, idx, arr) => {
                      // Filter out consecutive duplicates (same label as previous item)
                      if (idx === 0) return true;
                      return entry.item.label !== arr[idx - 1].item.label;
                    }) as navEntry}
                    {@const isActive =
                      navEntry.originalIndex === navigationStack.length - 1}
                    <button
                      type="button"
                      onclick={() =>
                        navigateToBreadcrumb(navEntry.originalIndex)}
                      class="w-full text-left px-1.5 py-1 rounded-xl text-[10px] transition-colors border {isActive
                        ? 'bg-slate-100 text-slate-900 font-medium border-slate-200 shadow-[0_0_4px_rgba(0,0,0,0.02)]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent hover:border-slate-200'}"
                    >
                      <div class="truncate">{navEntry.item.label}</div>
                    </button>
                  {/each}
                </div>
              </div>
            </aside>
          </div>
        {/if}

        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          {#if currentObjectContext}
            <!-- Object context view -->
            <ObjectContextDisplay
              object={currentObjectContext.object}
              label={currentObjectContext.label}
            />
          {:else if currentContext}
            <!-- CoValue context view -->
            {@const lastItem =
              navigationStack.length > 0
                ? navigationStack[navigationStack.length - 1]
                : null}
            {@const ctxCoValueState =
              lastItem && lastItem.type === "covalue"
                ? coValueStates.get(lastItem.coValueId)
                : lastItem && lastItem.type === "root-property"
                  ? account // Use root's CoState for root properties (reactive!)
                  : undefined}
            {@const ctxPropertyPath =
              lastItem && lastItem.type === "root-property"
                ? ["root", ...lastItem.propertyPath]
                : undefined}
            <Context
              context={currentContext}
              coValueState={ctxCoValueState}
              propertyPath={ctxPropertyPath}
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
        {#if currentContext || currentObjectContext}
          {@const metadataContext =
            currentContext || currentObjectContext?.parentContext}
          {#if metadataContext}
            <div class="w-80 shrink-0">
              <aside class="sticky top-6">
                <MetadataSidebar
                  context={metadataContext}
                  node={node()}
                  {currentAccount}
                  onNavigate={(coValueId, label) =>
                    navigateToCoValue(coValueId as CoID, label)}
                />

                <!-- Action Buttons -->
                <div class="mt-6 pt-6 border-t border-slate-200">
                  <div class="flex flex-col gap-2">
                    <button
                      onclick={() => handleCreateAssignedToComposite()}
                      class="w-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-4 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Create "assigned" Relation
                    </button>
                    <button
                      onclick={() => handleResetData()}
                      class="w-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-4 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Reset Data
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>
