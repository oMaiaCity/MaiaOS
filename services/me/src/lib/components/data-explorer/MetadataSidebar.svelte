<script lang="ts">
  import type { CoValueContext } from "@hominio/data";
  import {
    getCoValueGroupInfo,
    resolveProfile,
    formatCoValueId,
  } from "@hominio/data";
  import type { LocalNode } from "cojson";
  import { CoMap } from "jazz-tools";
  import { CoState, Image } from "jazz-tools/svelte";
  import Badge from "./Badge.svelte";
  import PropertyItem from "./PropertyItem.svelte";

  interface Props {
    context: CoValueContext;
    node?: LocalNode;
    currentAccount?: any; // Current Jazz account for profile resolution
  }

  const { context, node, currentAccount }: Props = $props();

  // Tab state: "members" (default) or "info"
  let activeTab = $state<"members" | "info">("members");

  // Get display type
  const displayType = $derived(
    context.resolved.extendedType || context.resolved.type || "CoValue",
  );

  // Get group ID from resolved context
  const groupId = $derived(context.resolved.groupId);

  // Sort account members: "everyone" always first, then others
  const sortedAccountMembers = $derived.by(() => {
    if (!groupInfo?.accountMembers) return [];
    const members = [...groupInfo.accountMembers];
    return members.sort((a, b) => {
      if (a.id === "everyone") return -1;
      if (b.id === "everyone") return 1;
      return 0;
    });
  });

  // Load the actual CoValue to get group info (like JazzMetadata.svelte does)
  let loadedCoValue = $state<any>(null);
  let groupInfo = $state<{
    accountMembers: Array<{ id: string; role: string }>;
    groupMembers: Array<{ id: string; role: string }>;
  } | null>(null);

  // Load CoValue using Jazz's CoState (like legacy implementation) instead of raw node.load
  // This gives us a fully wrapped CoValue with $isLoaded and $jazz.owner
  let coValueState = $state<CoState<typeof CoMap> | null>(null);
  let lastCoValueId = $state<string | undefined>(undefined);

  // Create CoState when coValueId changes (prevent infinite loop by tracking last ID)
  $effect(() => {
    const currentCoValueId = context.coValueId;

    // CRITICAL: Only create new CoState if coValueId actually changed
    // This prevents infinite loops!
    if (currentCoValueId === lastCoValueId) {
      return;
    }

    lastCoValueId = currentCoValueId;

    if (!currentCoValueId) {
      coValueState = null;
      loadedCoValue = null;
      groupInfo = null;
      return;
    }

    // Use CoState to load the CoValue (same as legacy /data route)
    // This gives us a properly wrapped CoValue with $isLoaded and $jazz.owner
    coValueState = new CoState(CoMap, currentCoValueId);
  });

  // Get current CoValue from CoState (auto-subscribes)
  const currentCoValue = $derived(coValueState?.current);

  // Extract group info when CoValue is loaded (separate effect to prevent loops)
  $effect(() => {
    const coValue = currentCoValue;

    if (!coValue || !coValue.$isLoaded) {
      // Only clear if we had values before (prevent unnecessary updates)
      if (loadedCoValue !== null) {
        loadedCoValue = null;
      }
      if (groupInfo !== null) {
        groupInfo = null;
      }
      return;
    }

    // CRITICAL: Only update if CoValue ID actually changed (prevent infinite loop)
    // Compare by ID, not by reference, as the wrapper object may change
    const currentId = coValue.$jazz?.id;
    const loadedId = loadedCoValue?.$jazz?.id;

    if (currentId && loadedId && currentId === loadedId) {
      // Same CoValue, don't re-extract
      return;
    }

    loadedCoValue = coValue;

    // Extract group info directly from the loaded CoValue
    // This is synchronous - getCoValueGroupInfo will handle the owner Group
    try {
      const info = getCoValueGroupInfo(coValue);
      console.log("[MetadataSidebar] Group info:", info);

      if (info?.groupId) {
        const newGroupInfo = {
          accountMembers: info.accountMembers || [],
          groupMembers: info.groupMembers || [],
        };

        // Only update if different (prevent unnecessary rerenders)
        const hasChanged =
          !groupInfo ||
          groupInfo.accountMembers.length !==
            newGroupInfo.accountMembers.length ||
          groupInfo.groupMembers.length !== newGroupInfo.groupMembers.length;

        if (hasChanged) {
          groupInfo = newGroupInfo;
          console.log(
            "[MetadataSidebar] ✅ Loaded group members:",
            $state.snapshot(groupInfo),
          );
        }
      } else {
        if (groupInfo !== null) {
          groupInfo = null;
        }
      }
    } catch (_e) {
      if (groupInfo !== null) {
        groupInfo = null;
      }
    }
  });
</script>

<div class="w-full">
  <!-- Tabs (outside card, attached to top like main area) -->
  <div class="flex items-end gap-1 mb-0 -mb-px relative z-10 pl-4">
    <button
      type="button"
      onclick={() => (activeTab = "members")}
      class="text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-t-lg transition-colors border border-b-0 {activeTab ===
      'members'
        ? 'bg-[var(--color-card-bg)] border-[var(--color-card-border)] text-slate-700'
        : 'bg-slate-200 border-transparent text-slate-500 hover:bg-slate-300'}"
      style="border-bottom: none;"
    >
      Members
    </button>
    <button
      type="button"
      onclick={() => (activeTab = "info")}
      class="text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-t-lg transition-colors border border-b-0 {activeTab ===
      'info'
        ? 'bg-[var(--color-card-bg)] border-[var(--color-card-border)] text-slate-700'
        : 'bg-slate-200 border-transparent text-slate-500 hover:bg-slate-300'}"
      style="border-bottom: none;"
    >
      Info
    </button>
  </div>

  <!-- Tab Content (card container matching main area) -->
  <div class="card p-6">
    {#if activeTab === "members"}
      {#if groupInfo}
        {@const hasMembers =
          groupInfo.accountMembers.length > 0 ||
          groupInfo.groupMembers.length > 0}
        {#if hasMembers}
          <!-- Members directly in card container (no PropertyItem wrapper) -->
          <div class="space-y-3">
            {#each sortedAccountMembers as member}
              {@const profileInfo = resolveProfile(member.id, currentAccount)}
              {@const isEveryone = member.id === "everyone"}
              {@const isAdmin = member.role.toLowerCase() === "admin"}
              <div
                class="flex items-center justify-between rounded-2xl p-3 border shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm {isEveryone
                  ? 'bg-red-50/50 border-red-200'
                  : isAdmin
                    ? 'bg-yellow-50/50 border-yellow-200'
                    : 'bg-slate-100 border-white'}"
              >
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  {#if profileInfo && profileInfo.image}
                    <div
                      class="w-6 h-6 rounded-full overflow-hidden border border-slate-300 shrink-0"
                    >
                      <Image
                        imageId={profileInfo.image.$jazz.id}
                        width={24}
                        height={24}
                        alt={profileInfo.name || member.id}
                        class="object-cover w-full h-full"
                        loading="lazy"
                      />
                    </div>
                  {/if}
                  <div class="flex flex-col min-w-0 flex-1">
                    {#if profileInfo && profileInfo.name && !isEveryone}
                      <span
                        class="font-mono text-xs {isAdmin
                          ? 'text-yellow-700'
                          : 'text-slate-700'} truncate">{profileInfo.name}</span
                      >
                    {:else}
                      <span
                        class="font-mono text-xs {isEveryone
                          ? 'text-red-700'
                          : isAdmin
                            ? 'text-yellow-700'
                            : 'text-slate-600'} truncate"
                      >
                        {isEveryone
                          ? member.id.charAt(0).toUpperCase() +
                            member.id.slice(1)
                          : member.id.slice(0, 8) + "..."}
                      </span>
                    {/if}
                  </div>
                </div>
                <Badge type={member.role.toLowerCase()} variant="role"
                  >{member.role}</Badge
                >
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-slate-500 italic">No members found</p>
        {/if}
      {:else}
        <p class="text-sm text-slate-500 italic">Loading members...</p>
      {/if}
    {:else if activeTab === "info"}
      <div class="space-y-3">
        <PropertyItem
          propKey="ID"
          propValue={formatCoValueId(context.coValueId, 16)}
          showCopyButton={true}
          copyValue={context.coValueId}
          hideBadge={true}
        />

        <PropertyItem
          propKey="TYPE"
          propValue={displayType}
          hideBadge={false}
          hideValue={true}
          badgeType={displayType}
        />

        {#if groupId}
          <PropertyItem
            propKey="GROUP"
            propValue={formatCoValueId(groupId, 16)}
            showCopyButton={true}
            copyValue={groupId}
            hideBadge={true}
          />
        {/if}
      </div>
    {/if}
  </div>
</div>
