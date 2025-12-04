<script lang="ts">
  import { getCoValueGroupInfo } from "$lib/groups";

  interface Props {
    coValue: any; // CoValue to display metadata for
    showKeys?: boolean; // Whether to show the keys section
  }

  let { coValue, showKeys = false }: Props = $props();

  // Track expanded state
  let isExpanded = $state(false);

  // Extract Jazz metadata
  const metadata = $derived(() => {
    if (!coValue || !coValue.$jazz) {
      return null;
    }

    // Get basic info
    const id = coValue.$jazz?.id || "unknown";
    const owner = coValue.$jazz?.owner;

    // Get owner info
    let ownerInfo: { type: string; id: string } | null = null;
    if (owner && typeof owner === "object" && "$jazz" in owner) {
      ownerInfo = {
        type: "Group",
        id: owner.$jazz?.id || "unknown",
      };
    }

    // Get keys
    let keys: string[] = [];
    try {
      keys = Object.keys(coValue).filter((key) => key !== "$jazz" && key !== "$isLoaded");
      if (keys.length === 0 && coValue.$jazz && typeof coValue.$jazz.keys === "function") {
        keys = Array.from(coValue.$jazz.keys());
      }
    } catch (e) {
      console.warn("Error getting CoValue keys:", e);
    }

    // Get group info using the helper function
    const groupInfo = getCoValueGroupInfo(coValue);

    return {
      id,
      owner,
      ownerInfo,
      keys,
      groupInfo: groupInfo.groupId
        ? {
            groupId: groupInfo.groupId,
            accountMembers: groupInfo.accountMembers,
            groupMembers: groupInfo.groupMembers,
          }
        : null,
    };
  });

  // Function to remove a parent group member
  async function removeParentGroupMember(parentGroupId: string) {
    if (!coValue || !coValue.$isLoaded) {
      console.error("[Remove Parent Group] CoValue not loaded");
      return;
    }

    try {
      // Get the CoValue's owner group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ownerGroup = coValue.$jazz.owner as any;
      if (!ownerGroup) {
        console.error("[Remove Parent Group] CoValue doesn't have an owner group");
        return;
      }

      // Load the parent group to remove
      const { Group } = await import("jazz-tools");
      const parentGroup = await Group.load(parentGroupId);
      if (!parentGroup || !parentGroup.$isLoaded) {
        console.error("[Remove Parent Group] Could not load parent group");
        return;
      }

      // Remove the parent group from the owner group
      ownerGroup.removeMember(parentGroup);
      await ownerGroup.$jazz.waitForSync();
      console.log(`[Remove Parent Group] Removed parent group ${parentGroupId} from owner group`);
    } catch (error) {
      console.error("[Remove Parent Group] Error removing parent group:", error);
    }
  }
</script>

{#if metadata()}
  <div class="bg-slate-50 rounded-lg border border-slate-200 p-3">
    <!-- Header with toggle button -->
    <button
      type="button"
      class="w-full flex items-center justify-between text-left"
      onclick={() => (isExpanded = !isExpanded)}
    >
      <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        Jazz Metadata
      </h4>
      <svg
        class="w-4 h-4 text-slate-400 transition-transform {isExpanded ? 'rotate-180' : ''}"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <!-- Expanded content -->
    {#if isExpanded}
      <div class="mt-3 space-y-3 pt-3 border-t border-slate-200">
        <!-- ID -->
        <div>
          <span class="text-xs font-semibold text-slate-600">ID:</span>
          <span class="ml-2 font-mono text-xs text-slate-500 break-all break-words">
            {metadata()!.id}
          </span>
        </div>

        <!-- Owner -->
        {#if metadata()!.ownerInfo}
          <div>
            <span class="text-xs font-semibold text-slate-600">Owner:</span>
            <span class="ml-2 text-xs text-slate-500">{metadata()!.ownerInfo.type}</span>
            <span class="ml-2 font-mono text-xs text-slate-400">
              ({metadata()!.ownerInfo.id.slice(0, 8)}...)
            </span>
          </div>
        {:else if metadata()!.owner}
          <div>
            <span class="text-xs font-semibold text-slate-600">Owner:</span>
            <span class="ml-2 text-xs text-slate-700">{String(metadata()!.owner)}</span>
          </div>
        {/if}

        <!-- Keys (optional) -->
        {#if showKeys && metadata()!.keys.length > 0}
          <div>
            <span class="text-xs font-semibold text-slate-600">Keys:</span>
            <div class="flex flex-wrap gap-1 mt-1">
              {#each metadata()!.keys as key}
                <span class="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                  {key}
                </span>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Group Members -->
        {#if metadata()!.groupInfo &&
          (metadata()!.groupInfo.accountMembers.length > 0 ||
            metadata()!.groupInfo.groupMembers.length > 0)}
          {@const groupInfo = metadata()!.groupInfo}
          <div class="pt-2 border-t border-slate-200">
            <h5 class="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
              Group Members
            </h5>

            <!-- Account Members -->
            {#if groupInfo.accountMembers.length > 0}
              <div class="mb-3">
                <span class="text-xs font-semibold text-slate-500 mb-1 block">Account Members:</span>
                <div class="space-y-1 ml-2">
                  {#each groupInfo.accountMembers as member}
                    <div class="text-xs text-slate-600">
                      <span class="font-mono">{member.id.slice(0, 8)}...</span>
                      <span class="ml-2 text-slate-500">({member.role})</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Parent Groups -->
            {#if groupInfo.groupMembers.length > 0}
              <div>
                <span class="text-xs font-semibold text-slate-500 mb-1 block">Parent Groups:</span>
                <div class="space-y-1 ml-2">
                  {#each groupInfo.groupMembers as groupMember}
                    <div class="flex items-center gap-2">
                      <div class="text-xs text-slate-600 flex-1">
                        <span class="font-mono">{groupMember.id.slice(0, 8)}...</span>
                        <span class="ml-2 text-slate-500">({groupMember.role})</span>
                      </div>
                      <button
                        type="button"
                        class="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors shrink-0"
                        onclick={() => removeParentGroupMember(groupMember.id)}
                        title="Remove parent group"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

