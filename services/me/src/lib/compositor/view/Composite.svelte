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

  // Drag-over state for drop zone visual feedback
  let isDragOver = $state(false);

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

  // Resolve value - matches Leaf.svelte logic exactly
  // This handles expressions with item context properly
  function resolveValue(path: string, contextData?: Data): unknown {
    // Access data to ensure reactivity (even when using contextData)
    const _ = data;
    
    // Check if it's an expression (contains operators like ===, !==, !, ||, &&, typeof, etc.)
    if (
      path.includes("===") ||
      path.includes("!==") ||
      path.includes("==") ||
      path.includes("!=") ||
      path.includes(">") ||
      path.includes("<") ||
      path.includes("||") ||
      path.includes("&&") ||
      path.includes("typeof") ||
      path.startsWith("!") ||
      (path.includes("!") && path.match(/\s*!\s*data\./)) ||
      path.includes("String(") ||
      path.includes(".trim()")
    ) {
      // Evaluate JavaScript expression in the context of data
      try {
        const evalData = contextData || data;
        // Extract item from data if it exists (for foreach contexts)
        const item =
          "item" in evalData && evalData.item
            ? (evalData.item as Record<string, unknown>)
            : {};

        // Access all item properties to ensure reactivity tracking
        if (item && typeof item === "object") {
          Object.keys(item).forEach((key) => {
            const _itemProp = item[key];
          });
        }

        // Check if expression references 'data.' - if so, we need to provide data context
        if (path.includes("data.")) {
          // Dynamically extract all data properties and create variables
          const dataObj = evalData as Record<string, unknown>;
          const dataKeys: string[] = [];
          const dataValues: unknown[] = [];

          // Extract all data.* references from the expression
          const dataPropertyMatches = path.matchAll(/data\.(\w+)/g);
          const seenProperties = new Set<string>();

          for (const match of dataPropertyMatches) {
            const propName = match[1];
            if (!seenProperties.has(propName)) {
              seenProperties.add(propName);
              dataKeys.push(propName);
              // Access the property to ensure reactivity
              dataValues.push(dataObj[propName]);
            }
          }

          // Replace 'data.property' with just 'property' in the expression
          let expression = path;
          dataKeys.forEach((key) => {
            expression = expression.replace(
              new RegExp(`data\\.${key}`, "g"),
              key,
            );
          });

          // Use Function constructor for safer evaluation than eval
          // Dynamically create function with all referenced data properties
          // Include String and Number as global functions for expressions
          // ALWAYS include 'item' as a parameter (even if empty object)
          const func = new Function(
            ...dataKeys,
            "item",
            "String",
            "Number",
            `return ${expression}`,
          );
          const result = func(...dataValues, item, String, Number);
          return result;
        } else {
          // Expression doesn't reference 'data.' - check if it references properties directly
          // Extract property names from the expression (e.g., "selectedRecipient", "sendAmount")
          const dataObj = evalData as Record<string, unknown>;
          const propertyMatches = path.matchAll(/\b(\w+)\b/g);
          const seenProperties = new Set<string>();
          const dataKeys: string[] = [];
          const dataValues: unknown[] = [];

          for (const match of propertyMatches) {
            const propName = match[1];
            // Skip JavaScript keywords and functions
            if (
              propName === "item" ||
              propName === "String" ||
              propName === "Number" ||
              propName === "typeof" ||
              propName === "isNaN" ||
              propName === "trim" ||
              propName === "return" ||
              propName === "true" ||
              propName === "false" ||
              propName === "null" ||
              propName === "undefined" ||
              propName === "void" ||
              propName === "new"
            ) {
              continue;
            }
            // Check if this property exists in data
            if (propName in dataObj && !seenProperties.has(propName)) {
              seenProperties.add(propName);
              dataKeys.push(propName);
              // Access the property to ensure reactivity
              dataValues.push(dataObj[propName]);
            }
          }

          // If we found data properties, use them; otherwise fall back to item-only evaluation
          if (dataKeys.length > 0) {
            const func = new Function(
              ...dataKeys,
              "item",
              "String",
              "Number",
              "isNaN",
              `return ${path}`,
            );
            const result = func(
              ...dataValues,
              item,
              String,
              Number,
              Number.isNaN,
            );
            return result;
          } else {
            // Expression only references 'item' (for foreach contexts)
            // Use Function constructor for safer evaluation than eval
            const func = new Function(
              "item",
              "String",
              "Number",
              "isNaN",
              `return ${path}`,
            );
            const result = func(item, String, Number, Number.isNaN);
            return result;
          }
        }
      } catch (error) {
        console.warn("Expression evaluation error:", error, "path:", path, "contextData:", contextData);
        return undefined;
      }
    }
    // Not an expression - resolve as data path
    const evalData = contextData || data;
    return resolveDataPath(evalData, path);
  }

  // Helper to evaluate visibility (reactive to data changes)
  // Accepts optional itemData for foreach context
  const evaluateVisibility = (path: string | undefined, itemData?: Record<string, unknown>): boolean => {
    if (!path) return true;
    const contextData = itemData ? { ...data, item: itemData } : data;
    try {
      const value = resolveValue(path, contextData);
      return value !== undefined && value !== null && value !== false;
    } catch (error) {
      console.warn('Visibility evaluation error:', error, 'path:', path, 'itemData:', itemData);
      return true; // Default to visible on error
    }
  };

  // Resolve payload (can be data path string or object) - similar to Leaf.svelte
  function resolvePayload(
    payload:
      | Record<string, unknown>
      | string
      | ((data: unknown) => unknown)
      | undefined,
    itemData?: Record<string, unknown>,
  ): unknown {
    if (!payload) return undefined;

    if (typeof payload === "string") {
      const contextData = itemData ? { ...data, item: itemData } : data;
      const resolvedValue = resolveDataPath(contextData, payload);
      if (payload.endsWith(".id") || payload.match(/\.\w+Id$/)) {
        return { id: resolvedValue };
      }
      if (payload === "item.id" || payload === "data.item.id") {
        return { id: resolvedValue };
      }
      return resolvedValue;
    }

    if (typeof payload === "function") {
      return payload(itemData || data);
    }

    if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
      const contextData = itemData ? { ...data, item: itemData } : data;
      const resolved: Record<string, unknown> = {};
      const DATA_PATH_ROOTS = ['data.', 'item.', 'queries.', 'view.'];
      
      function isExplicitDataPath(str: string): boolean {
        for (const root of DATA_PATH_ROOTS) {
          if (str.startsWith(root) && str.length > root.length) {
            return true;
          }
        }
        return false;
      }
      
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === "string") {
          if (isExplicitDataPath(value)) {
            resolved[key] = resolveDataPath(contextData, value);
          } else {
            resolved[key] = value;
          }
        } else {
          resolved[key] = value;
        }
      }
      
      return resolved;
    }

    return payload;
  }

  // Handle event
  function handleEvent(
    eventConfig: {
      event: string;
      payload?: Record<string, unknown> | string | ((data: unknown) => unknown);
    },
    itemData?: Record<string, unknown>,
  ) {
    if (!onEvent) return;
    const contextItemData =
      itemData ||
      ("item" in data && data.item
        ? (data.item as Record<string, unknown>)
        : undefined);
    const payload = resolvePayload(eventConfig.payload, contextItemData);
    onEvent(eventConfig.event, payload);
  }

  // Resolve foreach items
  const foreachItems = $derived.by(() => {
    if (!composite?.foreach) return undefined;
    const _ = data;
    const items = resolveDataPath(data, composite.foreach.items);
    if (Array.isArray(items)) {
      const __ = items.length;
      items.forEach((item) => {
        if (item && typeof item === "object") {
          Object.keys(item).forEach((key) => {
            const ___ = (item as Record<string, unknown>)[key];
          });
        }
      });
      return items;
    }
    return undefined;
  });

  // Get container tag (defaults to 'div', can be overridden to 'form', etc.)
  const containerTag = $derived(composite?.container?.tag || 'div');

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
  {@const containerAttributes = composite.container?.attributes || {}}
  {@const hasDropzone = containerAttributes['data-dropzone'] === 'true'}
  <svelte:element
    this={containerTag}
    class={`${containerClasses} ${hasDropzone && isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
    {...containerAttributes}
    onsubmit={composite.events?.submit
      ? (e: Event) => {
          e.preventDefault();
          // For forms, read input value from form children (similar to Leaf.svelte)
          if (containerTag === 'form' && composite.children) {
            // Find input child with value binding
            const inputChild = composite.children.find(
              (child) =>
                child.leaf &&
                child.leaf.tag === 'input' &&
                child.leaf.bindings?.value
            );
            if (inputChild?.leaf?.bindings?.value) {
              // Read current input value from data
              const inputValue = resolveDataPath(data, inputChild.leaf.bindings.value);
              const textValue = inputValue ? String(inputValue).trim() : '';
              // Don't submit if empty
              if (!textValue) {
                return;
              }
              // Dispatch submit event with value
              const submitEvent = composite.events!.submit!;
              const payload = resolvePayload(submitEvent.payload);
              const finalPayload = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
                ? { ...payload, text: textValue }
                : { text: textValue };
              if (onEvent) {
                onEvent(submitEvent.event, finalPayload);
                // Clear the input by dispatching UPDATE_INPUT with empty text
                if (inputChild.leaf.events?.input) {
                  onEvent(inputChild.leaf.events.input.event, { text: '' });
                }
              }
              return;
            }
          }
          // Not a form or no input child found, handle normally
          handleEvent(composite.events!.submit!);
        }
      : undefined}
    onclick={composite.events?.click
      ? (e: MouseEvent) => {
          handleEvent(composite.events!.click!);
        }
      : undefined}
    onchange={composite.events?.change
      ? () => handleEvent(composite.events!.change!)
      : undefined}
    ondragstart={composite.events?.dragstart
      ? (e: DragEvent) => {
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            // Store the item ID in dataTransfer for drop event
            // Extract itemData from data if in foreach context
            const contextItemData =
              "item" in data && data.item ? (data.item as Record<string, unknown>) : undefined;
            const payload = resolvePayload(
              composite.events!.dragstart!.payload,
              contextItemData,
            );

            if (
              payload &&
              typeof payload === "object" &&
              !Array.isArray(payload)
            ) {
              // Always use "id" property - standardized across the stack
              const payloadObj = payload as Record<string, unknown>;
              if ("id" in payloadObj) {
                e.dataTransfer.setData("text/plain", String(payloadObj.id));
              }
            } else if (typeof payload === "string") {
              e.dataTransfer.setData("text/plain", payload);
            }
          }
          // Don't call handleEvent here - we just store the ID
        }
      : undefined}
    ondragenter={composite.events?.dragenter
      ? (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
          }
          isDragOver = true;
          handleEvent(composite.events!.dragenter!);
        }
      : undefined}
    ondragover={composite.events?.dragover
      ? (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation(); // Prevent bubbling to parent drop zones
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
          }
          // Don't call handleEvent on dragover - just allow the drop
        }
      : undefined}
    ondragleave={composite.events?.dragleave
      ? (e: DragEvent) => {
          // Only remove drag-over state if we're actually leaving the element
          // (not just moving to a child element)
          const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect();
          if (rect && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) {
            isDragOver = false;
          }
          handleEvent(composite.events!.dragleave!);
        }
      : undefined}
    ondrop={composite.events?.drop
      ? (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation(); // Prevent bubbling to parent drop zones
          isDragOver = false; // Reset drag-over state
          // Get the dragged item ID from dataTransfer (set during dragstart)
          const draggedId = e.dataTransfer?.getData("text/plain");
          // Get the drop payload (may contain status, category, or any other properties)
          const dropPayload = resolvePayload(composite.events!.drop!.payload);

          if (draggedId && dropPayload && typeof dropPayload === "object") {
            // Combine dragged ID with drop payload - always use "id" as the key
            // Pass the combined payload directly to onEvent (don't call handleEvent which would resolve again)
            if (onEvent) {
              onEvent(composite.events!.drop!.event, { id: draggedId, ...dropPayload });
            }
          } else if (draggedId) {
            // If we have draggedId but no dropPayload, still send the event with just the ID
            if (onEvent) {
              onEvent(composite.events!.drop!.event, { id: draggedId });
            }
          } else {
            // No draggedId - handle normally (will resolve payload)
            handleEvent(composite.events!.drop!);
          }
        }
      : undefined}
    ondragend={composite.events?.dragend
      ? () => handleEvent(composite.events!.dragend!)
      : undefined}
    onkeydown={composite.events?.keydown
      ? () => handleEvent(composite.events!.keydown!)
      : undefined}
    onkeyup={composite.events?.keyup
      ? () => handleEvent(composite.events!.keyup!)
      : undefined}
    onfocus={composite.events?.focus
      ? () => handleEvent(composite.events!.focus!)
      : undefined}
    onblur={composite.events?.blur
      ? () => handleEvent(composite.events!.blur!)
      : undefined}
  >
    {#if composite.foreach && foreachItems}
      <!-- Foreach rendering -->
      {@const foreachConfig = composite.foreach}
      {@const keyProp = foreachConfig.key || "_index"}
      {#each foreachItems as item, index (typeof item === "object" && item !== null && keyProp in item ? String((item as Record<string, unknown>)[keyProp]) : index)}
        {@const itemData =
          typeof item === "object" && item !== null ? item : {}}
        {@const itemRecord = itemData as Record<string, unknown>}
        {#if itemRecord}
          {@const _ = Object.keys(itemRecord).map(
            (key) => (itemRecord as Record<string, unknown>)[key],
          )}
        {/if}
        {#if foreachConfig.composite}
          <!-- Render composite template -->
          {@const compositeTemplate = foreachConfig.composite}
          {@const visibilityPath = compositeTemplate.bindings?.visible}
          {@const isCompositeVisible = !visibilityPath || evaluateVisibility(visibilityPath, itemRecord)}
          {#if isCompositeVisible}
            <CompositeRecursive
              node={{ slot: "item", composite: compositeTemplate }}
              data={{ ...data, item: itemData }}
              {config}
              {onEvent}
            />
          {/if}
        {:else if foreachConfig.leaf}
          <!-- Render leaf template -->
          <Leaf
            node={{ slot: "item", leaf: foreachConfig.leaf }}
            data={{ ...data, item: itemData }}
            {config}
            {onEvent}
          />
        {/if}
      {/each}
    {:else if resolvedChildren && resolvedChildren.length > 0}
      <!-- Regular children rendering -->
      {#each resolvedChildren as child}
        {@const childVisibility = child.visible || (child.composite?.bindings?.visible) || (child.composite?.visible)}
        {@const isVisible = !childVisibility || evaluateVisibility(childVisibility)}
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
    {/if}
  </svelte:element>
{/if}
