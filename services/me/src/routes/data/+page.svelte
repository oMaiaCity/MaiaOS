<script lang="ts">
  import { JazzAccount, getCoValueGroupInfo, setupComputedFieldsForCoValue } from "@hominio/data";
  import { AccountCoState } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";
  import {
    RootDataDisplay,
    MetadataSidebar,
    CoValueContextDisplay,
    GroupContextView,
    DataLayout,
  } from "$lib/components";
  import ObjectContextDisplay from "$lib/components/composites/ObjectContextDisplay.svelte";
  import { extractRootData } from "$lib/utilities";
  import { Group } from "jazz-tools";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Load Jazz account - Better Auth Jazz plugin automatically sets up the account
  // AccountCoState will use the current account from the Jazz provider
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      profile: true, // Resolve profile to access all its properties
      root: {
        contact: true, // Resolve contact CoMap
        capabilities: true,
        data: true, // Resolve data (list of SchemaDefinitions with entities)
      },
    },
  });
  const me = $derived(account.current);

  // Set up computed fields for profile when it's loaded
  // This ensures name is computed from firstName + lastName
  $effect(() => {
    if (me.$isLoaded && me.profile?.$isLoaded) {
      setupComputedFieldsForCoValue(me.profile);
    }
  });

  // Navigation context type
  type NavigationContext =
    | { type: "root" }
    | { type: "colist"; coValue: any; label: string; parentKey?: string }
    | { type: "covalue"; coValue: any; label: string; parentContext?: NavigationContext }
    | { type: "group"; coValue: any; label: string }
    | { type: "object"; object: any; label: string; parentCoValue: any; parentKey: string };

  // Navigation stack - tracks the path through CoValues
  let navigationStack = $state<NavigationContext[]>([{ type: "root" }]);

  // Current context is the last item in the stack
  const currentContext = $derived(navigationStack[navigationStack.length - 1]);

  // Helper function to get display label for a CoValue
  function getCoValueLabel(coValue: any, fallbackKey?: string): string {
    if (!coValue || !coValue.$isLoaded) {
      return fallbackKey || "Loading...";
    }
    // Try to get @label, but handle cases where has() might not be available
    try {
      if (coValue.$jazz && typeof coValue.$jazz.has === "function" && coValue.$jazz.has("@label")) {
        return coValue["@label"];
      }
    } catch (e) {
      // Ignore errors - fall through to fallback
    }
    // Use fallback key if provided, otherwise use ID
    if (fallbackKey) {
      return fallbackKey;
    }
    try {
      return coValue.$jazz?.id?.slice(0, 8) + "..." || "CoValue";
    } catch (e) {
      return "CoValue";
    }
  }

  // Helper function to check if a co-value is a Group
  function isGroup(coValue: any): boolean {
    if (!coValue || !coValue.$isLoaded) return false;
    try {
      // Check for Group-specific properties
      return (
        "members" in coValue ||
        typeof (coValue as any).getMemberKeys === "function" ||
        typeof (coValue as Group).getParentGroups === "function" ||
        typeof (coValue as Group).myRole === "function"
      );
    } catch (e) {
      return false;
    }
  }

  // Helper function to extract Group from Capability
  async function extractGroupFromCapability(capability: any): Promise<any> {
    if (!capability) return null;
    try {
      // Ensure capability is loaded
      if (!capability.$isLoaded && capability.$jazz?.ensureLoaded) {
        await capability.$jazz.ensureLoaded({ resolve: { group: true } });
      }

      if (!capability.$isLoaded) return null;

      // Check if it's a Capability schema with a group field
      if (capability.$jazz?.has && capability.$jazz.has("group")) {
        let group = capability.group;

        // If group is just an ID (CoID), we need to load it
        if (typeof group === "string") {
          // It's a CoID, need to load the Group
          const { CoState } = await import("jazz-tools/svelte");
          const groupState = new CoState(Group, group);
          group = groupState.current;
        }

        // Ensure group is loaded
        if (group && !group.$isLoaded && group.$jazz?.ensureLoaded) {
          await group.$jazz.ensureLoaded();
        }
        return group;
      }
      // If it's already a Group, return it
      if (isGroup(capability)) {
        // Ensure it's loaded
        if (!capability.$isLoaded && capability.$jazz?.ensureLoaded) {
          await capability.$jazz.ensureLoaded();
        }
        return capability;
      }
      return null;
    } catch (e) {
      console.warn("Error extracting group from capability:", e);
      return null;
    }
  }

  // Navigate to a CoValue (push new context)
  async function navigateToCoValue(coValue: any, label?: string, fallbackKey?: string) {
    // Check if it's a Capability - extract the Group
    const group = await extractGroupFromCapability(coValue);
    if (group) {
      const displayLabel = label || getCoValueLabel(group, fallbackKey || "Group");
      navigationStack = [
        ...navigationStack,
        { type: "group", coValue: group, label: displayLabel },
      ];
      return;
    }

    // Check if it's a Group
    if (isGroup(coValue)) {
      // Ensure Group is loaded
      if (!coValue.$isLoaded && coValue.$jazz?.ensureLoaded) {
        await coValue.$jazz.ensureLoaded();
      }
      const displayLabel = label || getCoValueLabel(coValue, fallbackKey || "Group");
      navigationStack = [...navigationStack, { type: "group", coValue, label: displayLabel }];
      return;
    }

    // Otherwise, treat as regular CoValue
    // If it's a string (CoID), we'll let CoValueContextDisplay handle loading it
    // Otherwise, ensure it's loaded (nested properties will be loaded on-demand via useResolvedCoValue)
    if (typeof coValue !== "string" && !coValue.$isLoaded && coValue.$jazz?.ensureLoaded) {
      await coValue.$jazz.ensureLoaded();
    }

    const displayLabel = label || getCoValueLabel(coValue, fallbackKey);
    navigationStack = [...navigationStack, { type: "covalue", coValue, label: displayLabel }];
  }

  // Navigate to a CoList (push new context)
  function navigateToCoList(coList: any, label: string, parentKey?: string) {
    navigationStack = [...navigationStack, { type: "colist", coValue: coList, label, parentKey }];
  }

  // Navigate to an object (push new context)
  function navigateToObject(object: any, label: string, parentCoValue: any, parentKey: string) {
    navigationStack = [
      ...navigationStack,
      { type: "object", object, label, parentCoValue, parentKey },
    ];
  }

  // Navigate back one level
  function navigateBack() {
    if (navigationStack.length > 1) {
      navigationStack = navigationStack.slice(0, -1);
    }
  }

  // Get current CoValue for metadata sidebar (exclude groups - they have their own view)
  // For objects, show parent CoValue metadata
  const selectedCoValue = $derived(() => {
    if (currentContext.type === "root") {
      // Show AppRoot metadata when viewing root
      return me.$isLoaded && me.root ? me.root : null;
    }
    if (currentContext.type === "covalue" || currentContext.type === "colist") {
      return currentContext.coValue;
    }
    if (currentContext.type === "object") {
      // For objects, show parent CoValue metadata
      return currentContext.parentCoValue;
    }
    // Groups don't show metadata sidebar
    return null;
  });

  // Use centralized extraction utility from lib/logic/coValueExtractor.ts
  // All property extraction logic has been moved there for DRY architecture

  // Get root data - use centralized extractRootData()
  const rootData = $derived(() => {
    if (!me.$isLoaded || !me.root?.$isLoaded) {
      return null;
    }
    return extractRootData(me.root);
  });
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
  {:else if !me.$isLoaded}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading your account...</p>
    </div>
  {:else if me.$isLoaded}
    {@const leftTitle = currentContext.type === "root" ? "My Data" : currentContext.label}

    <DataLayout
      {leftTitle}
      leftIconType={currentContext.type}
      rightTitle={currentContext.type !== "group" ? "Metadata" : undefined}
      showRightIcon={currentContext.type !== "group"}
      showBack={navigationStack.length > 1}
      onBack={navigateBack}
    >
      {#snippet main()}
        {#if currentContext.type === "root"}
          {#if rootData()}
            <RootDataDisplay
              rootData={rootData()}
              rootCoValue={me.root}
              onSelect={(coValue: any) => {
                navigateToCoValue(coValue);
              }}
              onCoListClick={(coList: any, label: string, parentKey?: string) => {
                navigateToCoList(coList, label, parentKey);
              }}
            />
          {:else if me.$isLoaded && me.root && !me.root.$isLoaded}
            <div class="text-center py-8">
              <p class="text-sm text-slate-500">Loading root...</p>
            </div>
          {:else}
            <div class="text-center py-8">
              <p class="text-sm text-slate-500">Root not available</p>
            </div>
          {/if}
        {:else if currentContext.type === "group"}
          <GroupContextView group={currentContext.coValue} onNavigate={navigateToCoValue} />
        {:else if currentContext.type === "colist" || currentContext.type === "covalue"}
          <CoValueContextDisplay
            coValue={currentContext.coValue}
            node={me?.$jazz?.raw?.core?.node}
            onNavigate={navigateToCoValue}
            onObjectNavigate={navigateToObject}
          />
        {:else if currentContext.type === "object"}
          <ObjectContextDisplay object={currentContext.object} label={currentContext.label} />
        {/if}
      {/snippet}
      {#snippet aside()}
        {#if currentContext.type !== "group"}
          <MetadataSidebar selectedCoValue={selectedCoValue()} currentAccount={me} />
        {/if}
      {/snippet}
    </DataLayout>
  {/if}
</div>
