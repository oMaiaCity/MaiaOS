<script lang="ts">
  import CoValueCard from "./CoValueCard.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractCoValueProperties: (coValue: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isCoValueExpanded: (coValueId: string) => boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleCoValueClick: (coValue: any, coValueId: string, event?: Event) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedCoValue?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect: (coValue: any) => void;
  }

  let {
    value,
    extractCoValueProperties,
    isCoValueExpanded,
    handleCoValueClick,
    selectedCoValue,
    onSelect,
  }: Props = $props();
</script>

<div class="space-y-2">
  {#if value.items && value.items.length > 0}
    <div class="space-y-4 mt-4">
      {#each value.items as item}
        {#if item.type === "CoValue" && item.item}
          <CoValueCard
            {item}
            {extractCoValueProperties}
            isSelected={selectedCoValue?.$jazz?.id === item.item.$jazz.id}
            {onSelect}
          />
        {:else}
          <div
            class="px-4 py-3 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)]"
          >
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs text-slate-500">
                [{item.index}]
              </span>
              <span class="text-xs text-slate-600 break-all break-words">
                {typeof item.value === "string" ? item.value : JSON.stringify(item.value)}
              </span>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="ml-4 text-sm text-slate-400 italic">Empty list</div>
  {/if}
</div>
