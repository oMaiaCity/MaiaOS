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
  }

  let { config }: Props = $props();

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
    dataStore = createDataStore(loadedConfig);
  }

  // ========== REACTIVE DATA ACCESS ==========
  // Single unified reactive interface - everything is just data
  const data = $derived(dataStore ? $dataStore : config.stateMachine.data || {}) as Data;

  // ========== UI CLASSES ==========
  const containerClass = $derived(
    config.ui?.containerClass || "min-h-screen bg-gray-100 pt-20 px-4",
  );
  const cardClass = $derived(
    config.ui?.cardClass ||
      "relative overflow-hidden rounded-3xl bg-slate-50 border border-white shadow-card-default p-6",
  );

  // Event handler for UI slots
  const handleSlotEvent = (event: string, payload?: unknown) => {
    if (dataStore) {
      dataStore.send(event, payload);
    }
  };
</script>

{#if browser && dataStore}
  <!-- Unified View Renderer - Composite/Leaf pattern -->
  <div class={containerClass} style="height: 100%;">
    <div class="max-w-4xl mx-auto py-8" style="height: 100%;">
      <div class={cardClass} style="height: 100%; display: flex; flex-direction: column;">
        {#if dataStore}
          <ViewRenderer
            node={{
              slot: "root",
              composite: config.view.composite,
            }}
            {data}
            {config}
            onEvent={handleSlotEvent}
          />
        {/if}
      </div>
    </div>
  </div>
{:else}
  <!-- SSR fallback -->
  <div class="min-h-screen bg-gray-100 pt-20 px-4 flex items-center justify-center">
    <div class="text-slate-600">Loading...</div>
  </div>
{/if}
