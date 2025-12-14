<!--
  Composite Component
  Renders composite nodes (layout containers) with children
  Uses Composite/Leaf pattern - delegates styling to Tailwind classes and LeafRenderer
-->
<script lang="ts">
  import type { Data } from "../dataStore";
  import type { VibeConfig } from "../types";
  import type { ViewNode, CompositeConfig } from "./types";
  import ViewRenderer from "./ViewRenderer.svelte";
  import { getLayoutClasses } from "./layout-classes";
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

  // Helper to evaluate visibility (reactive to data changes)
  const evaluateVisibility = (path: string | undefined): boolean => {
    if (!path) return true;
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

  // Build container classes - pure Tailwind, no inline styles
  const containerClasses = $derived.by(() => {
    if (!composite) return [];

    const classes: string[] = [];

    // Add user-provided classes
    if (composite.container?.class) {
      classes.push(...composite.container.class.split(" ").filter(Boolean));
    }

    // Add layout classes based on type
    const layoutClasses = getLayoutClasses(composite.type, composite);
    classes.push(...layoutClasses);

    // System-level defaults for root composites (slot === "root")
    if (node.slot === "root") {
      classes.push("w-full", "h-full");
      if (!composite.overflow) {
        classes.push("overflow-hidden");
      }
    }

    // Convert container properties to Tailwind classes
    if (composite.container?.padding) {
      // Parse padding value and convert to Tailwind class
      const padding = composite.container.padding;
      if (padding.includes(" ")) {
        // Multiple values - use arbitrary value
        classes.push(`p-[${padding}]`);
      } else {
        // Single value - try to match Tailwind spacing scale
        classes.push(`p-[${padding}]`);
      }
    }
    if (composite.container?.margin) {
      const margin = composite.container.margin;
      classes.push(`m-[${margin}]`);
    }
    if (composite.container?.background) {
      const bg = composite.container.background;
      classes.push(`bg-[${bg}]`);
    }
    if (composite.container?.border) {
      // Border is complex - use arbitrary value
      const border = composite.container.border;
      classes.push(`border-[${border}]`);
    }
    if (composite.container?.borderRadius) {
      const radius = composite.container.borderRadius;
      classes.push(`rounded-[${radius}]`);
    }

    // Add width/height if specified
    if (composite.width) {
      if (composite.width === "100%") {
        classes.push("w-full");
      } else if (composite.width === "auto") {
        classes.push("w-auto");
      } else {
        classes.push(`w-[${composite.width}]`);
      }
    }
    if (composite.height) {
      if (composite.height === "100%") {
        classes.push("h-full");
      } else if (composite.height === "auto") {
        classes.push("h-auto");
      } else {
        classes.push(`h-[${composite.height}]`);
      }
    }

    // Handle grid-template-areas - convert to Tailwind arbitrary value
    // Use Tailwind's [property:value] syntax for arbitrary CSS properties
    if (composite.type === "grid" && composite.grid?.areas) {
      if (typeof composite.grid.areas === "object") {
        const areaEntries = Object.entries(composite.grid.areas);
        const areaStrings = areaEntries.map(([name, area]) => {
          if (typeof area === "string") {
            return area;
          }
          return name;
        });
        const areasValue = areaStrings.join(" ");
        // Escape quotes in the value for Tailwind arbitrary syntax
        const escapedValue = areasValue.replace(/"/g, '\\"');
        classes.push(`[grid-template-areas:${escapedValue}]`);
      } else {
        const escapedValue = String(composite.grid.areas).replace(/"/g, '\\"');
        classes.push(`[grid-template-areas:${escapedValue}]`);
      }
    }

    // Add container query classes if specified
    if (composite.container?.containerType) {
      classes.push("@container");
      if (composite.container.containerName) {
        classes.push(composite.container.containerName);
      }
    }

    return classes.filter(Boolean);
  });
</script>

{#if composite}
  {@const classes = containerClasses}
  <div class={classes.join(" ")}>
    {#each composite.children as child}
      {@const isVisible = !child.visible || evaluateVisibility(child.visible)}
      {#if isVisible}
        <!-- Pure slot management and composition - all styling in leaf.classes and composite.container.class -->
        <ViewRenderer node={child} {data} {config} {onEvent} />
      {/if}
    {/each}
  </div>
{/if}
