<script lang="ts">
  import type { ResolvedCoValueResult } from "@hominio/db";
  import type { LocalNode, CoID, RawCoValue } from "cojson";
  import { CoMap } from "jazz-tools";
  import { CoState } from "jazz-tools/svelte";
  import Badge from "./Badge.svelte";
  import { createCoValueState, deriveResolvedFromCoState } from "$lib/utils/costate-navigation";

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
    schemaDefinition?: any; // Schema definition JSON Schema object
  }

  const {
    propKey,
    propValue,
    node,
    resolvedType,
    onNavigate,
    onObjectNavigate,
    parentCoValue,
    schemaDefinition,
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

  // Get property schema from schema definition (reactive)
  // schemaDefinition prop is already unwrapped by Svelte 5
  const propertySchema = $derived(() => {
    if (!schemaDefinition) return null;
    
    // schemaDefinition is already unwrapped by Svelte 5 props
    const schemaDef = schemaDefinition;
    
    if (!schemaDef || typeof schemaDef !== 'object') return null;
    if (!schemaDef.properties || typeof schemaDef.properties !== 'object') return null;
    
    return schemaDef.properties[propKey] || null;
  });
  
  // Determine display type - use schema definition when available, fallback to runtime detection
  const getDisplayType = (value: any): string => {
    // Computed fields are always strings
    if (isComputedField) {
      return "string";
    }
    if (isCoID && effectiveResolvedType) {
      return effectiveResolvedType.extendedType || effectiveResolvedType.type || "CoValue";
    }
    if (typeof value === "string" && value.startsWith("co_")) {
      return "CoValue";
    }
    
    // Use schema definition type if available (most reliable)
    // Check property schema reactively
    const propSchema = propertySchema;
    if (propSchema && typeof propSchema === 'object' && !Array.isArray(propSchema) && propSchema !== null) {
      // Check for enum first (enum takes precedence over type)
      if (propSchema.enum && Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
        // Only show as enum if value is actually a string (not null)
        if (value === null) {
          // If enum but null, check if schema type is date (dates can be null)
          if (propSchema.type === 'date' || propSchema.type === 'date-time') {
            return "date";
          }
          return "object";
        }
        if (typeof value === "string") {
          return "enum";
        }
        // For non-string values, fall through to type check
      }
      
      // Check type from schema
      const type = propSchema.type;
      if (type === 'date' || type === 'date-time') {
        // If schema says date but value is null, still show as date type
        if (value === null) return "date";
        // Also check for Date objects and ISO strings
        if (value instanceof Date) return "date";
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return "date";
        }
        return "date";
      }
      if (type === 'string') {
        return "string";
      }
      if (type === 'number' || type === 'integer') {
        return "number";
      }
      if (type === 'boolean') {
        return "boolean";
      }
      if (type === 'array') {
        return "array";
      }
      if (type === 'object') {
        return "object";
      }
    }
    
    // Fallback: Check for Date objects and ISO strings (before generic type detection)
    if (value instanceof Date) return "date";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return "date";
    }
    
    // Fallback to runtime type detection if schema definition not available
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) return "array";
    // Handle null - show as "object" (JavaScript quirk: typeof null === "object")
    if (value === null) return "object";
    if (typeof value === "object" && value !== null) return "object";
    return typeof value;
  };

  const displayType = $derived(getDisplayType(propValue));
  const isClickable = $derived(
    (isCoID && onNavigate !== undefined) || isObject,
  );

  // Loading state: CoID but not yet resolved
  // If we have a CoID but no resolvedType, try to resolve it reactively with CoState
  let childCoValueState = $state<CoState<typeof CoMap> | null>(null);
  
  $effect(() => {
    if (isCoID && typeof propValue === 'string' && propValue.startsWith('co_') && !resolvedType) {
      // Create CoState for lazy resolution
      childCoValueState = createCoValueState(propValue as CoID<RawCoValue>);
    } else {
      childCoValueState = null;
    }
  });
  
  // Derive resolved type from CoState if available
  const resolvedTypeFromCoState = $derived(() => {
    if (childCoValueState && typeof propValue === 'string' && propValue.startsWith('co_')) {
      return deriveResolvedFromCoState(childCoValueState, propValue as CoID<RawCoValue>);
    }
    return null;
  });
  
  // Use resolvedType prop if available, otherwise use CoState-derived type
  const effectiveResolvedType = $derived(resolvedType || resolvedTypeFromCoState());
  
  const isLoading = $derived(isCoID && !effectiveResolvedType);

  // Check if this is a CoList type
  const isCoList = $derived(
    effectiveResolvedType?.type === 'colist' || effectiveResolvedType?.extendedType === 'CoList' || displayType === 'COLIST',
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
              {@const displayLabel = effectiveResolvedType?.snapshot && typeof effectiveResolvedType.snapshot === 'object' && '@label' in effectiveResolvedType.snapshot && effectiveResolvedType.snapshot['@label'] ? effectiveResolvedType.snapshot['@label'] : propValue}
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
          {propValue instanceof Date
            ? propValue.toLocaleDateString() + " " + propValue.toLocaleTimeString()
            : typeof propValue === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(propValue)
              ? new Date(propValue).toLocaleDateString() + " " + new Date(propValue).toLocaleTimeString()
              : typeof propValue === "object" &&
                propValue !== null &&
                !Array.isArray(propValue)
                ? JSON.stringify(propValue).slice(0, 50) +
                  (JSON.stringify(propValue).length > 50 ? "..." : "")
                : Array.isArray(propValue)
                  ? `[${propValue.length} items]`
                  : propValue === null
                    ? "null"
                    : String(propValue)}
        </span>
      {/if}

      <Badge type={displayType}>{displayType}</Badge>
    </div>
  </div>
</button>
