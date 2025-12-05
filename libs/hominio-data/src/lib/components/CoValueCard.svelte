<script lang="ts">
  import Badge from "./Badge.svelte";
  import { HOVERABLE_STYLE } from "$lib/utils/styles";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractCoValueProperties: (coValue: any) => any;
    isSelected: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect: (coValue: any) => void;
  }

  let { item, extractCoValueProperties, isSelected, onSelect }: Props = $props();

  const displayLabel =
    item.item.$isLoaded && item.item.$jazz.has("@label")
      ? item.item["@label"]
      : item.item.$isLoaded
        ? item.item.$jazz.id.slice(0, 8) + "..."
        : item.preview;
  const schema =
    item.item.$isLoaded && item.item.$jazz.has("@schema") ? item.item["@schema"] : "CoValue";
</script>

<!-- Simple List Item: Click to navigate to CoValue context -->
<button
  type="button"
  class="w-full text-left px-4 py-3 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE} {isSelected
    ? 'border-slate-500 shadow-[0_0_12px_rgba(0,26,66,0.3)]'
    : ''}"
  onclick={() => {
    // Navigate to this CoValue's context
    onSelect(item.item);
  }}
>
  <div class="flex items-center justify-between gap-3">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-slate-600 truncate">{displayLabel}</span>
        <Badge type={schema}>{schema}</Badge>
      </div>
    </div>
    <!-- Navigation indicator -->
    <div class="shrink-0 text-slate-400">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </div>
</button>
