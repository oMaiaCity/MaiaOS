<script lang="ts">
  import type { ResolvedCoValueResult } from "@hominio/data";
  import type { LocalNode } from "cojson";
  import Badge from "./Badge.svelte";

  interface Props {
    propKey: string;
    propValue: any;
    node?: LocalNode;
    resolvedType?: ResolvedCoValueResult; // Optional resolved type info
    onNavigate?: (coValueId: string, label?: string) => void;
    onObjectNavigate?: (
      object: any,
      label: string,
      parentCoValue: any,
      parentKey: string,
    ) => void;
    parentCoValue?: any; // Parent CoValue context for object navigation
  }

  const {
    propKey,
    propValue,
    node,
    resolvedType,
    onNavigate,
    onObjectNavigate,
    parentCoValue,
  }: Props = $props();

  // Check if this is a computed field (fields starting with @ are computed)
  const isComputedField = $derived(propKey.startsWith("@"));
  
  // Check if value is a CoID (but not if it's a computed field)
  const isCoID = $derived(
    !isComputedField &&
    typeof propValue === "string" &&
    propValue.startsWith("co_"),
  );

  // Check if value is a navigable object (object, not null, not array, not CoID)
  const isObject = $derived(
    typeof propValue === "object" &&
      propValue !== null &&
      !Array.isArray(propValue) &&
      !isCoID &&
      onObjectNavigate !== undefined,
  );

  // Determine display type - use resolved type if available
  const getDisplayType = (value: any): string => {
    // Computed fields are always strings
    if (isComputedField) {
      return "string";
    }
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
  const isClickable = $derived(
    (isCoID && onNavigate !== undefined) || isObject,
  );

  // Loading state: CoID but not yet resolved
  const isLoading = $derived(isCoID && !resolvedType);

  // Check if this is a CoList type
  const isCoList = $derived(
    resolvedType?.type === 'colist' || resolvedType?.extendedType === 'CoList' || displayType === 'COLIST',
  );
</script>

<button
  type="button"
  class="w-full text-left bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm hoverable {isClickable &&
  !isLoading
    ? 'cursor-pointer hover:border-slate-300'
    : 'cursor-default'}"
  onclick={() => {
    // Prevent navigation during loading
    if (isLoading) return;

    if (isCoID && typeof propValue === "string" && onNavigate) {
      onNavigate(propValue, propKey);
    } else if (isObject && onObjectNavigate) {
      // For objects, parentCoValue is optional - we can use the object itself or undefined
      onObjectNavigate(propValue, propKey, parentCoValue || propValue, propKey);
    }
  }}
>
  <div class="flex justify-between items-center gap-2">
    <!-- Left side: Prop Key -->
    <div class="flex items-center gap-1.5 flex-shrink-0 min-w-0">
      <span
        class="text-xs font-medium text-slate-500 uppercase tracking-wide truncate"
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
            <!-- CoID as clickable text - use @label if available, otherwise use ID (hide ID for CoList) -->
            {#if !isCoList}
              {@const displayLabel = resolvedType?.snapshot && typeof resolvedType.snapshot === 'object' && '@label' in resolvedType.snapshot && resolvedType.snapshot['@label'] ? resolvedType.snapshot['@label'] : propValue}
              <span class="text-xs font-mono text-slate-600 hover:underline"
                >{displayLabel}</span
              >
            {/if}
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
      {:else if isObject}
        <!-- Object value display - clickable (just arrow, no preview) -->
        <div class="inline-flex items-center gap-2 text-left min-w-0">
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
          {typeof propValue === "object" &&
          propValue !== null &&
          !Array.isArray(propValue)
            ? JSON.stringify(propValue).slice(0, 50) +
              (JSON.stringify(propValue).length > 50 ? "..." : "")
            : Array.isArray(propValue)
              ? `[${propValue.length} items]`
              : String(propValue)}
        </span>
      {/if}

      <Badge type={displayType}>{displayType}</Badge>
    </div>
  </div>
</button>
