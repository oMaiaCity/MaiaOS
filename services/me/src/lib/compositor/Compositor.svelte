<script lang="ts">
  import { browser } from "$app/environment";
  import { createDataStore } from "./dataStore";
  import { loadActionsFromRegistry } from "./skillLoader";
  import { registerAllSkills } from "./skills";
  import type { CompositorConfig } from "./types";
  import RenderView from "./ui-slots/RenderView.svelte";

  // ========== PROPS ==========
  interface Props {
    config: CompositorConfig;
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
    resolvedConfig = loadActionsFromRegistry(config.stateMachine);

    // Merge any explicit actions (override registry)
    if (config.actions) {
      resolvedConfig.actions = {
        ...resolvedConfig.actions,
        ...config.actions,
      };
    }

    dataStore = createDataStore(resolvedConfig);
  }

  // ========== REACTIVE DATA ACCESS ==========
  // Single unified reactive interface - everything is just data
  const data = $derived(dataStore ? $dataStore : (config.stateMachine.data || {}));

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
  <!-- UI Slot-based rendering - fully generic and config-driven -->
  <RenderView
    config={{
      slots: config.view.slots,
      layout: {
        container: containerClass,
        wrapper: "max-w-4xl mx-auto py-8",
        card: cardClass,
      },
    }}
    layoutConfig={config.layout}
    {data}
    onEvent={handleSlotEvent}
  />
{:else}
  <!-- SSR fallback -->
  <div class="min-h-screen bg-gray-100 pt-20 px-4 flex items-center justify-center">
    <div class="text-slate-600">Loading...</div>
  </div>
{/if}
