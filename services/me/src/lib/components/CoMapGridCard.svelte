<script lang="ts">
  import Badge from "./Badge.svelte";
  import { HOVERABLE_STYLE } from "$lib/utils/styles";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
    key: string;
    isSelected: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClick: () => void;
  }

  let { value, key, isSelected, onClick }: Props = $props();

  // Get display name from profile.name or @label
  let displayName = $state(key.charAt(0).toUpperCase() + key.slice(1));
  
  $effect(() => {
    if (value?.coValue && value.coValue.$isLoaded) {
      try {
        // Try profile.name first (for profile CoMap)
        if (value.coValue.$jazz && typeof value.coValue.$jazz.has === "function" && value.coValue.$jazz.has("name")) {
          const name = value.coValue.name;
          if (name && typeof name === "string" && name.trim()) {
            displayName = name;
            return;
          }
        }
        // Try @label
        if (value.coValue.$jazz && typeof value.coValue.$jazz.has === "function" && value.coValue.$jazz.has("@label")) {
          const label = value.coValue["@label"];
          if (label && typeof label === "string" && label.trim()) {
            displayName = label;
            return;
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
    // Fallback to key
    displayName = key.charAt(0).toUpperCase() + key.slice(1);
  });
</script>

<button
  type="button"
  onclick={onClick}
  class="relative overflow-hidden rounded-3xl bg-slate-100 border border-white shadow-[0_0_8px_rgba(0,0,0,0.03)] {HOVERABLE_STYLE} {isSelected
    ? 'border-slate-500 shadow-[0_0_12px_rgba(0,26,66,0.3)]'
    : ''} p-6 h-full flex flex-col"
>
  <!-- Glossy gradient overlay -->
  <div class="absolute inset-0 pointer-events-none"></div>

  <div class="relative flex flex-col h-full">
    <!-- Header -->
    <div class="mb-4">
      <h3 class="text-lg font-bold text-slate-700 uppercase tracking-wider">{key}</h3>
    </div>

    <!-- Preview Content -->
    <div class="flex-1 flex flex-col items-center justify-center gap-3">
      <div class="text-center">
        <div class="text-sm font-medium text-slate-600">{displayName}</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-4 pt-4 border-t border-white/50">
      <div class="flex items-center justify-between text-xs">
        <Badge type="CoMap">CoMap</Badge>
        <span class="text-xs text-slate-500">
          {value.properties && typeof value.properties === "object"
            ? Object.keys(value.properties).length
            : 0}{" "}
          {value.properties &&
          typeof value.properties === "object" &&
          Object.keys(value.properties).length === 1
            ? "property"
            : "properties"}
        </span>
      </div>
    </div>
  </div>
</button>
