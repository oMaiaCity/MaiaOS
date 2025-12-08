<!--
  Layout Engine Component
  Universal layout system using CSS Grid and Flexbox
  Supports recursive nesting, fixed headers/footers, overlays, and overflow
-->
<script lang="ts">
  import type { LayoutConfig, LayoutSlot } from "./types";
  import type { ResolvedUISlot } from "../ui-slots/types";
  import SlotContent from "./SlotContent.svelte";

  interface Props {
    config: LayoutConfig;
    resolvedSlots: ResolvedUISlot[];
    renderSlot: (slotId: string) => unknown;
    getSlotValue: (slotId: string) => unknown;
    hasSlot: (slotId: string) => boolean;
    getSlotMapping?: (
      slotId: string,
    ) => { events?: Record<string, unknown>; config?: Record<string, unknown> } | undefined;
    triggerEvent?: (
      slotId: string,
      interaction: string,
      itemData?: Record<string, unknown>,
      additionalPayload?: Record<string, unknown>,
    ) => void;
    getListItems?: (listSlotId: string) => Array<Record<string, unknown>>;
    isLoading?: boolean;
    viewMode?: string;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  let {
    config,
    resolvedSlots,
    renderSlot,
    getSlotValue,
    hasSlot,
    getSlotMapping = () => undefined,
    triggerEvent = () => {},
    getListItems = () => [],
    isLoading = false,
    viewMode = "list",
    onEvent,
  }: Props = $props();

  // Compute container styles
  const containerStyle = $derived(() => {
    const style: Record<string, string> = {
      ...config.container?.style,
    };

    // Layout-specific styles
    if (config.type === "grid" && config.grid) {
      if (config.grid.columns) {
        style["grid-template-columns"] = config.grid.columns;
      }
      if (config.grid.rows) {
        style["grid-template-rows"] = config.grid.rows;
      }
      if (config.grid.gap) {
        style.gap = config.grid.gap;
      }
      if (config.grid.areas) {
        // Grid areas should be a string template like: "header header" "content sidebar"
        // If it's an object, convert it to a string template
        if (typeof config.grid.areas === "object") {
          const areaEntries = Object.entries(config.grid.areas);
          // Group by row (assuming area format like "1 / 1 / 2 / 3" or named areas)
          const areaStrings = areaEntries.map(([name, area]) => {
            if (typeof area === "string") {
              return area;
            }
            return name;
          });
          style["grid-template-areas"] = areaStrings.join(" ");
        } else {
          style["grid-template-areas"] = String(config.grid.areas);
        }
      }
      style.display = "grid";
    } else if (config.type === "flex" && config.flex) {
      style.display = "flex";
      if (config.flex.direction) {
        style["flex-direction"] = config.flex.direction;
      }
      if (config.flex.justify) {
        style["justify-content"] = config.flex.justify;
      }
      if (config.flex.align) {
        style["align-items"] = config.flex.align;
      }
      if (config.flex.gap) {
        style.gap = config.flex.gap;
      }
      if (config.flex.wrap) {
        style["flex-wrap"] = config.flex.wrap;
      }
    } else if (config.type === "stack") {
      style.display = "flex";
      style["flex-direction"] = "column";
    } else if (config.type === "overlay") {
      style.position = "relative";
    }

    // Container properties
    if (config.container?.padding) {
      style.padding = config.container.padding;
    }
    if (config.container?.margin) {
      style.margin = config.container.margin;
    }
    if (config.container?.background) {
      style.background = config.container.background;
    }
    if (config.container?.border) {
      style.border = config.container.border;
    }
    if (config.container?.borderRadius) {
      style["border-radius"] = config.container.borderRadius;
    }
    if (config.overflow) {
      style.overflow = config.overflow;
    }
    if (config.height) {
      style.height = config.height;
    }
    if (config.width) {
      style.width = config.width;
    }

    return style;
  });

  // Compute slot styles
  const getSlotStyle = (slot: LayoutSlot): Record<string, string> => {
    const style: Record<string, string> = {};

    // Default: fill parent
    style.width = "100%";
    style.height = "100%";

    // Grid-specific
    if (config.type === "grid" && slot.grid) {
      if (slot.grid.column) {
        style["grid-column"] = slot.grid.column;
      }
      if (slot.grid.row) {
        style["grid-row"] = slot.grid.row;
      }
      if (slot.grid.area) {
        style["grid-area"] = slot.grid.area;
      }
    }

    // Flex-specific
    if (config.type === "flex" && slot.flex) {
      if (slot.flex.grow !== undefined) {
        style["flex-grow"] = String(slot.flex.grow);
      }
      if (slot.flex.shrink !== undefined) {
        style["flex-shrink"] = String(slot.flex.shrink);
      }
      if (slot.flex.basis) {
        style["flex-basis"] = slot.flex.basis;
      }
      if (slot.flex.order !== undefined) {
        style.order = String(slot.flex.order);
      }
    }

    // Position
    if (slot.position) {
      if (slot.position.type) {
        style.position = slot.position.type;
      }
      if (slot.position.top) {
        style.top = slot.position.top;
      }
      if (slot.position.right) {
        style.right = slot.position.right;
      }
      if (slot.position.bottom) {
        style.bottom = slot.position.bottom;
      }
      if (slot.position.left) {
        style.left = slot.position.left;
      }
      if (slot.position.zIndex !== undefined) {
        style["z-index"] = String(slot.position.zIndex);
      }
    }

    // Size constraints
    if (slot.size) {
      if (slot.size.width) {
        style.width = slot.size.width;
      }
      if (slot.size.height) {
        style.height = slot.size.height;
      }
      if (slot.size.minWidth) {
        style["min-width"] = slot.size.minWidth;
      }
      if (slot.size.maxWidth) {
        style["max-width"] = slot.size.maxWidth;
      }
      if (slot.size.minHeight) {
        style["min-height"] = slot.size.minHeight;
      }
      if (slot.size.maxHeight) {
        style["max-height"] = slot.size.maxHeight;
      }
    }

    // Overflow
    if (slot.overflow) {
      style.overflow = slot.overflow;
    }

    return style;
  };
</script>

<div
  class={`@container ${config.container?.class || ""}`}
  style={Object.entries(containerStyle())
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ")}
>
  {#each config.slots as slot}
    {@const slotStyle = getSlotStyle(slot)}
    {@const isVirtualSlot = slot.layout !== undefined}
    {@const slotExists = hasSlot(slot.slot) || isVirtualSlot}
    {#if slotExists}
      <div
        class={slot.layout ? "@container" : ""}
        style={Object.entries(slotStyle)
          .map(([key, value]) => `${key}: ${value}`)
          .join("; ")}
      >
        {#if slot.layout}
          <!-- Composite: Render nested layout (virtual slot) -->
          <svelte:self
            config={slot.layout}
            {resolvedSlots}
            {renderSlot}
            {getSlotValue}
            {hasSlot}
            {getSlotMapping}
            {triggerEvent}
            {getListItems}
            {isLoading}
            {viewMode}
            {onEvent}
          />
        {:else if hasSlot(slot.slot)}
          <!-- Leaf: Render slot content -->
          <SlotContent
            slotId={slot.slot}
            {resolvedSlots}
            {renderSlot}
            {getSlotValue}
            {getSlotMapping}
            {triggerEvent}
            {getListItems}
            {isLoading}
            {viewMode}
            {onEvent}
          />
        {/if}
      </div>
    {/if}
  {/each}
</div>
