<script lang="ts">
  import type { CoValueContext } from "@hominio/db";
  import {
    getCoValueGroupInfo,
    resolveProfile,
    formatCoValueId,
    setupComputedFieldsForCoValue,
  } from "@hominio/db";
  import type { LocalNode, CoID, RawCoValue } from "cojson";
  import { CoMap } from "jazz-tools";
  import { CoState, Image } from "jazz-tools/svelte";
  import Badge from "./Badge.svelte";
  import PropertyItem from "./PropertyItem.svelte";
  import { createCoValueState, deriveResolvedFromCoState } from "$lib/utils/costate-navigation";

  interface Props {
    context: CoValueContext;
    node?: LocalNode;
    currentAccount?: any; // Current Jazz account for profile resolution
    onNavigate?: (coValueId: string, label?: string) => void; // Navigation handler for CoValue references
  }

  const { context, node, currentAccount, onNavigate }: Props = $props();

  // Tab state: "members" (default) or "info"
  let activeTab = $state<"members" | "info">("members");

  // Get display type
  const displayType = $derived(
    context.resolved.extendedType || context.resolved.type || "CoValue",
  );

  // Get group ID from resolved context
  const groupId = $derived(context.resolved.groupId);

  // Get @label and @schema from snapshot (reactive via CoState)
  const labelAndSchema = $derived(() => {
    const snapshot = context.resolved.snapshot;
    if (!snapshot || typeof snapshot !== 'object' || snapshot === 'unavailable') {
      return { '@label': undefined, '@schema': undefined };
    }
    return {
      '@label': snapshot['@label'],
      '@schema': snapshot['@schema'],
    };
  });

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
  
  // Extract schema ID from @schema reference
  const schemaId = $derived.by(() => {
    const schemaRef = labelAndSchema()['@schema'];
    if (!schemaRef) {
      return undefined;
    }
    
    // Extract schema ID
    if (typeof schemaRef === 'string' && schemaRef.startsWith('co_')) {
      return schemaRef;
    } else if (schemaRef && typeof schemaRef === 'object' && '$jazz' in schemaRef) {
      return schemaRef.$jazz?.id;
    }
    
    return undefined;
  });

  // EXACT SAME PATTERN AS ListItem (lines 156-176)
  // Create CoState for lazy resolution of @schema CoValue
  let schemaCoValueState = $state<CoState<typeof CoMap> | null>(null);
  
  $effect(() => {
    const currentSchemaId = schemaId;
    if (currentSchemaId && typeof currentSchemaId === 'string' && currentSchemaId.startsWith('co_')) {
      // Check if we already have it resolved in directChildren
      const schemaChild = context.directChildren?.find((c) => c.coValueId === currentSchemaId);
      if (!schemaChild?.resolved) {
        // Create CoState for lazy resolution (EXACT same as ListItem line 161)
        schemaCoValueState = createCoValueState(currentSchemaId as CoID<RawCoValue>);
      } else {
        schemaCoValueState = null;
      }
    } else {
      schemaCoValueState = null;
    }
  });
  
  // Derive resolved type from CoState (EXACT same as ListItem lines 168-173)
  const resolvedSchemaFromCoState = $derived(() => {
    const currentSchemaId = schemaId;
    if (schemaCoValueState && currentSchemaId && typeof currentSchemaId === 'string' && currentSchemaId.startsWith('co_')) {
      return deriveResolvedFromCoState(schemaCoValueState, currentSchemaId as CoID<RawCoValue>);
    }
    return null;
  });
  
  // Use directChildren if available, otherwise use CoState (EXACT same as ListItem line 176)
  const effectiveResolvedSchema = $derived.by(() => {
    const currentSchemaId = schemaId;
    if (!currentSchemaId) return null;
    
    const schemaChild = context.directChildren?.find((c) => c.coValueId === currentSchemaId);
    return schemaChild?.resolved || resolvedSchemaFromCoState();
  });
  
  // Extract @label from resolved schema (EXACT same as ListItem line 265)
  const schemaLabel = $derived.by(() => {
    const resolved = effectiveResolvedSchema;
    if (resolved?.snapshot && typeof resolved.snapshot === 'object' && '@label' in resolved.snapshot && resolved.snapshot['@label']) {
      return resolved.snapshot['@label'] as string;
    }
    return 'Schema';
  });

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

    // Use CoState to load the CoValue with resolve query
    // This gives us a properly wrapped CoValue with $isLoaded and $jazz.owner
    // Resolve @schema deeply to access its @label
    coValueState = new CoState(CoMap, currentCoValueId, {
      resolve: {
        '@schema': { '@label': true },
      },
    });
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
        <!-- @label and @schema at the top -->
        {#if labelAndSchema()['@label']}
          <PropertyItem
            propKey="@LABEL"
            propValue={labelAndSchema()['@label'] || ''}
            hideBadge={true}
          />
        {/if}
        {#if labelAndSchema()['@schema']}
          {@const currentSchemaId = schemaId}
          {@const isClickable = !!currentSchemaId && onNavigate !== undefined}
          
          {#if isClickable}
            <!-- Clickable schema reference -->
            <button
              type="button"
              onclick={() => {
                if (currentSchemaId && onNavigate) {
                  onNavigate(currentSchemaId, schemaLabel);
                }
              }}
              class="w-full text-left cursor-pointer group"
              title={`Navigate to schema: ${schemaLabel}`}
            >
              <div class="relative">
                <PropertyItem
                  propKey="@SCHEMA"
                  propValue={schemaLabel}
                  hideBadge={true}
                  showCopyButton={true}
                  copyValue={currentSchemaId}
                  hoverable={true}
                />
                <!-- Arrow icon indicator -->
                <svg
                  class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          {:else}
            <!-- Non-clickable schema (no navigation handler or old string format) -->
            <PropertyItem
              propKey="@SCHEMA"
              propValue={schemaLabel}
              hideBadge={true}
              showCopyButton={!!currentSchemaId}
              copyValue={currentSchemaId}
            />
          {/if}
        {/if}

        <PropertyItem
          propKey="ID"
          propValue={formatCoValueId(context.coValueId, 16)}
          showCopyButton={true}
          copyValue={context.coValueId}
          hideBadge={true}
        />

        <PropertyItem
          propKey="CONTENT TYPE"
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
