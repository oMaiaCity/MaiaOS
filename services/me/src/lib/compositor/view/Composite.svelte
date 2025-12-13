<!--
  Composite Component
  Renders composite nodes (layout containers) with children
  Uses Composite/Leaf pattern - recursively renders children
-->
<script lang="ts">
  import type { Data } from "../dataStore";
  import type { VibeConfig } from "../types";
  import type { ViewNode } from "./types";
  import Composite from "./Composite.svelte";
  import Leaf from "./Leaf.svelte";
  import { normalizeLayoutConfig } from "./layout-normalizer";
  import { resolveDataPath } from "./resolver";

  interface Props {
    node: ViewNode;
    data: Data;
    config?: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  const { node, data, config, onEvent }: Props = $props();

  // Use $derived to maintain reactivity when accessing node properties
  const composite = $derived(node.composite);

  $effect(() => {
    if (!composite) {
      throw new Error(
        "Composite component requires a node with composite property",
      );
    }
  });

  // Normalize semantic layouts to underlying flex/grid configs
  const normalizedConfig = $derived(
    composite ? normalizeLayoutConfig(composite) : null,
  );

  // Debug: Log when we have semantic layouts
  $effect(() => {
    if (
      composite &&
      (composite.type === "list" ||
        composite.type === "row" ||
        composite.type === "grid")
    ) {
      console.log(`[Composite] Semantic layout detected:`, {
        type: composite.type,
        childrenCount: composite.children?.length || 0,
        normalizedType: normalizedConfig?.type,
        firstChild: composite.children?.[0]?.slot,
      });
    }
  });

  // Check if parent is a grid container (use normalized type)
  const isGridContainer = $derived(normalizedConfig?.type === "grid");

  // Compute container styles
  const containerStyle = $derived(() => {
    if (!composite || !normalizedConfig) {
      return {};
    }
    const style: Record<string, string> = {
      ...composite.container?.style,
    };

    // System-level defaults for root composites (slot === "root")
    // Root slots ALWAYS get 100% width and height (hardcoded, cannot override)
    if (node.slot === "root") {
      style.width = "100%";
      style.height = "100%";
      if (!composite.overflow) {
        style.overflow = "hidden";
      }
    }

    // Layout-specific styles (use normalized config)
    if (normalizedConfig.type === "grid" && normalizedConfig.grid) {
      if (normalizedConfig.grid.columns) {
        style["grid-template-columns"] = normalizedConfig.grid.columns;
      }
      if (normalizedConfig.grid.rows) {
        style["grid-template-rows"] = normalizedConfig.grid.rows;
      }
      if (normalizedConfig.grid.gap) {
        style.gap = normalizedConfig.grid.gap;
      }
      if (normalizedConfig.grid.areas) {
        if (typeof normalizedConfig.grid.areas === "object") {
          const areaEntries = Object.entries(normalizedConfig.grid.areas);
          const areaStrings = areaEntries.map(([name, area]) => {
            if (typeof area === "string") {
              return area;
            }
            return name;
          });
          style["grid-template-areas"] = areaStrings.join(" ");
        } else {
          style["grid-template-areas"] = String(normalizedConfig.grid.areas);
        }
      }
      style.display = "grid";
    } else if (normalizedConfig.type === "flex" && normalizedConfig.flex) {
      style.display = "flex";
      if (normalizedConfig.flex.direction) {
        style["flex-direction"] = normalizedConfig.flex.direction;
      }
      if (normalizedConfig.flex.justify) {
        style["justify-content"] = normalizedConfig.flex.justify;
      }
      if (normalizedConfig.flex.align) {
        style["align-items"] = normalizedConfig.flex.align;
      }
      if (normalizedConfig.flex.gap) {
        style.gap = normalizedConfig.flex.gap;
      }
      if (normalizedConfig.flex.wrap) {
        style["flex-wrap"] = normalizedConfig.flex.wrap;
      }
    } else if (normalizedConfig.type === "stack") {
      style.display = "flex";
      style["flex-direction"] = "column";
    } else if (normalizedConfig.type === "overlay") {
      style.position = "relative";
    }

    // Apply overflow from normalized config (for semantic layouts)
    if (normalizedConfig.overflow) {
      style.overflow = normalizedConfig.overflow;
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
    // Overflow from config (only if not set by normalized config)
    if (composite.overflow && !normalizedConfig.overflow) {
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

  // Helper to evaluate visibility (reactive to data changes)
  const evaluateVisibility = (path: string | undefined): boolean => {
    if (!path) return true;
    // Access data to ensure reactivity - explicitly access selectedLayout
    const currentData = data;
    const dataObj = currentData as Record<string, unknown>;
    // Explicitly access selectedLayout and viewMode for reactivity tracking
    const _ = dataObj.selectedLayout;
    const __ = dataObj.viewMode;
    try {
      // Check if it's an expression
      if (
        path.includes("===") ||
        path.includes("!==") ||
        path.includes("==") ||
        path.includes("!=") ||
        path.includes("||") ||
        path.includes("&&")
      ) {
        // Expression - evaluate it
        const dataKeys = Object.keys(dataObj);
        const dataValues = dataKeys.map((key) => dataObj[key]);

        // Replace 'data.property' with 'property' in expression
        let expression = path;
        dataKeys.forEach((key) => {
          expression = expression.replace(
            new RegExp(`data\\.${key}`, "g"),
            key,
          );
        });

        const func = new Function(...dataKeys, `return ${expression}`);
        return Boolean(func(...dataValues));
      }
      // Data path
      const value = resolveDataPath(currentData, path);
      return value !== undefined && value !== null && value !== false;
    } catch {
      return true; // Default to visible on error
    }
  };

  // Compute child node styles
  const getChildStyle = (child: ViewNode): Record<string, string> => {
    const style: Record<string, string> = {};

    if (!composite || !normalizedConfig) {
      return style;
    }

    // Default: fill parent width (unless in flex row container and child is a button)
    // Buttons in flex row should only take space they need, not 100% width
    const isFlexRow =
      normalizedConfig.type === "flex" &&
      normalizedConfig.flex?.direction === "row";
    const isButton = child.leaf?.tag === "button";

    if (!(isFlexRow && isButton)) {
      style.width = "100%";
    }
    // Don't set height: 100% by default - let content determine its own height
    // Only set height if explicitly specified in child.size or when flex-grow is used

    // Grid-specific
    if (normalizedConfig.type === "grid" && child.grid) {
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
    if (normalizedConfig.type === "flex" && child.flex) {
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
    if (normalizedConfig.type === "stack" && child.flex) {
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

    // Flex-specific (for flex containers)
    if (composite.type === "flex" && child.flex) {
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

    // Overflow - critical for scrolling
    if (child.overflow) {
      style.overflow = child.overflow;
      // If overflow is set and flex-grow is used, ensure height is constrained
      if (child.flex?.grow !== undefined && child.flex.grow > 0) {
        style.height = "100%";
      }
    }

    return style;
  };
</script>

{#if composite}
  <div
    class={`${composite.container?.class || ""} ${composite.container?.containerType ? `@container ${composite.container?.containerName || ""}` : ""}`}
    style={Object.entries(containerStyle)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; ")}
  >
    {#each composite.children as child}
      {@const childStyle = getChildStyle(child)}
      {@const isLeafChild = !child.composite && child.leaf}
      {@const hasForeach = isLeafChild && child.leaf?.bindings?.foreach}
      {@const needsContents = isGridContainer && hasForeach}
      {@const wrapperStyle = needsContents
        ? { ...childStyle, display: "contents" }
        : childStyle}
      {@const isVisible =
        !child.visible ||
        (() => {
          if (!child.visible) return true;
          // Access data to ensure reactivity
          const _ = data;
          const dataObj = data as Record;
          const __ = dataObj.selectedLayout;
          const ___ = dataObj.viewMode;
          const result = evaluateVisibility(child.visible);
          // Debug logging
          if (child.slot?.includes("View")) {
            console.log(`[Composite] Visibility check for ${child.slot}:`, {
              visibleExpr: child.visible,
              selectedLayout: String(__),
              result: String(result),
              hasComposite: !!child.composite,
              childrenCount: child.composite?.children?.length || 0,
            });
          }
          return result;
        })()}
      {#if isVisible}
        <div
          class={`${child.composite?.container?.containerType ? `@container ${child.composite?.container?.containerName || ""}` : ""}`}
          style={Object.entries(wrapperStyle)
            .map(([key, value]) => `${key}: ${value}`)
            .join("; ")}
        >
          {#if child.composite}
            <!-- Composite child - recursively render -->
            <Composite node={child} {data} {config} {onEvent} />
          {:else if child.leaf}
            <!-- Leaf child - render content using JSON-driven leaf definition -->
            <Leaf node={child} {data} {config} {onEvent} />
          {:else}
            <!-- Invalid node - must have composite or leaf -->
            <div class="text-red-500 text-sm">
              Invalid node: must have either composite or leaf
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}
