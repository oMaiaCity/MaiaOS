<script lang="ts">
  import { browser } from "$app/environment";
  import { createDataStore, type Data } from "./dataStore";
  import { loadActionsFromRegistry } from "./skillLoader";
  import { registerAllSkills } from "./skills";
  import type { VibeConfig } from "./types";
  import type { ViewNode } from "./view/types";
  import Composite from "./view/Composite.svelte";
  import Leaf from "./view/Leaf.svelte";

  // ========== PROPS ==========
  interface Props {
    config: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
    account?: any; // Optional Jazz account for database integration
  }

  const { config, onEvent, account }: Props = $props();

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
  let _initialized = $state(false);

  // Track account - use the account prop directly (should be account.current from parent)
  const accountReady = $derived(account && (account as any).$isLoaded ? account : null);

  $effect(() => {
    if (browser && !_initialized) {
      console.log('[Vibe] Initializing dataStore...');
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

      // Create dataStore once - Jazz integration will be added when account is ready
      console.log('[Vibe] Creating dataStore with account:', accountReady ? 'present' : 'missing');
      dataStore = createDataStore(loadedConfig, accountReady || undefined);
      _initialized = true;
      console.log('[Vibe] DataStore created');
    }
  });

  // Separate effect to add Jazz integration when account becomes available
  let jazzInitialized = $state(false);
  $effect(() => {
    console.log('[Vibe] Jazz init effect - browser:', browser, 'dataStore:', !!dataStore, 'accountReady:', !!accountReady, 'jazzInitialized:', jazzInitialized);
    if (browser && dataStore && accountReady && !jazzInitialized) {
      // Account just became available - initialize Jazz integration
      console.log('[Vibe] Starting Jazz initialization...');
      jazzInitialized = true;
      const initializeJazz = async () => {
        try {
          // Ensure account is fully loaded
          await (accountReady as any).$jazz.ensureLoaded({
            resolve: { root: { entities: true, schemata: true } },
          });

          // Store account reference in data for skills to access
          dataStore!.update((data) => {
            return { ...data, _jazzAccount: accountReady }
          })

          // Import JazzQueryManager dynamically to avoid circular dependencies
          const { JazzQueryManager } = await import('./jazz-query-manager.js')
          const queryManager = new JazzQueryManager(accountReady)
          dataStore!.jazzQueryManager = queryManager

          // Store queryManager reference in data for skills to access
          dataStore!.update((data) => {
            return { ...data, _jazzQueryManager: queryManager }
          })

          // Query todos and update data.queries.todos
          console.log('[Vibe] Querying todos from Jazz...')
          const todos = await queryManager.queryEntitiesBySchema(
            'Todo',
            queryManager.coValueToTodoPlainObject.bind(queryManager) as (coValue: any) => Record<string, unknown>,
          )
          console.log('[Vibe] Query result - todos:', todos)
          console.log('[Vibe] Number of todos found:', todos.length)

          // Update data.queries.todos
          dataStore!.update((data) => {
            const newData = { ...data }
            if (!newData.queries) {
              newData.queries = {}
            }
            const queries = { ...(newData.queries as Record<string, unknown>) }
            queries.todos = todos
            queries.title = queries.title || 'Todos'
            console.log('[Vibe] Updating data.queries.todos with:', queries.todos)
            newData.queries = queries
            return newData
          })
          console.log('[Vibe] Data updated. Current todos count:', todos.length)

          // Set up reactive subscriptions
          queryManager.subscribeToEntities(
            'Todo',
            'todos',
            dataStore!,
            queryManager.coValueToTodoPlainObject.bind(queryManager) as (coValue: any) => Record<string, unknown>,
          )
        } catch (_error) {
          // Jazz initialization failed - reset flag to retry
          jazzInitialized = false;
        }
      }

      initializeJazz()
    }
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
