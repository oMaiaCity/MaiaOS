<script lang="ts">
  import Badge from "./Badge.svelte";
  import { getDisplayLabel, formatCoValueId } from "../../utilities/coValueFormatter.js";
  import { getSchemaName } from "../../utilities/coValueType.js";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any;
    isSelected: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect: (coValue: any) => void;
  }

  let { item, isSelected, onSelect }: Props = $props();

  // Extract plain values from item (avoid Svelte reactive functions)
  // Access properties directly and ensure they're plain values, not functions
  const itemType = $derived(() => {
    try {
      // Access item directly, not through reactive chain
      const currentItem = item;
      if (!currentItem) return "CoValue";

      const type = currentItem.type;
      // Ensure it's a plain string, not a function
      if (typeof type === "string" && type !== "primitive") {
        return type;
      }
      // Fallback to schema detection for non-list contexts
      if (currentItem.item) {
        return getSchemaName(currentItem.item);
      }
      return "CoValue";
    } catch (e) {
      return "CoValue";
    }
  });

  const itemId = $derived(() => {
    try {
      // Access item directly, not through reactive chain
      const currentItem = item;
      if (!currentItem) return null;

      const id = currentItem.id;
      // Ensure it's a plain string, not a function
      if (typeof id === "string" && id.startsWith("co_")) {
        return id;
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  const itemIndex = $derived(() => {
    try {
      // Access item directly, not through reactive chain
      const currentItem = item;
      if (!currentItem) return null;

      const idx = currentItem.index;
      // Ensure it's a number, not a function
      if (typeof idx === "number" && !isNaN(idx)) {
        return idx;
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  // Get Co-ID for display (use as display label for now)
  const coId = $derived(() => {
    const id = itemId();
    if (id) {
      return formatCoValueId(id, 12);
    }
    return null;
  });

  // Use Co-ID as display label for now
  const displayLabel = $derived(() => {
    const id = coId();
    return id || "Loading...";
  });

  // Get the exact CoValue type
  const coValueType = $derived(() => itemType());

  // Get index if available
  const index = $derived(() => itemIndex());
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
      <div class="flex items-center gap-2 flex-wrap">
        {#if index() !== null && index() !== undefined}
          <span class="text-xs font-mono text-slate-400">[{index()}]</span>
        {/if}
        <span class="text-xs font-semibold text-slate-600 truncate font-mono">{displayLabel()}</span
        >
      </div>
    </div>
    <!-- Type badge and navigation indicator - right aligned -->
    <div class="flex items-center gap-2 shrink-0">
      <Badge type={coValueType()}>{coValueType()}</Badge>
      <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </div>
</button>
