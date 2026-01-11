<!--
  Composite Component
  JAZZ-NATIVE ARCHITECTURE
  Pure container div - renders children with Tailwind classes from container.class
  Data is derived from actor.context (no dataStore copies)
-->
<script lang="ts">
  import type { VibeConfig } from "../types";
  import type { ViewNode, CompositeNode } from "./types";
  import Leaf from "./Leaf.svelte";
  import { resolveDataPath } from "./resolver";
  import { viewNodeRegistry } from "./view-node-registry";
  import { resolveSchemaLeaf, resolveSchemaComposite } from "./schema-resolver";
  import { safeEvaluate, isDSLExpression } from "../dsl";
  import type { DSLExpression } from "../dsl";
  
  // Recursive component reference (Svelte allows this)
  import CompositeRecursive from "./Composite.svelte";

  // For actor-based rendering
  import ActorRendererRecursive from "../actors/ActorRendererRecursive.svelte";

  interface Props {
    node: ViewNode;
    data: Record<string, any>; // Jazz-native data from actor.context
    config?: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  const { node, data, config, onEvent }: Props = $props();
  
  // Extract childActors and accountCoState from data (passed by ActorRenderer)
  const childActors = $derived((data as any).childActors || null);
  const accountCoState = $derived((data as any).accountCoState || null);

  // Drag-over state for drop zone visual feedback
  let isDragOver = $state(false);

  // Resolve composite - either inline or by ID from registry
  const composite = $derived.by(() => {
    // Access data to ensure reactivity tracking
    const _ = data;
    
    let resolvedComposite: CompositeNode | undefined;
    
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

  // Resolve value - secure DSL evaluation only
  function resolveValue(path: string | DSLExpression, contextData?: Record<string, any>): unknown {
    // Access data to ensure reactivity (even when using contextData)
    const _ = data;
    const evalData = contextData || data;
    
    // DSL expression (secure JSON-based)
    if (isDSLExpression(path)) {
      try {
        return safeEvaluate(path, {
          item: "item" in evalData && evalData.item ? (evalData.item as Record<string, unknown>) : undefined,
          context: "context" in evalData && evalData.context ? (evalData.context as Record<string, unknown>) : undefined,
          dependencies: "dependencies" in evalData && evalData.dependencies ? (evalData.dependencies as Record<string, unknown>) : undefined,
        });
      } catch (error) {
        console.warn('[Composite] DSL evaluation error:', error);
        return undefined;
      }
    }

    // Simple string - resolve as data path
    if (typeof path === 'string') {
      return resolveDataPath(evalData, path);
    }

    // Invalid type
    return undefined;
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
      const DATA_PATH_ROOTS = ['data.', 'item.', 'queries.', 'view.', 'context.'];
      
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
            const resolvedValue = resolveDataPath(contextData, value);
            console.log('[Composite.resolvePayload] Resolved data path:', value, '→', resolvedValue, 'from contextData keys:', Object.keys(contextData));
            resolved[key] = resolvedValue;
          } else {
            console.log('[Composite.resolvePayload] Treating as literal string:', value);
            resolved[key] = value;
          }
        } else {
          resolved[key] = value;
        }
      }
      
      console.log('[Composite.resolvePayload] Final resolved payload:', resolved);
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

  // Resolve foreach items (now works with plain objects from useQuery)
  const foreachItems = $derived.by(() => {
    if (!composite?.foreach) return undefined;
    const _ = data;
    const items = resolveDataPath(data, composite.foreach.items);
    if (Array.isArray(items)) {
      // Return all items - they're plain objects now, not Jazz entities
      // Access properties to ensure reactivity tracking
      items.forEach((item: any) => {
        if (item && typeof item === 'object') {
          const __ = item.id;
          const ___ = item.name;
          const ____ = item.email;
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
  {@const containerAttributes = (composite.container as any)?.attributes || {}}
  {@const hasDropzone = containerAttributes['data-dropzone'] === 'true'}
  <svelte:element
    this={containerTag}
    class={`${containerClasses} ${hasDropzone && isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
    {...containerAttributes}
    onsubmit={composite.events?.submit
      ? (e: Event) => {
          e.preventDefault();
          console.log('[Composite] Form submit triggered');
          console.log('[Composite] Data structure:', {
            hasContext: !!(data as any).context,
            contextKeys: (data as any).context ? Object.keys((data as any).context) : [],
            hasChildActors: !!(data as any).childActors,
            hasItem: !!(data as any).item
          });
          console.log('[Composite] Submit event payload config:', composite.events!.submit!.payload);
          // CLEAN ARCHITECTURE: No event bubbling, just dispatch via onEvent
          // The onEvent callback will send message to actor's inbox
          const submitEvent = composite.events!.submit!;
          const payload = resolvePayload(submitEvent.payload);
          console.log('[Composite] Dispatching submit event:', submitEvent.event, 'payload:', payload);
          if (onEvent) {
            onEvent(submitEvent.event, payload);
          }
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
          // Call handleEvent to notify the actor (e.g., for storing drag state)
          handleEvent(composite.events!.dragstart!);
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
    {#if composite.elements && composite.elements.length > 0}
      <!-- NEW: Nested div structure with elements[] -->
      {#each composite.elements as element}
        {#if element.slot === 'children'}
          <!-- This is where child actors render - WRAPPED in element's div -->
          <svelte:element 
            this={element.tag || 'div'} 
            class={element.classes}
            {...element.attributes || {}}
          >
            {#if childActors && childActors.length > 0}
              {#each childActors as childActor}
                {@const childActorId = childActor?.$jazz?.id}
                {#if childActorId}
                  <ActorRendererRecursive 
                    actorId={childActorId}
                    {accountCoState}
                  />
                {/if}
              {/each}
            {:else if resolvedChildren && resolvedChildren.length > 0}
              <!-- Fallback: regular children rendering -->
              {#each resolvedChildren as child}
                {@const childVisibility = child.visible || (child.composite?.bindings?.visible) || (child.composite?.visible)}
                {@const isVisible = !childVisibility || evaluateVisibility(childVisibility)}
                {#if isVisible}
                  {#if child.composite || child.compositeId}
                    <CompositeRecursive node={child} {data} {config} {onEvent} />
                  {:else if child.leaf || child.leafId}
                    {@const childNode = child.leaf ? { ...child, leaf: child.leaf } : child}
                    <Leaf node={childNode} {data} {config} {onEvent} />
                  {/if}
                {/if}
              {/each}
            {/if}
          </svelte:element>
        {:else}
          <!-- Regular nested div element -->
          <svelte:element 
            this={element.tag} 
            class={element.classes}
            {...element.attributes || {}}
          >
            {#if element.elements && element.elements.length > 0}
              <!-- Recursively render nested elements -->
              {#each element.elements as nestedEl}
                {#if nestedEl.slot === 'children'}
                  <!-- Nested children slot -->
                  {#if childActors && childActors.length > 0}
                    {#each childActors as childActor}
                      {@const childActorId = childActor?.$jazz?.id}
                      {#if childActorId}
                        <ActorRendererRecursive 
                          actorId={childActorId}
                          {accountCoState}
                        />
                      {/if}
                    {/each}
                  {/if}
                {:else}
                  <svelte:element 
                    this={nestedEl.tag} 
                    class={nestedEl.classes}
                    {...nestedEl.attributes || {}}
                  />
                {/if}
              {/each}
            {/if}
          </svelte:element>
        {/if}
      {/each}
    {:else if composite.foreach && foreachItems}
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
    {:else if childActors && childActors.length > 0}
      <!-- Actor-based rendering (NEW: Jazz-native ID-based) -->
      {#each childActors as childActor}
        {@const childActorId = childActor?.$jazz?.id}
        {#if childActorId}
          <ActorRendererRecursive 
            actorId={childActorId}
            {accountCoState}
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
