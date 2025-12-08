<script lang="ts">
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
  registerAllSkills();

  // ========== UNIFIED DATA STORE SETUP ==========
  // Load actions from skill registry based on skill IDs in config
  const resolvedConfig = loadActionsFromRegistry(config.stateMachine);

  // Merge any explicit actions (override registry)
  if (config.actions) {
    resolvedConfig.actions = {
      ...resolvedConfig.actions,
      ...config.actions,
    };
  }

  const dataStore = createDataStore(resolvedConfig);

  // ========== REACTIVE DATA ACCESS ==========
  // Single unified reactive interface - everything is just data
  const data = $derived($dataStore);

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
    dataStore.send(event, payload);
  };
</script>

<!-- UI Slot-based rendering - fully generic and config-driven -->
<RenderView
  config={{
    slots: config.uiSlots.slots,
    layout: {
      container: containerClass,
      wrapper: "max-w-4xl mx-auto py-8",
      card: cardClass,
    },
  }}
  {data}
  onEvent={handleSlotEvent}
/>
