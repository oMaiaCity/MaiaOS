<script lang="ts">
  import { browser } from "$app/environment";
  import { createDataStore, type Data } from "../dataStore";
  import { loadActionsFromRegistry } from "../skillLoader";
  import { registerAllSkills } from "../skills";
  import type { VibeConfig } from "../types";
  import type { ViewNode } from "./types";
  import Composite from "./Composite.svelte";
  import Leaf from "./Leaf.svelte";
  import { useQuery, type QueryOptions } from "../useQuery.svelte";

  // ========== PROPS ==========
  interface Props {
    config: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
    accountCoState?: any; // AccountCoState instance for database integration
  }

  const { config, onEvent, accountCoState }: Props = $props();

  // ========== SKILL REGISTRY SETUP ==========
  // Register all available skills (can be called once globally)
  // Only register in browser to avoid SSR issues
  if (browser) {
    registerAllSkills();
  }

  // ========== UNIFIED DATA STORE SETUP ==========
  // Only initialize in browser to avoid SSR issues
  let dataStore: ReturnType<typeof createDataStore> | null = $state(null);
  let _resolvedConfig: ReturnType<typeof loadActionsFromRegistry> | null =
    $state(null);
  let _lastConfigId = $state<string | null>(null);

  // Unwrap AccountCoState inside component to establish reactivity
  // Access .current inside $derived to create reactive subscription
  const accountReady = $derived(
    accountCoState && accountCoState.current?.$isLoaded 
      ? accountCoState.current 
      : null
  );

  // Store account reference in dataStore for skills to access
  // Store the AccountCoState in dataStore for skills to use (clean CoState pattern)
  $effect(() => {
    if (browser && dataStore && accountCoState) {
      dataStore.update((data) => {
        return { ...data, _jazzAccountCoState: accountCoState };
      });
    }
  });

  // Create a unique ID for the config to detect changes
  const configId = $derived(JSON.stringify(config.stateMachine));

  $effect(() => {
    if (browser) {
      // Check if config changed - if so, recreate dataStore
      const configChanged = _lastConfigId !== configId;
      
      if (!dataStore || configChanged) {
        // Load actions from skill registry based on skill IDs in config
        const loadedConfig = loadActionsFromRegistry(config.stateMachine);

        // Merge any explicit actions (override registry)
        if (config.actions) {
          loadedConfig.actions = {
            ...loadedConfig.actions,
            ...config.actions,
          };
        }

        _resolvedConfig = loadedConfig;

        // Add configJson to initial data (for config view) - avoid circular dependency
        // Stringify the full config including stateMachine and view
        if (loadedConfig.data) {
          loadedConfig.data.configJson = JSON.stringify(
            {
              stateMachine: config.stateMachine,
              view: config.view,
            },
            null,
            2,
          );
        }

        // Create or recreate dataStore when config changes
        dataStore = createDataStore(loadedConfig, accountReady || undefined);
        _lastConfigId = configId;
      }
    }
  });

  // Separate effect to add Jazz integration when account becomes available
  // Reset jazzInitialized when config changes to allow re-initialization
  let jazzInitialized = $state(false);
  let lastJazzConfigId = $state<string | null>(null);
  
  $effect(() => {
    // Reset jazz initialization if config changed
    if (lastJazzConfigId !== configId) {
      jazzInitialized = false;
      lastJazzConfigId = configId;
    }
  });

  // Use useQuery hooks for each query definition in config.data.queries
  // Read query definitions from config
  const queryDefinitions = $derived.by(() => {
    if (!_resolvedConfig?.data?.queries) {
      return [];
    }
    const queries = _resolvedConfig.data.queries as Record<string, unknown>;
    const definitions: Array<{ queryKey: string; schemaName: string; options?: QueryOptions }> = [];
    
    for (const [queryKey, queryValue] of Object.entries(queries)) {
      // Check if this is a query definition (object with schemaName)
      if (
        queryValue &&
        typeof queryValue === 'object' &&
        !Array.isArray(queryValue) &&
        'schemaName' in queryValue
      ) {
        const queryConfig = queryValue as { schemaName: string } & QueryOptions;
        const schemaName = queryConfig.schemaName;
        
        if (schemaName && typeof schemaName === 'string') {
          // Extract query options
          const options: QueryOptions = {};
          if (queryConfig.filter) options.filter = queryConfig.filter;
          if (queryConfig.sort) options.sort = queryConfig.sort;
          if (queryConfig.limit !== undefined) options.limit = queryConfig.limit;
          if (queryConfig.offset !== undefined) options.offset = queryConfig.offset;
          
          definitions.push({ queryKey, schemaName, options });
        }
      }
    }
    
    return definitions;
  });

  // Create useQuery hooks for each query definition reactively
  // Since useQuery uses Svelte runes, we need to call it unconditionally at top level
  // We'll create hooks for up to 10 queries (reasonable limit for most vibes)
  // and map them to queryDefinitions reactively using derived schema names
  
  // Create schema accessor functions - these will be called INSIDE useQuery's $derived.by()
  // This follows the original CoState reactive pattern: access reactive state inside derived
  const getSchema0 = () => queryDefinitions[0]?.schemaName || '';
  const getSchema1 = () => queryDefinitions[1]?.schemaName || '';
  const getOptions0 = () => queryDefinitions[0]?.options;
  const getOptions1 = () => queryDefinitions[1]?.options;
  
  // Call useQuery with accessor functions at top level (unconditionally)
  // useQuery will call these functions inside its $derived.by() to access reactively
  const query0 = useQuery(accountCoState, getSchema0, getOptions0);
  const query1 = useQuery(accountCoState, getSchema1, getOptions1);
  
  // Map queries to their queryKeys reactively
  const queryHooks = $derived.by(() => {
    const hooks = new Map<string, ReturnType<typeof useQuery>>();
    const queries = [query0, query1];
    
    for (let i = 0; i < Math.min(queryDefinitions.length, queries.length); i++) {
      const def = queryDefinitions[i];
      if (def && def.schemaName && queries[i]) {
        hooks.set(def.queryKey, queries[i]);
      }
    }
    
    return hooks;
  });

  // Collect all query results reactively
  const queryResults = $derived.by(() => {
    const results = new Map<string, Array<Record<string, unknown>>>();
    const hooks = queryHooks;
    
    for (const [queryKey, hook] of hooks) {
      if (hook && hook.entities) {
        const entities = hook.entities;
        if (Array.isArray(entities)) {
          results.set(queryKey, entities);
        }
      }
    }
    
    return results;
  });

  // Update dataStore.queries reactively when query results change
  $effect(() => {
    if (!browser || !dataStore) {
      return;
    }
    
    const results = queryResults;
    
    if (results.size === 0) {
      return;
    }
    
    // Update dataStore with query results
    dataStore.update((data) => {
      const newData = { ...data };
      if (!newData.queries) {
        newData.queries = {};
      }
      
      const queries = { ...(newData.queries as Record<string, unknown>) };
      
      // Update each query result
      for (const [queryKey, entities] of results) {
        queries[queryKey] = entities;
      }
      
      newData.queries = queries;
      return newData;
    });
  });

  // ========== REACTIVE DATA ACCESS ==========
  // Single unified reactive interface - everything is just data
  const data = $derived(
    dataStore ? $dataStore : config.stateMachine.data || {},
  ) as Data;

  // Event handler for UI slots
  const handleSlotEvent = (event: string, payload?: unknown) => {
    // Call optional external event handler first (for navigation, etc.)
    if (onEvent) {
      onEvent(event, payload);
    }

    // Then send to data store
    if (dataStore) {
      dataStore.send(event, payload);
    }
  };
</script>

{#if browser && dataStore}
  <!-- Unified View Renderer - Composite/Leaf pattern -->
  <!-- All styling comes from the root composite configuration - only dimensions are set here -->
  <div class="w-full h-full @container">
    {#if config.view.composite}
      {@const rootNode: ViewNode = {
        slot: "root",
        composite: config.view.composite,
      }}
      <!-- Composite node - render as layout container -->
      <Composite node={rootNode} {data} {config} onEvent={handleSlotEvent} />
    {:else if config.view.leaf}
      {@const rootNode: ViewNode = {
        slot: "root",
        leaf: config.view.leaf,
      }}
      <!-- Leaf node - render as content using JSON-driven leaf definition -->
      <Leaf node={rootNode} {data} {config} onEvent={handleSlotEvent} />
    {:else}
      <!-- Invalid node - neither composite nor leaf -->
      <div class="text-red-500 text-sm">
        Invalid view node: must have either composite or leaf
      </div>
    {/if}
  </div>
{:else}
  <!-- SSR fallback -->
  <div
    class="min-h-full bg-gray-100 pt-20 px-4 flex items-center justify-center"
  >
    <div class="text-slate-600">Loading...</div>
  </div>
{/if}
