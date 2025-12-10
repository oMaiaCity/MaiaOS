<script lang="ts">
  import { browser } from "$app/environment";
  import { createDataStore, type Data } from "./dataStore";
  import { loadActionsFromRegistry } from "./skillLoader";
  import { registerAllSkills } from "./skills";
  import type { VibeConfig } from "./types";
  import ViewRenderer from "./view/ViewRenderer.svelte";

  // ========== PROPS ==========
  interface Props {
    config: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  let { config, onEvent }: Props = $props();

  // ========== SKILL REGISTRY SETUP ==========
  // Register all available skills (can be called once globally)
  // Only register in browser to avoid SSR issues
  if (browser) {
    registerAllSkills();
  }

  // ========== UNIFIED DATA STORE SETUP ==========
  // Only initialize in browser to avoid SSR issues
  let dataStore: ReturnType<typeof createDataStore> | null = $state(null);
  let resolvedConfig: ReturnType<typeof loadActionsFromRegistry> | null = $state(null);

  $effect(() => {
    if (browser) {
      // Load actions from skill registry based on skill IDs in config
      const loadedConfig = loadActionsFromRegistry(config.stateMachine);

      // Merge any explicit actions (override registry)
      if (config.actions) {
        loadedConfig.actions = {
          ...loadedConfig.actions,
          ...config.actions,
        };
      }

      resolvedConfig = loadedConfig;

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

      dataStore = createDataStore(loadedConfig);
    }
  });

  // ========== REACTIVE DATA ACCESS ==========
  // Single unified reactive interface - everything is just data
  const data = $derived(dataStore ? $dataStore : config.stateMachine.data || {}) as Data;

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
  <div class="w-full h-full">
    <ViewRenderer
      node={{
        slot: "root",
        composite: config.view.composite,
      }}
      {data}
      {config}
      onEvent={handleSlotEvent}
    />
  </div>
{:else}
  <!-- SSR fallback -->
  <div class="min-h-screen bg-gray-100 pt-20 px-4 flex items-center justify-center">
    <div class="text-slate-600">Loading...</div>
  </div>
{/if}
