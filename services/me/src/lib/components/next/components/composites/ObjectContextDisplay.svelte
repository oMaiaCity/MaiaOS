<script lang="ts">
  import Badge from "../leafs/Badge.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any;
    label: string;
  }

  let { object, label }: Props = $props();

  // Stringify the object with proper formatting
  const jsonString = $derived(() => {
    try {
      return JSON.stringify(object, null, 2);
    } catch (e) {
      return String(object);
    }
  });
</script>

<div>
  <div class="space-y-4">
    <div
      class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
    >
      <div class="flex items-center gap-2 mb-3">
        <Badge type="object" variant="compact">Object</Badge>
        <span class="text-xs text-slate-600">{label}</span>
      </div>
      <pre
        class="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-slate-50/80 p-4 rounded-lg border border-slate-200 max-w-full overflow-x-auto"
        style="word-break: break-all; overflow-wrap: anywhere;">
        {jsonString()}
      </pre>
    </div>
  </div>
</div>
