<script lang="ts">
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
  class="w-full text-left px-4 py-3 rounded-xl bg-slate-100/60 border border-white transition-all hover:bg-slate-200/60 {isSelected
    ? 'border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.2)]'
    : ''}"
  onclick={() => {
    // Navigate to this CoValue's context
    onSelect(item.item);
  }}
>
  <div class="flex items-center justify-between gap-3">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-slate-700 truncate">{displayLabel}</span>
        <span
          class="px-2 py-0.5 rounded-full bg-slate-50/80 border border-white text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0"
        >
          {schema}
        </span>
      </div>
    </div>
    <!-- Navigation indicator -->
    <div class="shrink-0 text-slate-400">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </div>
  </div>
</button>
