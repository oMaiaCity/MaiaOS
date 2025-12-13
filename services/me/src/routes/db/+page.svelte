<script lang="ts">
  import {
    type CoValueContext,
    JazzAccount,
    resetData,
    createHumanLeafType,
    createTodoLeafType,
    createHumanLeaf,
    createTodoLeaf,
    createAssignedToCompositeType,
    createAssignedToComposite,
  } from "@hominio/db";
  import type { CoID, RawCoValue } from "cojson";
  import { AccountCoState, CoState } from "jazz-tools/svelte";
  import { CoMap } from "jazz-tools";
  import { authClient } from "$lib/auth-client";
  import ObjectContextDisplay from "$lib/components/data-explorer/ObjectContextDisplay.svelte";
  import { Context, MetadataSidebar } from "$lib/components/data-explorer";
  import { deriveContextFromCoState } from "$lib/utils/costate-navigation";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Load Jazz account with deep resolve query for reactive CoLists
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        // Load root's CoLists deeply so they react to new items
        schemata: { $each: true }, // Load all schema items + subscribe to changes
        entities: { $each: true }, // Load all entity items + subscribe to changes
        capabilities: true, // Load capabilities list
      },
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
    if (navigationStack.length === 0) return null;

    const lastItem = navigationStack[navigationStack.length - 1];

    // Handle root properties (like schemata, entities) - access directly from root
    if (
      lastItem.type === "root-property" &&
      me.$isLoaded &&
      me.root.$isLoaded
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
    if (me.$isLoaded && me.root.$isLoaded) {
      // Check ALL root properties (not just from root navigation)
      const rootProperties = [
        "schemata",
        "entities",
        "capabilities",
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
      if (me.$isLoaded && me.root.$isLoaded) {
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
    if (!me.$isLoaded) return;

    try {
      await resetData(me);
      // Mutations are reactive - CoState will automatically update
      // No need to manually clear cache or reload
    } catch (_error) {
      console.error("Error resetting data:", _error);
    }
  }

  // Handle creating Human LeafType
  async function handleCreateHumanLeafType() {
    if (!me.$isLoaded) return;

    try {
      await createHumanLeafType(me);
      // Mutations are reactive - CoState will automatically update
      // No need to manually clear cache or reload
    } catch (error) {
      console.error("Error creating Human LeafType:", error);
    }
  }

  // Handle creating Todo LeafType
  async function handleCreateTodoLeafType() {
    if (!me.$isLoaded) return;

    try {
      await createTodoLeafType(me);
      // Mutations are reactive - CoState will automatically update
      // No need to manually clear cache or reload
    } catch (error) {
      console.error("Error creating Todo LeafType:", error);
    }
  }

  // Handle creating Sam Human Leaf
  async function handleCreateSamHuman() {
    if (!me.$isLoaded) return;

    try {
      await createHumanLeaf(me, {
        id: "human_sam",
        name: "Sam",
        email: "sam@example.com",
        dateOfBirth: new Date("1990-01-15"),
      });
      // Mutations are reactive - CoState will automatically update
      // No need to manually clear cache or reload
    } catch (error) {
      console.error("Error creating Sam Human Leaf:", error);
    }
  }

  // Handle creating "eat banana" Todo Leaf
  async function handleCreateEatBananaTodo() {
    if (!me.$isLoaded) return;

    try {
      await createTodoLeaf(me, {
        id: "todo_eat_banana",
        name: "eat banana",
        status: "todo",
        priority: "medium",
        dueDate: new Date("2025-12-31"),
      });
      // Mutations are reactive - CoState will automatically update
      // No need to manually clear cache or reload
    } catch (error) {
      console.error("Error creating 'eat banana' Todo Leaf:", error);
    }
  }

  // Handle creating "assigned" CompositeType
  async function handleCreateAssignedToCompositeType() {
    if (!me.$isLoaded) return;

    try {
      await createAssignedToCompositeType(me);
      // Mutations are reactive - CoState will automatically update
      // No need to manually clear cache or reload
    } catch (error) {
      console.error("Error creating 'assigned' CompositeType:", error);
    }
  }

  // Handle creating "assigned" Composite instance
  async function handleCreateAssignedToComposite() {
    if (!me.$isLoaded) return;

    try {
      // First, ensure the CompositeType exists
      await createAssignedToCompositeType(me);

      // Create new Todo and Human entities for testing (simplified - no lookup needed)
      const todoEntity = await createTodoLeaf(me, {
        id: "todo_test_assigned",
        name: "test todo for assigned relation",
        status: "todo",
        priority: "medium",
      });

      const humanEntity = await createHumanLeaf(me, {
        id: "human_test_assigned",
        name: "Test Human",
        email: "test@example.com",
      });

      // Create Composite instance relating Todo to Human
      await createAssignedToComposite(me, {
        x1: todoEntity,
        x2: humanEntity,
      });
      // Mutations are reactive - CoState will automatically update
      // No need to manually clear cache or reload
    } catch (error) {
      console.error("Error creating 'assigned' Composite:", error);
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
              <!-- Back Button -->
              {#if navigationStack.length > 1}
                <button
                  type="button"
                  onclick={navigateBack}
                  class="w-full mb-3 bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-2 text-xs rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1"
                >
                  <svg
                    class="w-3 h-3"
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
              {/if}

              <!-- Navigation History (newest at top) -->
              <div class="space-y-1">
                <div class="text-[10px] font-semibold text-slate-500 uppercase mb-2 px-2">
                  Nav
                </div>
                {#each [...navigationStack].reverse() as item, reverseIndex}
                  {@const index = navigationStack.length - 1 - reverseIndex}
                  {@const isActive = index === navigationStack.length - 1}
                  <button
                    type="button"
                    onclick={() => navigateToBreadcrumb(index)}
                    class="w-full text-left px-2 py-1.5 rounded text-xs transition-colors {isActive
                      ? 'bg-slate-100 text-slate-900 font-medium border border-slate-300'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'}"
                  >
                    <div class="truncate">{item.label}</div>
                  </button>
                {/each}
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

                <!-- Action Buttons -->
                <div class="mt-6 pt-6 border-t border-slate-200">
                  <div class="flex flex-col gap-2">
                    <!-- Milestone 1: LeafTypes -->
                    <div
                      class="text-xs font-semibold text-slate-500 uppercase mb-1"
                    >
                      Milestone 1: LeafTypes
                    </div>
                    <button
                      onclick={() => handleCreateHumanLeafType()}
                      class="w-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-4 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Create Human LeafType
                    </button>
                    <button
                      onclick={() => handleCreateTodoLeafType()}
                      class="w-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-4 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Create Todo LeafType
                    </button>

                    <!-- Milestone 2: Leafs -->
                    <div
                      class="text-xs font-semibold text-slate-500 uppercase mb-1 mt-4"
                    >
                      Milestone 2: Leafs
                    </div>
                    <button
                      onclick={() => handleCreateSamHuman()}
                      class="w-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-4 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Create Sam (Human)
                    </button>
                    <button
                      onclick={() => handleCreateEatBananaTodo()}
                      class="w-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-4 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Create "eat banana" (Todo)
                    </button>

                    <!-- Milestone 3: CompositeTypes -->
                    <div
                      class="text-xs font-semibold text-slate-500 uppercase mb-1 mt-4"
                    >
                      Milestone 3: CompositeTypes
                    </div>
                    <button
                      onclick={() => handleCreateAssignedToCompositeType()}
                      class="w-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-4 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Create "assigned" CompositeType
                    </button>

                    <!-- Milestone 4: Composites -->
                    <div
                      class="text-xs font-semibold text-slate-500 uppercase mb-1 mt-4"
                    >
                      Milestone 4: Composites
                    </div>
                    <button
                      onclick={() => handleCreateAssignedToComposite()}
                      class="w-full bg-[#002455] hover:bg-[#002455] border border-[#001a3d] text-white py-1.5 px-4 text-sm rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Create "assigned" Composite
                    </button>

                    <!-- Existing Actions -->
                    <div
                      class="text-xs font-semibold text-slate-500 uppercase mb-1 mt-4"
                    >
                      Existing
                    </div>
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
