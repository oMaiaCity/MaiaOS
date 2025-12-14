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

  // Get container classes - pure Tailwind from container.class
  const containerClasses = $derived.by(() => {
    if (!composite) return "";
    return composite.container?.class || "";
  });

  // Get inline styles if provided
  const containerStyles = $derived.by(() => {
    if (!composite?.container?.style) return undefined;
    return composite.container.style;
  });
</script>

{#if composite}
  <div class={containerClasses} style={containerStyles}>
    {#each composite.children as child}
      {@const isVisible = !child.visible || evaluateVisibility(child.visible)}
      {#if isVisible}
        <ViewRenderer node={child} {data} {config} {onEvent} />
      {/if}
    {/each}
  </div>
{/if}
