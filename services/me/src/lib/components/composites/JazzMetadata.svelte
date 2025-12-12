<script lang="ts">
  import PropertyItem from "./PropertyItem.svelte";
  import { getCoValueGroupInfo } from "@hominio/data";
  import { getCoValueType } from "../../utilities/coValueType.js";
  import { formatCoValueId } from "../../utilities/coValueFormatter.js";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coValue: any;
    showKeys?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentAccount?: any;
  }

  let { coValue, showKeys = false, currentAccount }: Props = $props();

  const metadata = $derived(() => {
    if (!coValue || !coValue.$jazz) {
      return null;
    }

    const id = coValue.$jazz?.id || "unknown";
    const owner = coValue.$jazz?.owner;
    const detectedType = coValue.$isLoaded ? getCoValueType(coValue) : "CoValue";
    // Map ImageDefinition to "image" for display badge
    const coValueType: string = detectedType === "ImageDefinition" ? "image" : detectedType;

    let ownerInfo: { type: string; id: string } | null = null;
    if (owner && typeof owner === "object" && "$jazz" in owner) {
      ownerInfo = {
        type: "Group",
        id: owner.$jazz?.id || "unknown",
      };
    }

    let keys: string[] = [];
    try {
      keys = Object.keys(coValue).filter((key) => key !== "$jazz" && key !== "$isLoaded");
      if (keys.length === 0 && coValue.$jazz && typeof coValue.$jazz.keys === "function") {
        keys = Array.from(coValue.$jazz.keys());
      }
    } catch (e) {
      console.warn("Error getting CoValue keys:", e);
    }

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

  async function removeParentGroupMember(parentGroupId: string) {
    if (!coValue || !coValue.$isLoaded) {
      console.error("[Remove Parent Group] CoValue not loaded");
      return;
    }

    try {
      const ownerGroup = coValue.$jazz.owner as any;
      if (!ownerGroup) {
        console.error("[Remove Parent Group] CoValue doesn't have an owner group");
        return;
      }

      const { Group } = await import("jazz-tools");
      const parentGroup = await Group.load(parentGroupId);
      if (!parentGroup || !parentGroup.$isLoaded) {
        console.error("[Remove Parent Group] Could not load parent group");
        return;
      }

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
    <PropertyItem
      propKey="ID"
      propValue={formatCoValueId(metadata()!.id, 16)}
      showCopyButton={true}
      copyValue={metadata()!.id}
      hideBadge={true}
    />

    <PropertyItem
      propKey="TYPE"
      propValue={metadata()!.coValueType}
      hideBadge={false}
      hideValue={true}
      badgeType={metadata()!.coValueType}
    />

    {#if metadata()?.ownerInfo}
      <PropertyItem
        propKey="GROUP"
        propValue={formatCoValueId(metadata()!.ownerInfo!.id, 16)}
        showCopyButton={true}
        copyValue={metadata()!.ownerInfo!.id}
        hideBadge={true}
      />
    {:else if metadata()!.owner}
      {@const ownerId = String(metadata()!.owner)}
      <PropertyItem
        propKey="GROUP"
        propValue={formatCoValueId(ownerId, 16)}
        showCopyButton={true}
        copyValue={ownerId}
        hideBadge={true}
      />
    {/if}

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
          {currentAccount}
          hideBadge={true}
        />
      {/if}
    {/if}
  </div>
{/if}
