<script lang="ts">
  import { getCoValueGroupInfo } from "$lib/groups";
  import PropertyItem from "./PropertyItem.svelte";

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
  <div class="space-y-3">
    <!-- ID -->
    <PropertyItem
      propKey="ID"
      propValue={metadata()!.id.slice(0, 16) + "..."}
      showCopyButton={true}
      copyValue={metadata()!.id}
      hideBadge={true}
    />

    <!-- TYPE -->
    <PropertyItem propKey="TYPE" propValue={metadata()!.coValueType} />

    <!-- GROUP -->
    {#if metadata()?.ownerInfo}
      <PropertyItem
        propKey="GROUP"
        propValue={metadata()!.ownerInfo!.id.slice(0, 16) + "..."}
        showCopyButton={true}
        copyValue={metadata()!.ownerInfo!.id}
        hideBadge={true}
      />
    {:else if metadata()!.owner}
      {@const ownerId = String(metadata()!.owner)}
      <PropertyItem
        propKey="GROUP"
        propValue={ownerId.slice(0, 16) + "..."}
        showCopyButton={true}
        copyValue={ownerId}
        hideBadge={true}
      />
    {/if}

    <!-- Members -->
    {#if metadata()?.groupInfo}
      {@const groupInfoData = metadata()!.groupInfo}
      {#if groupInfoData && groupInfoData.accountMembers && groupInfoData.groupMembers && (groupInfoData.accountMembers.length > 0 || groupInfoData.groupMembers.length > 0)}
        <PropertyItem
          propKey="MEMBERS"
          propValue={null}
          variant="members"
          membersData={{
            accountMembers: groupInfoData.accountMembers,
            groupMembers: groupInfoData.groupMembers,
            onRemoveGroupMember: removeParentGroupMember,
          }}
          hideBadge={true}
        />
      {/if}
    {/if}
  </div>
{/if}
