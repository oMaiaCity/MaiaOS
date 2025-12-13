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

  // Get property schema from schema definition
  // schemaDefinition prop might be a $derived() function - we need to access it reactively
  // In Svelte 5, props are reactive, so accessing schemaDefinition here will trigger reactivity
  const propertySchema = $derived(() => {
    // Access the prop value - if it's a function (from $derived), we need to call it
    // But props should already be unwrapped, so this should be the actual value
    let schemaDefValue: any = schemaDefinition;
    
    // If schemaDefinition is still a function (shouldn't happen, but handle it)
    if (typeof schemaDefValue === 'function') {
      try {
        schemaDefValue = schemaDefValue();
      } catch (_e) {
        return null;
      }
    }
    
    if (!schemaDefValue || typeof schemaDefValue !== 'object') return null;
    if (!schemaDefValue.properties || typeof schemaDefValue.properties !== 'object') return null;
    return schemaDefValue.properties[propKey] || null;
  });
  
  // Debug: Log property schema changes for priority and status
  $effect(() => {
    if (propKey === 'priority' || propKey === 'status') {
      try {
        // Access the actual values reactively - propertySchema is a $derived(), so access it
        const propSchemaValue = propertySchema;
        
        // Access schemaDefinition prop - unwrap if it's a function
        let schemaDefValue: any = schemaDefinition;
        if (typeof schemaDefValue === 'function') {
          try {
            schemaDefValue = schemaDefValue();
          } catch (_e) {
            schemaDefValue = null;
          }
        }
        
        // Log the actual propertySchema object directly
        console.log(`[ListItem] ${propKey} - propertySchema direct:`, propSchemaValue);
        console.log(`[ListItem] ${propKey} - propertySchema.enum:`, propSchemaValue?.enum);
        console.log(`[ListItem] ${propKey} - propertySchema.type:`, propSchemaValue?.type);
        console.log(`[ListItem] ${propKey} - typeof propertySchema:`, typeof propSchemaValue);
        console.log(`[ListItem] ${propKey} - propertySchema keys:`, propSchemaValue && typeof propSchemaValue === 'object' ? Object.keys(propSchemaValue) : 'not an object');
        
        // Log the schema definition
        console.log(`[ListItem] ${propKey} - schemaDefinition (unwrapped):`, schemaDefValue);
        console.log(`[ListItem] ${propKey} - schemaDefinition.properties:`, schemaDefValue?.properties);
        console.log(`[ListItem] ${propKey} - schemaDefinition.properties.${propKey}:`, schemaDefValue?.properties?.[propKey]);
        
        // Try to get the property schema directly from schemaDefinition
        const directPropSchema = schemaDefValue?.properties?.[propKey];
        console.log(`[ListItem] ${propKey} - directPropSchema:`, directPropSchema);
        console.log(`[ListItem] ${propKey} - directPropSchema.enum:`, directPropSchema?.enum);
      } catch (e) {
        console.log(`[ListItem] Error logging ${propKey} propertySchema:`, e);
      }
    }
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
    
    // Check for Date objects first (before schema check, since Date can be serialized)
    if (value instanceof Date) return "date";
    // Check for Date strings (ISO format) - dates are serialized to ISO strings in JSON snapshots
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return "date";
    }
    
    // Use schema definition type if available (most reliable)
    // Access schemaDefinition prop directly and get property schema from it
    // This avoids the $derived() unwrapping issue
    let schemaDefValue: any = schemaDefinition;
    if (typeof schemaDefValue === 'function') {
      try {
        schemaDefValue = schemaDefValue();
      } catch (_e) {
        schemaDefValue = null;
      }
    }
    
    if (schemaDefValue && typeof schemaDefValue === 'object' && schemaDefValue.properties && typeof schemaDefValue.properties === 'object') {
      const propSchema = schemaDefValue.properties[propKey];
      if (propSchema && typeof propSchema === 'object' && !Array.isArray(propSchema) && propSchema !== null) {
        // Check for enum first (enum takes precedence)
        if (propSchema.enum && Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
          // Only show as enum if value is actually a string (not null)
          if (value === null) return "object";
          if (typeof value === "string") {
            return "enum";
          }
          // For non-string values, fall through to runtime detection
        }
        
        // Check type from schema
        const type = propSchema.type;
        if (type === 'date' || type === 'date-time') {
          // If schema says date but value is null, still show as date type
          if (value === null) return "date";
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
