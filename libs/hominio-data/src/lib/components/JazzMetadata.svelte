<script lang="ts">
  import { getCoValueGroupInfo } from "$lib/groups";

  interface Props {
    coValue: any; // CoValue to display metadata for
    showKeys?: boolean; // Whether to show the keys section
  }

  let { coValue, showKeys = false }: Props = $props();

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
  <div
    class="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-slate-100/90 border border-white shadow-[0_0_8px_rgba(0,0,0,0.03)] p-5"
  >
    <!-- Glossy gradient overlay -->
    <div
      class="absolute inset-0 bg-linear-to-br from-white/60 via-white/20 to-transparent pointer-events-none"
    ></div>

    <div class="relative">
      <!-- Metadata content always visible -->
      <div class="space-y-4">
          <!-- ID -->
          <div
            class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
          >
            <div class="flex justify-between items-center">
              <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">ID</span>
              <span class="font-mono text-xs text-slate-600 break-all break-words text-right">
                {metadata()!.id}
              </span>
            </div>
          </div>

          <!-- Owner -->
          {#if metadata()!.ownerInfo}
            <div
              class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
            >
              <div class="flex justify-between items-center">
                <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Owner</span>
                <div class="text-right">
                  <span class="text-xs text-slate-600">{metadata()!.ownerInfo.type}</span>
                  <span class="ml-2 font-mono text-xs text-slate-400">
                    ({metadata()!.ownerInfo.id.slice(0, 8)}...)
                  </span>
                </div>
              </div>
            </div>
          {:else if metadata()!.owner}
            <div
              class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
            >
              <div class="flex justify-between items-center">
                <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Owner</span>
                <span class="text-xs text-slate-600">{String(metadata()!.owner)}</span>
              </div>
            </div>
          {/if}

          <!-- Keys (optional) -->
          {#if showKeys && metadata()!.keys.length > 0}
            <div
              class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
            >
              <div class="space-y-2">
                <span class="text-xs font-medium text-slate-500 uppercase tracking-wide block">Keys</span>
                <div class="flex flex-wrap gap-1.5">
                  {#each metadata()!.keys as key}
                    <span class="text-xs font-mono bg-slate-50/60 px-2 py-0.5 rounded-md border border-white text-slate-600">
                      {key}
                    </span>
                  {/each}
                </div>
              </div>
            </div>
          {/if}

          <!-- Group Members -->
          {#if metadata()!.groupInfo &&
            (metadata()!.groupInfo.accountMembers.length > 0 ||
              metadata()!.groupInfo.groupMembers.length > 0)}
            {@const groupInfo = metadata()!.groupInfo}
            <div
              class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
            >
              <h5 class="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">
                Group Members
              </h5>

              <!-- Account Members -->
              {#if groupInfo.accountMembers.length > 0}
                <div class="mb-3 space-y-1.5">
                  <span class="text-xs font-medium text-slate-500 mb-2 block">Account Members:</span>
                  {#each groupInfo.accountMembers as member}
                    <div class="flex items-center justify-between p-1.5 rounded-lg">
                      <span class="font-mono text-xs text-slate-600">{member.id.slice(0, 8)}...</span>
                      <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-slate-100/50 text-slate-700 border border-slate-200/50">
                        {member.role}
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Parent Groups -->
              {#if groupInfo.groupMembers.length > 0}
                <div class="pt-3 border-t border-white/50 space-y-1.5">
                  <span class="text-xs font-medium text-slate-500 mb-2 block">Parent Groups:</span>
                  {#each groupInfo.groupMembers as groupMember}
                    <div class="flex items-center justify-between p-1.5 rounded-lg">
                      <span class="font-mono text-xs text-slate-600">{groupMember.id.slice(0, 8)}...</span>
                      <div class="flex items-center gap-2">
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-green-100/50 text-green-600 border border-green-100/50">
                          {groupMember.role}
                        </span>
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
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
      </div>
    </div>
  </div>
{/if}

