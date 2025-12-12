<script lang="ts">
  import Badge from "./Badge.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any;
    label: string;
  }

  const { object, label }: Props = $props();

  // Stringify the object with proper formatting
  const jsonString = $derived.by(() => {
    try {
      return JSON.stringify(object, null, 2);
    } catch (_e) {
      return String(object);
    }
  });
</script>

<div class="w-full">
  <!-- Header (matching Context component for alignment) -->
  <div class="mb-6">
    <div class="flex items-center gap-3 mb-2">
      <h2 class="text-lg font-semibold text-slate-700">{label}</h2>
      <Badge type="object">Object</Badge>
    </div>
  </div>

  <!-- View Switcher Tabs (matching Context component for alignment) -->
  <div class="flex items-end gap-1 mb-0 -mb-px relative z-10 pl-4">
    <button
      type="button"
      class="text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-t-lg transition-colors border border-b-0 bg-[var(--color-card-bg)] border-[var(--color-card-border)] text-slate-700"
      style="border-bottom: none;"
      disabled
    >
      Properties
    </button>
  </div>

  <!-- Card Container (matching Context component) -->
  <div class="card p-6">
    <div class="space-y-3">
      <pre
        class="text-xs text-slate-700 whitespace-pre font-mono bg-slate-50/80 p-4 rounded-lg border border-slate-200 max-w-full overflow-x-auto overflow-y-auto"
        style="max-height: 600px;">{jsonString}</pre>
    </div>
  </div>
</div>
