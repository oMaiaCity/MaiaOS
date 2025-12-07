<script lang="ts">
  import Badge from "./Badge.svelte";
  import { getDisplayLabel } from "../../utilities/coValueFormatter.js";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any;
    isSelected: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect: (coValue: any) => void;
  }

  let { item, isSelected, onSelect }: Props = $props();

  const displayLabel = $derived(() => {
    if (item.item.$isLoaded && item.item.$jazz.has("@label")) {
      return item.item["@label"];
    }
    if (item.item.$isLoaded) {
      return getDisplayLabel(item.item);
    }
    return item.preview || "Loading...";
  });

  const schema = $derived(
    item.item.$isLoaded && item.item.$jazz.has("@schema")
      ? item.item["@schema"]
      : "CoValue",
  );
</script>

<button
  type="button"
  class="w-full text-left px-4 py-3 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] hoverable {isSelected
    ? 'border-slate-500 shadow-[0_0_12px_rgba(0,26,66,0.3)]'
    : ''}"
  onclick={() => {
    onSelect(item.item);
  }}
>
  <div class="flex items-center justify-between gap-3">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-slate-600 truncate">{displayLabel()}</span>
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

