<script lang="ts">
  import { browser } from "$app/environment";
  import { createDataStore, type Data } from "../dataStore";
  import { loadActionsFromRegistry } from "../skillLoader";
  import { registerAllSkills } from "../skills";
  import type { VibeConfig } from "../types";
  import type { ViewNode } from "./types";
  import Composite from "./Composite.svelte";
  import Leaf from "./Leaf.svelte";

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
  let _lastConfigId = $state<string | null>(null);

  // Track account - use the account prop directly (should be account.current from parent)
  const accountReady = $derived(account && (account as any).$isLoaded ? account : null);

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

  $effect(() => {
    if (browser && dataStore && accountReady && !jazzInitialized && _resolvedConfig) {
      // Account just became available - trigger query initialization in DataStore
      // DataStore will handle all query initialization based on config.data.queries
      jazzInitialized = true;
      const initializeJazz = async () => {
        try {
          // Ensure account is fully loaded
          await (accountReady as any).$jazz.ensureLoaded({
            resolve: { root: { entities: true, schemata: true } },
          });

          // Only initialize if queryManager doesn't exist yet
          if (!dataStore.jazzQueryManager) {
            // Import and call initializeQueries function
            const { initializeQueries } = await import('../dataStore.js');
            await initializeQueries(dataStore, _resolvedConfig, accountReady);
          }
        } catch (_error) {
          // Jazz initialization failed - reset flag to retry
          jazzInitialized = false;
        }
      };

      initializeJazz();
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
