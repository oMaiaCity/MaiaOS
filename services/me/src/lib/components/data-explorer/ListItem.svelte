<script lang="ts">
  import type { LocalNode } from "cojson";
  import Badge from "./Badge.svelte";
  import type { ResolvedCoValueResult } from "@hominio/data";

  interface Props {
    propKey: string;
    propValue: any;
    node?: LocalNode;
    resolvedType?: ResolvedCoValueResult; // Optional resolved type info
    onNavigate?: (coValueId: string, label?: string) => void;
  }

  let { propKey, propValue, node, resolvedType, onNavigate }: Props = $props();

  // Check if value is a CoID
  const isCoID = $derived(typeof propValue === "string" && propValue.startsWith("co_"));

  // Determine display type - use resolved type if available
  const getDisplayType = (value: any): string => {
    if (isCoID && resolvedType) {
      return resolvedType.extendedType || resolvedType.type || "CoValue";
    }
    if (typeof value === "string" && value.startsWith("co_")) {
      return "CoValue";
    }
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object" && value !== null) return "object";
    return typeof value;
  };

  const displayType = $derived(getDisplayType(propValue));
  const isClickable = $derived(isCoID && onNavigate !== undefined);

  // Loading state: CoID but not yet resolved
  const isLoading = $derived(isCoID && !resolvedType);
</script>

<button
  type="button"
  class="w-full text-left bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm hoverable {isClickable &&
  !isLoading
    ? 'cursor-pointer hover:bg-slate-200'
    : 'cursor-default'}"
  onclick={() => {
    // Prevent navigation during loading
    if (isClickable && !isLoading && typeof propValue === "string") {
      onNavigate?.(propValue, propKey);
    }
  }}
>
  <div class="flex justify-between items-center gap-2">
    <!-- Left side: Prop Key -->
    <div class="flex items-center gap-1.5 flex-shrink-0 min-w-0">
      <span class="text-xs font-medium text-slate-500 uppercase tracking-wide truncate"
        >{propKey}</span
      >
    </div>

    <!-- Right side: Value and Badge -->
    <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
      {#if isCoID && node}
        <div class="inline-flex items-center gap-2 text-left min-w-0">
          {#if isLoading}
            <!-- Loading indicator -->
            <div class="flex items-center gap-1 text-xs text-slate-500">
              <svg
                class="w-3 h-3 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span class="font-mono text-xs truncate text-slate-600"
                >{propValue.slice(0, 12)}...</span
              >
            </div>
          {:else}
            <!-- CoID as clickable text -->
            <span class="text-xs font-mono text-slate-600 hover:underline">{propValue}</span>
          {/if}
          <svg
            class="w-3 h-3 text-slate-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      {:else}
        <!-- Primitive value display -->
        <span class="text-xs text-slate-600 break-all min-w-0">
          {typeof propValue === "object" && propValue !== null
            ? JSON.stringify(propValue).slice(0, 50) +
              (JSON.stringify(propValue).length > 50 ? "..." : "")
            : String(propValue)}
        </span>
      {/if}

      <Badge type={displayType}>{displayType}</Badge>
    </div>
  </div>
</button>
