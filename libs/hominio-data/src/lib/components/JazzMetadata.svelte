<script lang="ts">
  import { getCoValueGroupInfo } from "$lib/groups";

  interface Props {
    coValue: any; // CoValue to display metadata for
    showKeys?: boolean; // Whether to show the keys section
  }

  let { coValue, showKeys = false }: Props = $props();

  // Copy feedback state
  let copiedCoValue = $state(false);
  let copiedGroup = $state(false);

  // Extract Jazz metadata
  const metadata = $derived(() => {
    if (!coValue || !coValue.$jazz) {
      return null;
    }

    // Get basic info
    const id = coValue.$jazz?.id || "unknown";
    const owner = coValue.$jazz?.owner;

    // Get CoValue type - detect native Jazz types only (not @schema)
    let coValueType = "CoValue";
    try {
      if (coValue.$isLoaded) {
        // First check if it's a CoList (is iterable with length) - check this BEFORE CoMap
        try {
          const isArray = Array.isArray(coValue);
          const hasLength = coValue.length !== undefined;
          const isIterable = typeof coValue[Symbol.iterator] === "function";
          if (isArray || (hasLength && isIterable)) {
            coValueType = "CoList";
          }
        } catch (e) {
          // Ignore
        }

        // Check if it's an ImageDefinition (has originalSize, placeholderDataURL, or original)
        if (coValueType === "CoValue") {
          try {
            const hasOriginalSize = (coValue as any).originalSize !== undefined;
            const hasPlaceholder = (coValue as any).placeholderDataURL !== undefined;
            const hasOriginal = (coValue as any).original !== undefined;
            if (hasOriginalSize || (hasPlaceholder && hasOriginal)) {
              coValueType = "Image";
            }
          } catch (e) {
            // Ignore
          }
        }

        // Check if it's a FileStream (has FileStream methods)
        if (coValueType === "CoValue") {
          try {
            if (
              typeof (coValue as any).getChunks === "function" ||
              typeof (coValue as any).toBlob === "function" ||
              typeof (coValue as any).isBinaryStreamEnded === "function"
            ) {
              coValueType = "FileStream";
            }
          } catch (e) {
            // Ignore
          }
        }

        // Check if it's a CoMap (has keys, not iterable like CoList, not ImageDefinition, not FileStream)
        if (coValueType === "CoValue") {
          try {
            // CoMap has $jazz.keys() method and is not a CoList
            const hasKeysMethod = coValue.$jazz && typeof coValue.$jazz.keys === "function";
            const isNotArray = !Array.isArray(coValue);
            const hasNoLength = coValue.length === undefined;

            // Also check if it's not an ImageDefinition or FileStream (already checked above)
            // CoMap: has keys method, not an array, no length property
            // If it has keys() and isn't any of the other types, it's a CoMap
            if (hasKeysMethod && isNotArray && hasNoLength) {
              coValueType = "CoMap";
            } else if (!hasKeysMethod && isNotArray && hasNoLength) {
              // Fallback: if it's an object with $jazz but no keys method, might still be CoMap
              // Check if it has properties via Object.keys
              try {
                const objKeys = Object.keys(coValue).filter(
                  (k) => !k.startsWith("$") && k !== "constructor",
                );
                if (objKeys.length > 0) {
                  coValueType = "CoMap";
                }
              } catch (e) {
                // Ignore
              }
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    } catch (e) {
      // Fallback to CoValue if all methods fail
      coValueType = "CoValue";
    }

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
      coValueType,
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
      <div class="space-y-3">
        <!-- ID -->
        <div
          class="bg-slate-200/50 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
        >
          <div class="flex justify-between items-center gap-2">
            <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">ID</span>
            <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
              <span class="font-mono text-xs text-slate-600 truncate">
                {metadata()!.id.slice(0, 16)}...
              </span>
              <button
                type="button"
                onclick={async () => {
                  try {
                    await navigator.clipboard.writeText(metadata()!.id);
                    copiedCoValue = true;
                    setTimeout(() => {
                      copiedCoValue = false;
                    }, 2000);
                  } catch (e) {
                    console.error("Failed to copy:", e);
                  }
                }}
                class="shrink-0 p-1 hover:bg-slate-300/50 rounded transition-colors relative"
                aria-label="Copy full ID"
              >
                {#if copiedCoValue}
                  <svg
                    class="w-4 h-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                {:else}
                  <svg
                    class="w-4 h-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                {/if}
              </button>
            </div>
          </div>
        </div>

        <!-- TYPE -->
        <div
          class="bg-slate-200/50 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
        >
          <div class="flex justify-between items-center">
            <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">TYPE</span>
            <span
              class="px-2 py-0.5 rounded-full bg-slate-50/80 border border-white text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0"
            >
              {metadata()!.coValueType}
            </span>
          </div>
        </div>

        <!-- GROUP -->
        {#if metadata()?.ownerInfo}
          {@const groupId = metadata()!.ownerInfo!.id}
          <div
            class="bg-slate-200/50 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
          >
            <div class="flex justify-between items-center gap-2">
              <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">GROUP</span>
              <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
                <span class="font-mono text-xs text-slate-600 truncate">
                  {groupId.slice(0, 16)}...
                </span>
                <button
                  type="button"
                  onclick={async () => {
                    try {
                      await navigator.clipboard.writeText(groupId);
                      copiedGroup = true;
                      setTimeout(() => {
                        copiedGroup = false;
                      }, 2000);
                    } catch (e) {
                      console.error("Failed to copy:", e);
                    }
                  }}
                  class="shrink-0 p-1 hover:bg-slate-300/50 rounded transition-colors relative"
                  aria-label="Copy full ID"
                >
                  {#if copiedGroup}
                    <svg
                      class="w-4 h-4 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  {:else}
                    <svg
                      class="w-4 h-4 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {:else if metadata()!.owner}
          {@const ownerId = String(metadata()!.owner)}
          <div
            class="bg-slate-200/50 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
          >
            <div class="flex justify-between items-center gap-2">
              <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">GROUP</span>
              <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
                <span class="font-mono text-xs text-slate-600 truncate">
                  {ownerId.slice(0, 16)}...
                </span>
                <button
                  type="button"
                  onclick={async () => {
                    try {
                      await navigator.clipboard.writeText(ownerId);
                      copiedGroup = true;
                      setTimeout(() => {
                        copiedGroup = false;
                      }, 2000);
                    } catch (e) {
                      console.error("Failed to copy:", e);
                    }
                  }}
                  class="shrink-0 p-1 hover:bg-slate-300/50 rounded transition-colors relative"
                  aria-label="Copy full ID"
                >
                  {#if copiedGroup}
                    <svg
                      class="w-4 h-4 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  {:else}
                    <svg
                      class="w-4 h-4 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- Members -->
        {#if metadata()?.groupInfo}
          {@const groupInfoData = metadata()!.groupInfo}
          {#if groupInfoData && groupInfoData.accountMembers && groupInfoData.groupMembers && (groupInfoData.accountMembers.length > 0 || groupInfoData.groupMembers.length > 0)}
            {@const groupInfo = groupInfoData}
            <div
              class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-slate-500 uppercase tracking-wide"
                  >MEMBERS</span
                >
                <svg
                  class="w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>

              <!-- Accounts -->
              {#if groupInfo.accountMembers.length > 0}
                <div class="mb-3 space-y-1.5 mt-2">
                  <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wide"
                    >ACCOUNTS</span
                  >
                  {#each groupInfo.accountMembers as member}
                    <div class="flex items-center justify-between p-1.5 rounded-lg">
                      <span class="font-mono text-xs text-slate-600"
                        >{member.id.slice(0, 8)}...</span
                      >
                      <span
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-slate-100/50 text-slate-700 border border-slate-200/50"
                      >
                        {member.role}
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Groups -->
              {#if groupInfo.groupMembers.length > 0}
                <div class="pt-3 border-t border-white/50 space-y-1.5 mt-2">
                  <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wide"
                    >GROUPS</span
                  >
                  {#each groupInfo.groupMembers as groupMember}
                    <div class="flex items-center justify-between p-1.5 rounded-lg">
                      <span class="font-mono text-xs text-slate-600"
                        >{groupMember.id.slice(0, 8)}...</span
                      >
                      <div class="flex items-center gap-2">
                        <span
                          class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-green-100/50 text-green-600 border border-green-100/50"
                        >
                          {groupMember.role}
                        </span>
                        <button
                          type="button"
                          class="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors shrink-0"
                          onclick={() => removeParentGroupMember(groupMember.id)}
                          title="Remove parent group"
                          aria-label="Remove parent group"
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
        {/if}
      </div>
    </div>
  </div>
{/if}
