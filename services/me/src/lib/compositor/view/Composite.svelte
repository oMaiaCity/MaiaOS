<!--
  Composite Component
  Pure container div - renders children with Tailwind classes from container.class
  All layout logic is handled via Tailwind classes in container.class
-->
<script lang="ts">
  import type { Data } from "../dataStore";
  import type { VibeConfig } from "../types";
  import type { ViewNode, CompositeConfig } from "./types";
  import Leaf from "./Leaf.svelte";
  import { resolveDataPath } from "./resolver";
  import { viewNodeRegistry } from "./view-node-registry";
  import { resolveSchemaLeaf, resolveSchemaComposite } from "./schema-resolver";
  
  // Recursive component reference (Svelte allows this)
  import CompositeRecursive from "./Composite.svelte";

  interface Props {
    node: ViewNode;
    data: Data;
    config?: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  const { node, data, config, onEvent }: Props = $props();

  // Resolve composite - either inline or by ID from registry
  const composite = $derived.by(() => {
    // Access data to ensure reactivity tracking
    const _ = data;
    
    let resolvedComposite: CompositeConfig | undefined;
    
    // If compositeId is provided, resolve from registry
    if (node.compositeId) {
      let compositeId: string | undefined;
      
      // Check if compositeId is a data path (starts with "data.") or direct ID
      if (node.compositeId.startsWith('data.')) {
        // Access nested properties for reactivity (e.g., data.view.contentCompositeId)
        const view = data.view as Record<string, unknown> | undefined;
        if (view) {
          const _view = view; // Access view to ensure reactivity
          const contentCompositeId = view.contentCompositeId;
          const _contentCompositeId = contentCompositeId; // Access contentCompositeId for reactivity
        }
        
        // Resolve compositeId from data (e.g., "data.view.contentCompositeId")
        compositeId = resolveDataPath(data, node.compositeId) as string | undefined;
      } else {
        // Direct ID (e.g., "todo.composite.content.list")
        compositeId = node.compositeId;
      }
      
      if (compositeId && typeof compositeId === 'string') {
        resolvedComposite = viewNodeRegistry.getComposite(compositeId);
        if (!resolvedComposite) {
          console.warn(`Composite not found in registry: ${compositeId}`);
        }
      }
    } else {
      // Otherwise use inline composite
      resolvedComposite = node.composite;
    }
    
    // If resolved composite has @schema, resolve it to a regular composite (pre-render schema resolution)
    if (resolvedComposite && resolvedComposite['@schema']) {
      return resolveSchemaComposite(resolvedComposite);
    }
    
    return resolvedComposite;
  });

  // Resolve schema instances in children before rendering
  const resolvedChildren = $derived.by(() => {
    if (!composite?.children) return [];
    return composite.children.map((child: ViewNode) => {
      // If child has a leaf with @schema, resolve it to a regular leaf
      if (child.leaf && child.leaf['@schema']) {
        return {
          ...child,
          leaf: resolveSchemaLeaf(child.leaf)
        };
      }
      // If child has a leafId that points to a leaf with @schema, resolve it
      if (child.leafId) {
        const leafFromRegistry = viewNodeRegistry.getLeaf(child.leafId);
        if (leafFromRegistry && leafFromRegistry['@schema']) {
          return {
            ...child,
            leaf: resolveSchemaLeaf(leafFromRegistry)
          };
        }
      }
      // If child has a composite with @schema, resolve it to a regular composite
      if (child.composite && child.composite['@schema']) {
        return {
          ...child,
          composite: resolveSchemaComposite(child.composite)
        };
      }
      // If child has a compositeId, resolve it from registry (only for direct IDs, not data paths)
      if (child.compositeId && !child.compositeId.startsWith('data.')) {
        const compositeFromRegistry = viewNodeRegistry.getComposite(child.compositeId);
        if (compositeFromRegistry) {
          // If it's a schema instance, resolve it first
          if (compositeFromRegistry['@schema']) {
            const resolved = resolveSchemaComposite(compositeFromRegistry);
            return {
              ...child,
              composite: resolved,
              // Remove compositeId since we've resolved it to composite
              compositeId: undefined,
            };
          } else {
            // Regular composite - keep compositeId for CompositeRecursive to resolve
            // CompositeRecursive will handle the resolution
            return child;
          }
        } else if (typeof window !== 'undefined' && import.meta.env?.DEV) {
          console.warn(`[Composite] Composite not found in registry for compositeId: ${child.compositeId}`);
        }
      }
      // If compositeId is a data path (starts with "data."), let CompositeRecursive handle it
      return child;
    });
  });

  $effect(() => {
    if (!composite) {
      // If compositeId was provided but not resolved, show warning instead of error
      if (node.compositeId) {
        console.warn(
          `Composite component: compositeId "${node.compositeId}" not resolved. Node must have either composite property or valid compositeId.`,
        );
        return;
      }
      throw new Error(
        "Composite component requires a node with composite property or valid compositeId",
      );
    }
    // Container is optional when @schema is present (will be resolved from schema)
    // But after resolution, container should always be present
    // Skip validation if @schema is present (it will be resolved before rendering)
    if (!composite.container?.layout && !composite['@schema']) {
      throw new Error(
        "Composite container.layout is REQUIRED. Use 'grid', 'flex', or 'content'",
      );
    }
    // After schema resolution, container should always be present
    if (!composite.container?.layout && composite['@schema']) {
      console.error('Composite with @schema missing container after resolution:', composite);
    }
  });

  // Helper to extract and access properties from expressions for reactivity tracking
  function ensureReactivityForExpression(expression: string) {
    const dataObj = data as Record<string, unknown>;
    const accessedProperties = new Set<string>();

    // Extract properties referenced as "data.property" or nested paths like "data.view.viewMode"
    const dataPropertyMatches = expression.matchAll(/data\.(\w+)(?:\.(\w+))*/g);
    for (const match of dataPropertyMatches) {
      const topLevelProp = match[1];
      if (!accessedProperties.has(topLevelProp) && topLevelProp in dataObj) {
        accessedProperties.add(topLevelProp);
        // Access the top-level property to ensure reactivity
        const _ = dataObj[topLevelProp];
        // Also access nested properties if they exist
        const nestedProp = match[2];
        if (nestedProp) {
          const topLevelValue = dataObj[topLevelProp];
          if (
            topLevelValue &&
            typeof topLevelValue === "object" &&
            nestedProp in topLevelValue
          ) {
            const _nested = (topLevelValue as Record<string, unknown>)[
              nestedProp
            ];
          }
        }
      }
    }

    // Extract direct property references (not keywords)
    const propertyMatches = expression.matchAll(/\b(\w+)\b/g);
    const keywords = new Set([
      "true",
      "false",
      "null",
      "undefined",
      "typeof",
      "data",
    ]);

    for (const match of propertyMatches) {
      const propName = match[1];
      if (
        !keywords.has(propName) &&
        !accessedProperties.has(propName) &&
        propName in dataObj
      ) {
        accessedProperties.add(propName);
        // Access the property to ensure reactivity
        const _ = dataObj[propName];
      }
    }
  }

  // Helper to evaluate visibility (reactive to data changes)
  const evaluateVisibility = (path: string | undefined): boolean => {
    if (!path) return true;
    const currentData = data;
    const dataObj = currentData as Record<string, unknown>;
    // Dynamically extract and access properties from the expression for reactivity
    ensureReactivityForExpression(path);
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
    const hasFlex = classList.includes("flex"); // Only check for "flex" display class, not flex-* utilities
    
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
    
      finalClasses = `@container ${finalClasses}`;
    
    return finalClasses.trim();
  });


</script>

{#if composite}
  <div class={containerClasses}>
    {#each resolvedChildren as child}
      {@const isVisible = !child.visible || evaluateVisibility(child.visible)}
      {#if isVisible}
        {#if child.composite || child.compositeId}
          <!-- Composite node - render as layout container -->
          <!-- compositeId will be resolved by CompositeRecursive -->
          <CompositeRecursive node={child} {data} {config} {onEvent} />
        {:else if child.leaf || child.leafId}
          <!-- Leaf node - render as content using JSON-driven leaf definition -->
          <!-- If child was pre-resolved with schema, use the resolved leaf, otherwise let Leaf component resolve -->
          {@const childNode = child.leaf ? { ...child, leaf: child.leaf } : child}
          <Leaf node={childNode} {data} {config} {onEvent} />
        {:else}
          <!-- Invalid node - neither composite nor leaf -->
          <div class="text-red-500 text-sm">
            Invalid view node: must have either composite, compositeId, leaf, or leafId
          </div>
        {/if}
      {/if}
    {/each}
  </div>
{/if}
