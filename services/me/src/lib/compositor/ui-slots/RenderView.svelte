<!--
  Slot Renderer Component
  Renders UI based on slot configuration - fully generic and universal
-->
<script lang="ts">
  import { HOVERABLE_STYLE } from "$lib/utils/styles";
  import { resolveUISlots, getSlotValue } from "./resolver";
  import { renderSlot, getSlotsByPattern } from "./renderer";
  import type { UISlotConfig } from "./types";
  import type { Data } from "../dataStore";

  interface Props {
    config: UISlotConfig;
    data: Data;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  let { config, data, onEvent }: Props = $props();

  // Resolve all slots with data values
  const resolvedSlots = $derived(resolveUISlots(data, config.slots));

  // Helper to get slot value
  const getValue = (slotId: string): unknown => {
    return getSlotValue(resolvedSlots, slotId);
  };

  // Helper to check if slot exists (regardless of value)
  const hasSlot = (slotId: string): boolean => {
    return resolvedSlots.some((s) => s.slot === slotId);
  };

  // Helper to get slot mapping (for event config)
  const getSlotMapping = (slotId: string) => {
    return config.slots.find((s) => s.slot === slotId);
  };

  // Helper to render a slot
  const render = (slotId: string): unknown => {
    return renderSlot(
      {
        slots: resolvedSlots,
        data: data as Record<string, unknown>,
        onEvent,
      },
      slotId,
    );
  };

  // Helper to trigger event from slot mapping
  const triggerEvent = (
    slotId: string,
    interaction:
      | "onSubmit"
      | "onInput"
      | "onChange"
      | "onClick"
      | "onToggle"
      | "onDelete"
      | "onClear",
    itemData?: Record<string, unknown>,
    additionalPayload?: Record<string, unknown>,
  ) => {
    const mapping = getSlotMapping(slotId);
    const eventConfig = mapping?.events?.[interaction];

    if (!eventConfig) return;

    let eventName: string;
    let payload: unknown = undefined;

    if (typeof eventConfig === "string") {
      eventName = eventConfig;
      // Default payload based on interaction type
      if (interaction === "onSubmit" || interaction === "onInput") {
        const inputData = render(slotId) as Record<string, unknown>;
        payload = { text: inputData.value || "", ...additionalPayload };
      } else if (interaction === "onToggle" || interaction === "onDelete") {
        payload = { todoId: itemData?.id, ...additionalPayload };
      } else {
        payload = additionalPayload;
      }
    } else {
      eventName = eventConfig.event;
      if (eventConfig.payload) {
        payload = eventConfig.payload(itemData || {});
      } else {
        // Default payload
        if (interaction === "onSubmit" || interaction === "onInput") {
          const inputData = render(slotId) as Record<string, unknown>;
          payload = { text: inputData.value || "", ...additionalPayload };
        } else if (interaction === "onToggle" || interaction === "onDelete") {
          payload = { todoId: itemData?.id, ...additionalPayload };
        } else {
          payload = additionalPayload;
        }
      }
    }

    onEvent?.(eventName, payload);
  };

  // Get list items for a list slot
  const getListItems = (listSlotId: string): Array<Record<string, unknown>> => {
    const listValue = getValue(listSlotId);
    if (!Array.isArray(listValue)) return [];

    // Find item slots (e.g., "list.item.*")
    const itemSlots = getSlotsByPattern(resolvedSlots, `${listSlotId}.item.*`);

    return listValue.map((item, index) => {
      const itemData: Record<string, unknown> = {
        ...(typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {}),
        _index: index,
      };

      // Resolve item slot values
      itemSlots.forEach((slot) => {
        const itemKey = slot.slot.replace(`${listSlotId}.item.`, "");
        if (typeof item === "object" && item !== null) {
          const itemValue = (item as Record<string, unknown>)[itemKey];
          itemData[itemKey] = itemValue;
        }
      });

      return itemData;
    });
  };

  // Get isLoading state
  const isLoading = $derived((data.isLoading as boolean) || false);
</script>

<!-- Render slots based on configuration -->
<!-- Outer container wrapper (hardcoded for now) -->
<div class={config.layout?.container || ""}>
  <div class={config.layout?.wrapper || "max-w-4xl mx-auto py-8"}>
    <div class={config.layout?.card || ""}>
      <!-- Title Slot -->
      {#if getValue("title")}
        <div class="text-center mb-6">
          <h1 class="text-3xl font-bold text-slate-900 mb-2">
            {String(render("title"))}
          </h1>
          {#if getValue("description")}
            <p class="text-slate-600">{String(render("description"))}</p>
          {/if}
        </div>
      {/if}

      <!-- List Slot -->
      {#if getValue("list")}
        <div class="mt-6 pt-6 border-t border-white/50">
          <h2 class="text-xl font-semibold text-slate-700 mb-4 uppercase tracking-wider">
            Todo List
          </h2>

          <!-- Add Todo Form -->
          {#if hasSlot("input.value")}
            {@const inputData = render("input.value") as Record}
            {@const inputMapping = getSlotMapping("input.value")}
            <form
              onsubmit={(e) => {
                e.preventDefault();
                const text = String(inputData.value || "");
                if (text.trim()) {
                  triggerEvent("input.value", "onSubmit");
                  // Trigger success event if configured
                  const successMapping = getSlotMapping("input.value");
                  if (successMapping?.events?.onSubmit) {
                    onEvent?.("SUCCESS");
                  }
                }
              }}
              class="mb-4 flex gap-2"
            >
              <input
                type={String(inputData.type || "text")}
                value={String(inputData.value || "")}
                placeholder={String(inputMapping?.config?.placeholder || "Add a new todo...")}
                oninput={(e) => {
                  triggerEvent("input.value", "onInput", undefined, {
                    text: e.currentTarget.value,
                  });
                }}
                class="flex-1 px-4 py-2 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-300 transition-all text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={isLoading}
                class="px-4 py-2 bg-[#001a42] border border-[#001a42] text-[#e6ecf7] rounded-full shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Adding..." : String(inputMapping?.config?.submitLabel || "Add")}
              </button>
            </form>
          {/if}

          <!-- Error Slot -->
          {#if getValue("error")}
            {@const errorMapping = getSlotMapping("error")}
            <div
              class="mb-4 px-4 py-2 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {String(render("error"))}
              {#if errorMapping?.events?.onClear}
                <button
                  type="button"
                  onclick={() => triggerEvent("error", "onClear")}
                  class="ml-2 text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              {/if}
            </div>
          {/if}

          <!-- Todo Items -->
          <ul class="space-y-2">
            {#each getListItems("list") as item (item.id || item._index)}
              {@const listItemMapping = getSlotMapping("list.item.id")}
              <li
                class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE}"
              >
                <!-- Checkbox for toggle -->
                {#if listItemMapping?.events?.onToggle}
                  <input
                    type="checkbox"
                    checked={Boolean(item.completed)}
                    onchange={() => {
                      triggerEvent("list.item.id", "onToggle", item as Record);
                    }}
                    class="w-5 h-5 rounded border-slate-300 text-[#001a42] focus:ring-2 focus:ring-[#001a42] cursor-pointer"
                  />
                {/if}
                <!-- Todo Text -->
                {#if item.text}
                  <span
                    class="flex-1 text-sm {item.completed
                      ? 'line-through text-slate-500'
                      : 'text-slate-700 font-medium'}"
                  >
                    {String(item.text)}
                  </span>
                {/if}
                <!-- Delete Button -->
                {#if listItemMapping?.events?.onDelete}
                  <button
                    type="button"
                    onclick={() => {
                      triggerEvent("list.item.id", "onDelete", item as Record);
                    }}
                    class="px-2 py-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all duration-200 w-6 h-6 flex items-center justify-center"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
</div>
