<!--
  Composite Component
  Pure container div - renders children with Tailwind classes from container.class
  All layout logic is handled via Tailwind classes in container.class
-->
<script lang="ts">
  import type { Data } from "../dataStore";
  import type { VibeConfig } from "../types";
  import type { ViewNode } from "./types";
  import ViewRenderer from "./ViewRenderer.svelte";
  import { resolveDataPath } from "./resolver";

  interface Props {
    node: ViewNode;
    data: Data;
    config?: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  const { node, data, config, onEvent }: Props = $props();

  const composite = $derived(node.composite);

  $effect(() => {
    if (!composite) {
      throw new Error(
        "Composite component requires a node with composite property",
      );
    }
    if (!composite.container?.layout) {
      throw new Error(
        "Composite container.layout is REQUIRED. Use 'grid', 'flex', or 'content'",
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

  // Get container classes - apply defaults based on explicit layout type
  // All composites get @container for Tailwind container query support
  const containerClasses = $derived.by(() => {
    if (!composite?.container) return "";
    const layout = composite.container.layout;
    const userClasses = composite.container.class || "";
    
    // Split classes for accurate detection
    const classList = userClasses.split(/\s+/).filter(Boolean);
    
    // Check what's already set in user classes
    const hasHeight = classList.some(c => c.startsWith("h-") || c.startsWith("min-h-") || c.startsWith("max-h-"));
    const hasWidth = classList.some(c => c.startsWith("w-") || c.startsWith("min-w-") || c.startsWith("max-w-"));
    const hasOverflow = classList.some(c => c.startsWith("overflow-"));
    const hasGrid = classList.includes("grid");
    const hasFlex = classList.includes("flex") || classList.some(c => c.startsWith("flex-"));
    const hasContainer = classList.includes("@container");
    
    // Don't add h-full if using flex-grow (flex handles height)
    const usesFlexGrow = classList.includes("flex-grow") || classList.includes("flex-1");
    
    let finalClasses = userClasses;
    
    // Apply defaults based on explicit layout type
    if (layout === 'grid') {
      // Structural grid container: h-full w-full overflow-hidden grid @container
      if (!hasHeight && !usesFlexGrow) {
        finalClasses = `h-full ${finalClasses}`;
      }
      if (!hasWidth) {
        finalClasses = `w-full ${finalClasses}`;
      }
      if (!hasOverflow) {
        finalClasses = `overflow-hidden ${finalClasses}`;
      }
      if (!hasGrid) {
        finalClasses = `grid ${finalClasses}`;
      }
    } else if (layout === 'flex') {
      // Flex container: w-full overflow-hidden flex @container
      // Note: h-full NOT added by default - flex containers should size naturally
      // Grid containers get h-full because they're structural layout containers
      // Flex containers are often used for content (button groups, nav bars) that should size to content
      if (!hasWidth) {
        finalClasses = `w-full ${finalClasses}`;
      }
      if (!hasOverflow) {
        finalClasses = `overflow-hidden ${finalClasses}`;
      }
      if (!hasFlex) {
        finalClasses = `flex ${finalClasses}`;
      }
    } else if (layout === 'content') {
      // Content container: @container only (no structural defaults)
      // No structural defaults, just container query support
    }
    
    // ALWAYS add @container for container query support (unless already present)
    if (!hasContainer) {
      finalClasses = `@container ${finalClasses}`;
    }
    
    return finalClasses.trim();
  });


</script>

{#if composite}
  <div class={containerClasses}>
    {#each composite.children as child}
      {@const isVisible = !child.visible || evaluateVisibility(child.visible)}
      {#if isVisible}
        <ViewRenderer node={child} {data} {config} {onEvent} />
      {/if}
    {/each}
  </div>
{/if}
