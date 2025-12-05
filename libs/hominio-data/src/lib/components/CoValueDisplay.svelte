<script lang="ts">
  import { Group, Account, co } from "jazz-tools";
  import { getCoValueGroupInfo } from "../groups.js";
  import { CoState } from "jazz-tools/svelte";
  import { setupReactiveLabel } from "../schema.js";
  import JazzMetadata from "./JazzMetadata.svelte";
  import Card from "./Card.svelte";
  import Badge from "./Badge.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coValue: any;
    coValueType: string;
  }

  let { coValue, coValueType }: Props = $props();

  // Ensure reactive label is set up once when coValue is loaded
  let labelSetupDone = false;
  $effect(() => {
    if (coValue?.$isLoaded && !labelSetupDone) {
      setupReactiveLabel(coValue);
      labelSetupDone = true;
    }
    // Reset flag if coValue changes
    if (!coValue?.$isLoaded) {
      labelSetupDone = false;
    }
  });

  // Compute label reactively from @label for display (fallback to ID)
  const displayLabel = $derived(
    coValue?.$isLoaded && coValue.$jazz.has("@label")
      ? coValue["@label"]
      : coValue?.$isLoaded
        ? coValue.$jazz.id
        : "",
  );

  const groupInfo = $derived(
    coValue?.$isLoaded
      ? (() => {
          try {
            return getCoValueGroupInfo(coValue);
          } catch (error) {
            console.error("Error getting group info:", error);
            return null;
          }
        })()
      : null,
  );
  const ownerGroup = $derived(groupInfo?.groupId ? new CoState(Group, groupInfo.groupId) : null);
  const ownerGroupData = $derived(ownerGroup?.current);
</script>

{#if coValue?.$isLoaded}
  <Card padding="p-5" class="min-w-[500px]">
    <div class="space-y-5">
      <!-- Header -->
      <div class="flex justify-between items-start gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2 flex-wrap">
            <h3 class="text-lg font-bold text-slate-700 leading-tight truncate">
              {displayLabel}
            </h3>
            <Badge type={coValueType}>{coValueType}</Badge>
          </div>
          <div
            class="text-[10px] font-mono text-slate-400 mt-1 truncate opacity-70 hover:opacity-100 transition-opacity"
          >
            ID: {coValue.$jazz.id}
          </div>
        </div>
      </div>

      <!-- Properties Section -->
      <div
        class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
      >
        <div class="space-y-3 text-sm">
          <div class="flex justify-between items-center">
            <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Schema</span>
            {#if coValue.$jazz.has("@schema")}
              <span
                class="font-medium text-slate-700 bg-slate-50/60 px-2 py-0.5 rounded-md border border-white"
                >{coValue["@schema"]}</span
              >
            {:else}
              <span class="text-slate-400 italic text-xs">(not set)</span>
            {/if}
          </div>

          {#if coValue.$jazz.has("name")}
            <div class="flex justify-between items-center pt-2 border-t border-white/50">
              <label
                for={`name-${coValue.$jazz.id}`}
                class="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">Name</label
              >
              <input
                type="text"
                id={`name-${coValue.$jazz.id}`}
                class="bg-gray-100 border border-slate-300 rounded-full px-2 py-1 text-sm font-semibold text-right text-slate-700 outline-hidden transition-all w-1/2 min-w-[150px]"
                value={coValue.name}
                oninput={(e) => {
                  coValue.$jazz.set("name", e.currentTarget.value);
                }}
              />
            </div>
          {/if}
        </div>
      </div>

      <!-- Access Control (Group Owner) -->
      {#if groupInfo && groupInfo.groupId}
        <div
          class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)]"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Access Control
            </div>
            <div class="text-[10px] text-slate-400 bg-slate-100/50 px-2 py-0.5 rounded-full">
              {groupInfo.accountMembers.length + groupInfo.groupMembers.length} Members
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex justify-between items-center text-[10px] text-slate-400">
              <span>Group ID</span>
              <span class="font-mono opacity-60"
                >{groupInfo.groupId.slice(0, 8)}...{groupInfo.groupId.slice(-8)}</span
              >
            </div>

            <!-- Account Members -->
            {#if groupInfo.accountMembers.length > 0}
              <div class="space-y-1.5">
                {#each groupInfo.accountMembers as member}
                  <div class="flex items-center justify-between p-1.5 rounded-lg group">
                    <div class="flex items-center gap-2 min-w-0">
                      <div
                        class="w-1.5 h-1.5 rounded-full bg-slate-500 shadow-[0_0_4px_rgba(51,65,85,0.3)]"
                      ></div>
                      <span
                        class="font-mono text-[10px] text-slate-600 truncate opacity-80 group-hover:opacity-100"
                      >
                        {member.id}
                      </span>
                    </div>
                    <Badge type={member.role.toLowerCase()} variant="role">{member.role}</Badge>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Group Members -->
            {#if groupInfo.groupMembers.length > 0}
              <div class="space-y-1.5 pt-2 border-t border-white/50">
                {#each groupInfo.groupMembers as member}
                  <div class="flex items-center justify-between p-1.5 rounded-lg group">
                    <div class="flex items-center gap-2 min-w-0">
                      <div
                        class="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.3)]"
                      ></div>
                      <span
                        class="font-mono text-[10px] text-slate-600 truncate opacity-80 group-hover:opacity-100"
                      >
                        {member.id}
                      </span>
                    </div>
                    <Badge type={member.role.toLowerCase()} variant="role" class="bg-green-100/50 text-green-600 border-green-100/50">{member.role}</Badge>
                  </div>
                {/each}
              </div>
            {/if}

            {#if groupInfo.accountMembers.length === 0 && groupInfo.groupMembers.length === 0}
              <div class="text-center py-2 text-xs text-slate-400 italic">No members found</div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </Card>
{/if}
