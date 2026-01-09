<script lang="ts">
  import type { CoValueContext } from "@maia/db";
  import type { LocalNode, CoID, RawCoValue } from "cojson";
  import { CoMap } from "jazz-tools";
  import { CoState } from "jazz-tools/svelte";
  import Badge from "./Badge.svelte";
  import ListView from "./ListView.svelte";

  interface Props {
    context: CoValueContext;
    coValueState?: CoState<typeof CoMap>;
    propertyPath?: string[]; // Optional property path for accessing nested properties
    node?: LocalNode;
    onNavigate?: (coValueId: string, label?: string) => void;
    onObjectNavigate?: (
      object: any,
      label: string,
      parentCoValue: any,
      parentKey: string,
    ) => void;
    onBack?: () => void;
    view?: "list" | "table" | "grid";
  }

  const {
    context,
    coValueState,
    propertyPath,
    node,
    onNavigate,
    onObjectNavigate,
    onBack,
    view = "list",
  }: Props = $props();

  const displayType = $derived(
    context.resolved.extendedType || context.resolved.type || "CoValue",
  );

  // Get properties reactively - regenerate snapshot from live CoValue
  // This ensures reactivity when the CoValue changes
  const properties = $derived.by(() => {
    // Use CoState if available for full reactivity
    if (coValueState) {
      let coValue = coValueState.current;
      
      // If not loaded, return empty
      if (!coValue.$isLoaded) {
        return {};
      }
      
      // Navigate to nested property if propertyPath is provided
      if (propertyPath && propertyPath.length > 0) {
        // Access nested property from root (e.g., root.schemata)
        for (const key of propertyPath) {
          coValue = (coValue as any)[key];
          if (!coValue || !coValue.$isLoaded) {
            return {};
          }
        }
      }
      
      // Regenerate snapshot from live CoValue (reactive!)
      // toJSON() is called on the live CoValue, so it picks up changes
      const snapshot = coValue.$jazz.raw.toJSON();
      if (!snapshot || typeof snapshot !== 'object') {
        return {};
      }
      
      return snapshot as Record<string, any>;
    }
    
    // Fallback to context snapshot (backward compatibility)
    const snapshot = context.resolved.snapshot;
    if (!snapshot || typeof snapshot !== 'object' || snapshot === 'unavailable') {
      return {};
    }
    
    return snapshot;
  });

  // Show all properties except system properties starting with "@" (shown in metadata sidebar)
  const entries = $derived(
    Object.entries(properties).filter(([key]) => !key.startsWith('@')),
  );

  // Get schema definition using CoState (reactive)
  // Store schema CoState instances to avoid recreating them
  let schemaCoValueStates = $state<Map<CoID<RawCoValue>, CoState<typeof CoMap>>>(new Map());
  
  // Extract schema ID from snapshot (reactive via CoState)
  const schemaId = $derived(() => {
    const snapshot = context.resolved.snapshot;
    if (!snapshot || typeof snapshot !== 'object') return null;
    
    const schemaRef = snapshot['@schema'];
    if (!schemaRef) return null;
    
    return typeof schemaRef === 'string' && schemaRef.startsWith('co_')
      ? schemaRef as CoID<RawCoValue>
      : (schemaRef && typeof schemaRef === 'object' && '$jazz' in schemaRef)
        ? schemaRef.$jazz?.id as CoID<RawCoValue>
        : null;
  });
  
  // Create CoState for schema reactively
  $effect(() => {
    const id = schemaId();
    if (!id) {
      schemaCoValueStates.clear();
      return;
    }
    
    // Get or create CoState for schema with resolve query
    if (!schemaCoValueStates.has(id)) {
      try {
        // Load schema deeply to access its definition property
        const schemaCoValueState = new CoState(CoMap, id, {
          resolve: true, // Load schema and its direct properties (like definition)
        });
        schemaCoValueStates.set(id, schemaCoValueState);
      } catch (_e) {
        // Ignore errors
      }
    }
  });
  
  // Get schema definition reactively from CoState
  const schemaDefinition = $derived(() => {
    const id = schemaId();
    if (!id) return null;
    
    const schemaCoValueState = schemaCoValueStates.get(id);
    if (!schemaCoValueState) return null;
    
    const schemaCoValue = schemaCoValueState.current;
    
    if (!schemaCoValue.$isLoaded) return null;
    
      try {
        // Access definition directly from CoValue (reactive access)
        const definition = (schemaCoValue as any).definition;
      
      // Check if definition has properties
        if (definition && typeof definition === 'object') {
          // For passthrough objects, properties might be accessible directly
          if (definition.properties && typeof definition.properties === 'object') {
            return definition;
          }
          // If properties is missing, try to reconstruct from the definition object itself
          if ('type' in definition && definition.type === 'object' && 'properties' in definition) {
            return definition;
          }
        }
    } catch (_e) {
      // If direct access fails, try snapshot access
    }
    
    // Fallback: try snapshot access from resolved context
    const schemaChild = context.directChildren?.find((c) => c.coValueId === id);
    const schemaSnapshot = schemaChild?.resolved?.snapshot;
    if (schemaSnapshot && typeof schemaSnapshot === 'object' && 'definition' in schemaSnapshot) {
      const definition = schemaSnapshot.definition;
      if (definition && typeof definition === 'object' && definition.properties && typeof definition.properties === 'object') {
        return definition;
      }
    }
    
    return null;
  });
  
  // Schema definition is now reactive via CoState - no need for debug logging

  // Get display label for the CoValue - use @label if available, otherwise use CoID
  const displayLabel = $derived(() => {
    const snapshot = context.resolved.snapshot;
    if (snapshot && typeof snapshot === 'object' && '@label' in snapshot) {
      const label = snapshot['@label'];
      if (typeof label === 'string' && label.trim()) {
        return label;
      }
    }
    // Fallback to CoValue ID (truncated)
    return `${context.coValueId.slice(0, 12)}...`;
  });

  // Initialize with default, then sync with prop
  let currentView = $state<"list" | "table">("list");

  // Sync view prop changes reactively
  $effect(() => {
    const viewValue = view;
    if (viewValue === "list" || viewValue === "table") {
      currentView = viewValue;
    }
  });
</script>

<div class="w-full">
  <!-- View Switcher Tabs (outside card, attached to top with less rounded corners like listitems) -->
  <div class="flex items-end gap-1 mb-0 -mb-px relative z-10 pl-4">
    <button
      type="button"
      onclick={() => (currentView = "list")}
      class="text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-t-lg transition-colors border border-b-0 {currentView ===
      'list'
        ? 'bg-[var(--color-card-bg)] border-[var(--color-card-border)] text-slate-700'
        : 'bg-slate-200 border-transparent text-slate-500 hover:bg-slate-300'}"
      style="border-bottom: none;"
    >
      List
    </button>
    <button
      type="button"
      onclick={() => (currentView = "table")}
      class="text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-t-lg transition-colors border border-b-0 {currentView ===
      'table'
        ? 'bg-[var(--color-card-bg)] border-[var(--color-card-border)] text-slate-700'
        : 'bg-slate-200 border-transparent text-slate-500 hover:bg-slate-300'}"
      style="border-bottom: none;"
    >
      Table
    </button>
  </div>

  <!-- Glass Card Container (matches legacy Card component) -->
  <div class="card">
    <!-- Internal Header -->
    <div class="px-6 py-4 border-b border-slate-200">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-slate-700 m-0">
          {displayLabel()}
        </h2>
        <Badge type={displayType}>{displayType}</Badge>
      </div>
    </div>

    <!-- Content Area -->
    <div class="p-6">
    <!-- Content Views -->
    {#if currentView === "list"}
      <ListView
        {properties}
        {node}
        directChildren={context.directChildren}
        {onNavigate}
        {onObjectNavigate}
        parentCoValue={coValueState ? coValueState.current : null}
        schemaDefinition={schemaDefinition}
      />
    {:else if currentView === "table"}
      <!-- Table View - proper table layout with list item styling -->
      <div class="space-y-3">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th
                class="text-left p-0 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                Property
              </th>
              <th
                class="text-left p-0 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                Type
              </th>
              <th
                class="text-left p-0 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {#each entries as [key, value]}
              {@const isComputedField = key.startsWith("@")}
              {@const isCoID =
                !isComputedField &&
                typeof value === "string" &&
                value.startsWith("co_")}
              {@const isObject =
                !isComputedField &&
                !isCoID &&
                typeof value === "object" &&
                value !== null &&
                !Array.isArray(value) &&
                onObjectNavigate !== undefined}
              {@const child = isCoID
                ? context.directChildren.find((c) => c.key === key)
                : null}
              {@const isClickable = (isCoID && onNavigate !== undefined) || isObject}
              {@const isCoList = child?.resolved?.type === 'colist' || child?.resolved?.extendedType === 'CoList'}
              
              <!-- Get property type from schema definition -->
              {@const propSchema = schemaDefinition?.properties?.[key]}
              {@const schemaType = propSchema?.enum && Array.isArray(propSchema.enum) && propSchema.enum.length > 0 && typeof value === "string" && value !== null
                ? "enum"
                : propSchema?.type === 'date' || propSchema?.type === 'date-time'
                  ? "date"
                  : propSchema?.type || null}
              {@const displayType = isComputedField
                ? "string"
                : isCoID && child?.resolved
                  ? (child.resolved.extendedType || child.resolved.type || "CoValue")
                  : isCoID
                    ? "CoValue"
                    : isObject
                      ? "object"
                      : schemaType || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value))
                        ? "date"
                        : typeof value}
              
              <tr>
                <td class="p-0 pb-3 pr-3">
                  <span
                    class="text-xs font-medium text-slate-500 uppercase tracking-wide truncate"
                    >{key}</span
                  >
                </td>
                <td class="p-0 pb-3 pr-3">
                  <Badge type={displayType}>{displayType}</Badge>
                </td>
                <td class="p-0 pb-3">
                  {#if isClickable}
                    <button
                      type="button"
                      class="w-full text-left bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm cursor-pointer hover:border-slate-300"
                      onclick={() => {
                        if (isCoID && typeof value === "string" && onNavigate) {
                          onNavigate(value, key);
                        } else if (isObject && onObjectNavigate) {
                          onObjectNavigate(value, key, coValueState ? coValueState.current : null, key);
                        }
                      }}
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        {#if isCoID}
                          {#if !isCoList}
                            {@const displayLabel = child?.resolved?.snapshot && typeof child.resolved.snapshot === 'object' && '@label' in child.resolved.snapshot && child.resolved.snapshot['@label'] ? child.resolved.snapshot['@label'] : value}
                            <span
                              class="text-xs text-slate-600 hover:underline"
                              >{displayLabel}</span
                            >
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
                        {:else if isObject}
                          <!-- Object: just arrow, no preview -->
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
                        {:else}
                          <span
                            class="text-xs text-slate-600 break-all min-w-0 text-right"
                          >
                              {Array.isArray(value)
                                ? `[${value.length} items]`
                                : String(value).slice(0, 50)}
                          </span>
                        {/if}
                      </div>
                    </button>
                  {:else}
                    <div
                      class="w-full bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        {#if isCoID}
                          {#if !isCoList}
                            {@const displayLabel = child?.resolved?.snapshot && typeof child.resolved.snapshot === 'object' && '@label' in child.resolved.snapshot && child.resolved.snapshot['@label'] ? child.resolved.snapshot['@label'] : value}
                            <span class="text-xs text-slate-600"
                              >{displayLabel}</span
                            >
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
                        {:else if isObject}
                          <!-- Object: just arrow, no preview -->
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
                        {:else}
                          <span
                            class="text-xs text-slate-600 break-all min-w-0 text-right"
                          >
                            {Array.isArray(value)
                              ? `[${value.length} items]`
                              : String(value).slice(0, 50)}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    </div>
  </div>
</div>
