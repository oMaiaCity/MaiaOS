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
            isExpanded={isCoValueExpanded(item.id)}
            isSelected={selectedCoValue?.$jazz?.id === item.item.$jazz.id}
            {onSelect}
            onToggleExpand={handleCoValueClick}
            {selectedCoValue}
          />
        {:else}
          <div class="text-sm">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                [{item.index}]
              </span>
              <span class="text-slate-700">
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

