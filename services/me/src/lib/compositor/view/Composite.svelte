<!--
  Composite Component
  Renders composite nodes (layout containers) with children
  Uses Composite/Leaf pattern - recursively renders children
-->
<script lang="ts">
  import type { ViewNode } from "./types";
  import type { Data } from "../dataStore";
  import type { VibeConfig } from "../types";
  import Composite from "./Composite.svelte";
  import Leaf from "./Leaf.svelte";
  import ViewRenderer from "./ViewRenderer.svelte";

  interface Props {
    node: ViewNode;
    data: Data;
    config?: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  let { node, data, config, onEvent }: Props = $props();

  // Use $derived to maintain reactivity when accessing node properties
  const composite = $derived(node.composite);

  $effect(() => {
    if (!composite) {
      throw new Error("Composite component requires a node with composite property");
    }
  });

  // Compute container styles
  const containerStyle = $derived(() => {
    const style: Record<string, string> = {
      ...composite.container?.style,
    };

    // Layout-specific styles
    if (composite.type === "grid" && composite.grid) {
      if (composite.grid.columns) {
        style["grid-template-columns"] = composite.grid.columns;
      }
      if (composite.grid.rows) {
        style["grid-template-rows"] = composite.grid.rows;
      }
      if (composite.grid.gap) {
        style.gap = composite.grid.gap;
      }
      if (composite.grid.areas) {
        if (typeof composite.grid.areas === "object") {
          const areaEntries = Object.entries(composite.grid.areas);
          const areaStrings = areaEntries.map(([name, area]) => {
            if (typeof area === "string") {
              return area;
            }
            return name;
          });
          style["grid-template-areas"] = areaStrings.join(" ");
        } else {
          style["grid-template-areas"] = String(composite.grid.areas);
        }
      }
      style.display = "grid";
    } else if (composite.type === "flex" && composite.flex) {
      style.display = "flex";
      if (composite.flex.direction) {
        style["flex-direction"] = composite.flex.direction;
      }
      if (composite.flex.justify) {
        style["justify-content"] = composite.flex.justify;
      }
      if (composite.flex.align) {
        style["align-items"] = composite.flex.align;
      }
      if (composite.flex.gap) {
        style.gap = composite.flex.gap;
      }
      if (composite.flex.wrap) {
        style["flex-wrap"] = composite.flex.wrap;
      }
    } else if (composite.type === "stack") {
      style.display = "flex";
      style["flex-direction"] = "column";
    } else if (composite.type === "overlay") {
      style.position = "relative";
    }

    // Container properties
    if (composite.container?.padding) {
      style.padding = composite.container.padding;
    }
    if (composite.container?.margin) {
      style.margin = composite.container.margin;
    }
    if (composite.container?.background) {
      style.background = composite.container.background;
    }
    if (composite.container?.border) {
      style.border = composite.container.border;
    }
    if (composite.container?.borderRadius) {
      style["border-radius"] = composite.container.borderRadius;
    }
    if (composite.overflow) {
      style.overflow = composite.overflow;
    }
    if (composite.height) {
      style.height = composite.height;
    }
    if (composite.width) {
      style.width = composite.width;
    }

    return style;
  });

  // Compute child node styles
  const getChildStyle = (child: ViewNode): Record<string, string> => {
    const style: Record<string, string> = {};

    // Default: fill parent width (unless in flex row container and child is a button)
    // Buttons in flex row should only take space they need, not 100% width
    const isFlexRow = composite.type === "flex" && composite.flex?.direction === "row";
    const isButton = child.type === "button";
    
    if (!(isFlexRow && isButton)) {
      style.width = "100%";
    }
    // Don't set height: 100% by default - let content determine its own height
    // Only set height if explicitly specified in child.size or when flex-grow is used

    // Grid-specific
    if (composite.type === "grid" && child.grid) {
      if (child.grid.column) {
        style["grid-column"] = child.grid.column;
      }
      if (child.grid.row) {
        style["grid-row"] = child.grid.row;
      }
      if (child.grid.area) {
        style["grid-area"] = child.grid.area;
      }
    }

    // Flex-specific
    if (composite.type === "flex" && child.flex) {
      if (child.flex.grow !== undefined) {
        style["flex-grow"] = String(child.flex.grow);
      }
      if (child.flex.shrink !== undefined) {
        style["flex-shrink"] = String(child.flex.shrink);
      }
      if (child.flex.basis) {
        style["flex-basis"] = child.flex.basis;
      }
      if (child.flex.order !== undefined) {
        style.order = String(child.flex.order);
      }
    }

    // Stack-specific (flex column)
    if (composite.type === "stack" && child.flex) {
      if (child.flex.grow !== undefined) {
        style["flex-grow"] = String(child.flex.grow);
        // For flex-grow items, set min-height to 0 to allow proper flex behavior
        if (child.flex.grow > 0) {
          style["min-height"] = "0";
        }
      }
      if (child.flex.shrink !== undefined) {
        style["flex-shrink"] = String(child.flex.shrink);
      }
      if (child.flex.basis) {
        style["flex-basis"] = child.flex.basis;
      }
      if (child.flex.order !== undefined) {
        style.order = String(child.flex.order);
      }
    }

    // Position
    if (child.position) {
      if (child.position.type) {
        style.position = child.position.type;
      }
      if (child.position.top) {
        style.top = child.position.top;
      }
      if (child.position.right) {
        style.right = child.position.right;
      }
      if (child.position.bottom) {
        style.bottom = child.position.bottom;
      }
      if (child.position.left) {
        style.left = child.position.left;
      }
      if (child.position.zIndex !== undefined) {
        style["z-index"] = String(child.position.zIndex);
      }
    }

    // Size
    if (child.size) {
      if (child.size.width) {
        style.width = child.size.width;
      }
      if (child.size.height) {
        style.height = child.size.height;
      }
      if (child.size.minWidth) {
        style["min-width"] = child.size.minWidth;
      }
      if (child.size.maxWidth) {
        style["max-width"] = child.size.maxWidth;
      }
      if (child.size.minHeight) {
        style["min-height"] = child.size.minHeight;
      }
      if (child.size.maxHeight) {
        style["max-height"] = child.size.maxHeight;
      }
    }

    // Overflow
    if (child.overflow) {
      style.overflow = child.overflow;
    }

    return style;
  };
</script>

<div
  class={`${composite.container?.class || ""} ${composite.container?.containerType ? `@container ${composite.container?.containerName || ''}` : ''}`}
  style={Object.entries(containerStyle())
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ")}
>
  {#each composite.children as child}
    {@const childStyle = getChildStyle(child)}
    <div
      class={`${child.composite?.container?.containerType ? `@container ${child.composite?.container?.containerName || ''}` : ''} ${!child.composite && (child.dataPath || child.type === "button") ? 'contents' : ''}`}
      style={Object.entries(childStyle)
        .map(([key, value]) => `${key}: ${value}`)
        .join("; ")}
    >
      {#if child.composite}
        <!-- Composite child - recursively render -->
        <Composite node={child} {data} {config} {onEvent} />
      {:else if child.dataPath || child.type}
        <!-- Leaf child - render content (buttons and other types may not need dataPath) -->
        <Leaf node={child} {data} {config} {onEvent} />
      {/if}
    </div>
  {/each}
</div>

