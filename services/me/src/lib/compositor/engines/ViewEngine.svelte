<!--
  ViewEngine Component
  UNIFIED RENDERING: Composite + Leaf in one component
  Detects node type and renders accordingly
  Self-recursive (no separate wrapper needed)
-->
<script lang="ts">
  import type { VibeConfig } from "$lib/utils/types";
  import type { ViewNode, CompositeNode, LeafNode } from "$lib/utils/types";
  import { browser } from "$app/environment";
  // Phase 7: Use security module instead of whitelist
  import { validateLeaf, sanitizeClasses } from "@maia/script/modules/security.module";
  import { resolveDataPath } from "../view/resolver";
  import { viewNodeRegistry } from "../view/view-node-registry";
  import { resolveSchemaLeaf, resolveSchemaComposite } from "../view/schema-resolver";
  import Icon from "@iconify/svelte";
  import { goto } from "$app/navigation";
  import { safeEvaluate, isMaiaScriptExpression } from "@maia/script";
  import type { MaiaScriptExpression } from "@maia/script";
  
  // Phase 2: Binding Resolver Module
  import {
    resolveBinding,
    resolveVisibility,
    resolveClass,
    resolveText,
    resolveDisabled,
    resolveValue
  } from "../view/binding-resolver";
  
  // Phase 3: Event Handler Module
  import {
    resolvePayload,
    createEventHandler,
    createClickHandler,
    createSubmitHandler,
    createInputHandler,
    createDragStartHandler,
    createDropHandler,
    createDragOverHandler,
    createDragEnterHandler,
    createDragLeaveHandler,
    createDragEndHandler
  } from "../view/event-handler";

  // For actor-based rendering
  import ActorEngine from "./ActorEngine.svelte";
  
  // Self-recursion (Svelte 5 supports this natively)
  import ViewEngine from "./ViewEngine.svelte";

  interface Props {
    node: ViewNode;
    data: Record<string, any>;
    config?: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  const { node, data, config, onEvent }: Props = $props();
  
  // Extract childActors and accountCoState from data (passed by ActorRenderer)
  const childActors = $derived((data as any).childActors || null);
  const accountCoState = $derived((data as any).accountCoState || null);

  // Drag-over state for drop zone visual feedback
  let isDragOver = $state(false);

  // ============================================
  // NODE TYPE DETECTION
  // ============================================
  
  const nodeType = $derived.by(() => {
    // Access data to ensure reactivity
    const _ = data;
    
    // Composite: has container or compositeId
    if (node.composite || node.compositeId) return 'composite';
    
    // Leaf: has tag or leafId
    if (node.leaf || node.leafId) return 'leaf';
    
    return null;
  });

  // ============================================
  // COMPOSITE RESOLUTION
  // ============================================
  
  const composite = $derived.by(() => {
    if (nodeType !== 'composite') return undefined;
    
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

  // ============================================
  // LEAF RESOLUTION
  // ============================================
  
  const leaf = $derived.by(() => {
    if (nodeType !== 'leaf') return undefined;
    
    // Access data to ensure reactivity tracking
    const _ = data;
    
    // If leafId is provided, resolve from registry
    if (node.leafId) {
      let leafId: string | undefined;
      
      // Check if leafId is a data path (starts with "data.") or direct ID
      if (node.leafId.startsWith('data.')) {
        // Access nested properties for reactivity (e.g., data.view.contentLeafId or data.view.kanbanColumnIds.todo)
        const view = data.view as Record<string, unknown> | undefined;
        if (view) {
          const _view = view; // Access view to ensure reactivity
          // Extract all path parts after "data.view" for nested property access
          const pathParts = node.leafId.split('.');
          if (pathParts.length > 2 && pathParts[0] === 'data' && pathParts[1] === 'view') {
            // Access nested properties for reactivity (e.g., kanbanColumnIds.todo)
            let current: unknown = view;
            for (let i = 2; i < pathParts.length; i++) {
              const part = pathParts[i];
              if (current && typeof current === 'object' && part in current) {
                current = (current as Record<string, unknown>)[part];
                const _ = current; // Access for reactivity
              }
            }
          } else {
            // Simple path (e.g., data.view.contentLeafId)
            const propName = pathParts[pathParts.length - 1];
            if (propName && propName in view) {
              const _prop = view[propName]; // Access property for reactivity
            }
          }
        }
        
        // Resolve leafId from data (e.g., "data.view.contentLeafId" or "data.view.kanbanColumnIds.todo")
        // Generic path resolution - works for any data path structure
        leafId = resolveDataPath(data, node.leafId) as string | undefined;
        
      } else {
        // Direct ID (e.g., "todo.leaf.todoList")
        leafId = node.leafId;
      }
      
      if (leafId && typeof leafId === 'string') {
        const resolvedLeaf = viewNodeRegistry.getLeaf(leafId);
        if (resolvedLeaf) {
          // If resolved leaf has @schema, resolve it to a regular leaf (pre-render schema resolution)
          if (resolvedLeaf['@schema']) {
            return resolveSchemaLeaf(resolvedLeaf);
          }
          return resolvedLeaf;
        }
        // Debug: Log the resolution attempt (only in development)
        if (typeof window !== 'undefined' && import.meta.env?.DEV) {
          const allLeaves = viewNodeRegistry.getAllLeaves();
          const leafIds = allLeaves.map(l => l.id).filter(Boolean);
          console.error(`[ViewEngine] Leaf not found in registry: ${leafId}`, {
            nodeLeafId: node.leafId,
            resolvedLeafId: leafId,
            totalLeaves: leafIds.length,
            allRegisteredIds: leafIds,
            matchingIds: leafIds.filter(id => id?.includes('kanbanColumn')),
          });
        }
      } else if (node.leafId && typeof window !== 'undefined' && import.meta.env?.DEV) {
        // leafId resolution failed
        console.error(`[ViewEngine] Failed to resolve leafId: ${node.leafId}`, {
          nodeLeafId: node.leafId,
          resolvedLeafId: leafId,
          isDataPath: node.leafId.startsWith('data.'),
          dataView: data.view,
        });
      }
    }
    // Otherwise use inline leaf
    const resolvedLeaf = node.leaf;
    
    // If resolved leaf has @schema, resolve it to a regular leaf (pre-render schema resolution)
    if (resolvedLeaf && resolvedLeaf['@schema']) {
      return resolveSchemaLeaf(resolvedLeaf);
    }
    
    return resolvedLeaf;
  });

  // ============================================
  // COMPOSITE-SPECIFIC LOGIC
  // ============================================
  
  // Resolve schema instances in children before rendering (Composite only)
  const resolvedChildren = $derived.by(() => {
    if (nodeType !== 'composite' || !composite?.children) return [];
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
            // Regular composite - keep compositeId for recursive resolution
            return child;
          }
        } else if (typeof window !== 'undefined' && import.meta.env?.DEV) {
          console.warn(`[ViewEngine] Composite not found in registry for compositeId: ${child.compositeId}`);
        }
      }
      // If compositeId is a data path (starts with "data."), let recursion handle it
      return child;
    });
  });

  // Resolve foreach items (now works with plain objects from useQuery) - Composite only
  const foreachItems = $derived.by(() => {
    if (nodeType !== 'composite' || !composite?.foreach) return undefined;
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

  // Get container tag (Composite only)
  const containerTag = $derived(composite?.container?.tag || 'div');

  // Get container classes (Composite only)
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
    const hasFlex = classList.includes("flex");
    
    // Don't add h-full if using flex-grow (flex handles height)
    const usesFlexGrow = classList.includes("flex-grow") || classList.includes("flex-1");
    
    let finalClasses = userClasses;
    
    // Apply defaults based on explicit layout type
    if (layout === 'grid') {
      if (!hasHeight && !usesFlexGrow) finalClasses = `h-full ${finalClasses}`;
      if (!hasWidth) finalClasses = `w-full ${finalClasses}`;
      if (!hasOverflow) finalClasses = `overflow-hidden ${finalClasses}`;
      if (!hasGrid) finalClasses = `grid ${finalClasses}`;
    } else if (layout === 'flex') {
      if (!hasWidth) finalClasses = `w-full ${finalClasses}`;
      if (!hasOverflow) finalClasses = `overflow-hidden ${finalClasses}`;
      if (!hasFlex) finalClasses = `flex ${finalClasses}`;
    }
    
    finalClasses = `@container ${finalClasses}`;
    
    return finalClasses.trim();
  });

  // ============================================
  // LEAF-SPECIFIC LOGIC
  // ============================================
  
  // Validate leaf (Leaf only)
  const validation = $derived(
    leaf ? validateLeaf(leaf) : { valid: true, errors: [] },
  );

  // Void elements that cannot have children (Leaf only)
  const VOID_ELEMENTS = new Set([
    "input", "img", "br", "hr", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr",
  ]);

  const isVoidElement = $derived(leaf && leaf.tag ? VOID_ELEMENTS.has(leaf.tag) : false);

  // Get sanitized classes for Leaf (Phase 2: Uses binding-resolver)
  const leafClasses = $derived.by(() => {
    if (nodeType !== 'leaf' || !leaf) return "";
    
    let baseClasses = "";
    let dynamicClasses = "";

    // 1. Process static classes from leaf.classes
    if (leaf.classes) {
      const classArray = leaf.classes.split(/\s+/).filter(Boolean);
      const resolvedClasses = classArray.map((cls) => {
        if (typeof cls === "string" && (cls.includes("item.") || cls.includes("data."))) {
          const resolved = resolveBinding(cls, data);
          return typeof resolved === "string" ? resolved : cls;
        }
        return cls;
      });
      baseClasses = sanitizeClasses(resolvedClasses).sanitized.join(" ");
    }

    // 2. Process dynamic classes from leaf.bindings.class
    if (leaf.bindings?.class) {
      const resolved = resolveClass(leaf.bindings.class, data);
      if (resolved.trim()) {
        const dynamicClassArray = resolved.split(/\s+/).filter(Boolean);
        dynamicClasses = sanitizeClasses(dynamicClassArray).sanitized.join(" ");
      }
    }

    return [baseClasses, dynamicClasses].filter(Boolean).join(" ");
  });

  // Build attributes object for Leaf (Phase 2: Uses binding-resolver)
  const inputValue = $derived.by(() => {
    if (!leaf || leaf.tag !== "input" || !leaf.bindings?.value) return undefined;
    return resolveValue(leaf.bindings.value, data);
  });

  const attributes = $derived.by(() => {
    if (nodeType !== 'leaf' || !leaf) return {};
    
    const attrs: Record<string, string | boolean | number | ((e: Event) => void)> = {
      ...leaf?.attributes,
    };

    // Bind value for inputs
    if (leaf?.tag === "input" && leaf?.bindings?.value) {
      if (!leaf?.events?.input) {
        const _ = data;
        const value = inputValue;
        attrs.value = value !== undefined ? String(value) : "";
      } else {
        const value = inputValue;
        attrs.value = value !== undefined ? String(value) : "";
      }
    }

    // Bind disabled state
    if (leaf?.bindings?.disabled !== undefined) {
      attrs.disabled = isDisabled;
    }

    // Add input event handler
    if (leaf?.events?.input) {
      const eventConfig = leaf.events.input;
      attrs.oninput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        
        let payloadKey = "text";
        if (leaf?.bindings?.value && typeof leaf.bindings.value === 'string') {
          const bindingPath = leaf.bindings.value;
          const parts = bindingPath.split('.');
          if (parts.length > 0) {
            payloadKey = parts[parts.length - 1];
          }
        }
        
        const payload: Record<string, unknown> = eventConfig.payload
          ? {
              ...(typeof eventConfig.payload === "object" && !Array.isArray(eventConfig.payload)
                ? (eventConfig.payload as Record<string, unknown>)
                : {}),
              [payloadKey]: target.value,
            }
          : { [payloadKey]: target.value };

        if (onEvent) {
          onEvent(eventConfig.event, payload);
        }
      };
    }

    return attrs;
  });

  // ============================================
  // SHARED LOGIC (Both Composite and Leaf)
  // ============================================
  
  // Helper to evaluate visibility (Phase 2: Uses binding-resolver)
  const evaluateVisibility = (path: string | MaiaScriptExpression | undefined, itemData?: Record<string, unknown>): boolean => {
    if (!path) return true;
    const contextData = itemData ? { ...data, item: itemData } : data;
    try {
      return resolveVisibility(path, contextData);
    } catch (error) {
      console.warn('Visibility evaluation error:', error, 'path:', path, 'itemData:', itemData);
      return true;
    }
  };

  // Handle event (Phase 3: Uses event-handler module)
  function handleEvent(
    eventConfig: { event: string; payload?: Record<string, unknown> | string | ((data: unknown) => unknown) },
    itemData?: Record<string, unknown>,
  ) {
    if (!onEvent) return;
    const contextData = itemData ? { ...data, item: itemData } : data;
    const payload = resolvePayload(eventConfig.payload, contextData);
    onEvent(eventConfig.event, payload);
  }

  // Resolve bindings (Phase 2: Uses binding-resolver)
  const boundText = $derived.by(() => {
    if (!leaf?.bindings?.text) return undefined;
    return resolveText(leaf.bindings.text, data);
  });

  const isVisible = $derived.by(() => {
    const visibilityBinding = leaf?.bindings?.visible || composite?.bindings?.visible;
    if (!visibilityBinding) return true;
    return resolveVisibility(visibilityBinding, data);
  });

  const isDisabled = $derived.by(() => {
    if (!leaf?.bindings?.disabled) return false;
    return resolveDisabled(leaf.bindings.disabled, data);
  });

  // Leaf foreach
  const leafForeachItems = $derived.by(() => {
    if (nodeType !== 'leaf' || !leaf?.bindings?.foreach) return undefined;
    const items = resolveValue(leaf.bindings.foreach.items, data);
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
</script>

{#if !browser}
  <!-- SSR fallback -->
  <div class="text-slate-600">Loading...</div>
{:else if !isVisible}
  <!-- Hidden -->
{:else if nodeType === 'composite' && composite}
  <!-- COMPOSITE RENDERING -->
  {@const containerAttributes = (composite.container as any)?.attributes || {}}
  {@const hasDropzone = containerAttributes['data-dropzone'] === 'true'}
  <svelte:element
    this={containerTag}
    class={`${containerClasses} ${hasDropzone && isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
    {...containerAttributes}
    onsubmit={composite.events?.submit ? (e: Event) => { e.preventDefault(); handleEvent(composite.events!.submit!); } : undefined}
    onclick={composite.events?.click ? (e: MouseEvent) => { handleEvent(composite.events!.click!); } : undefined}
    onchange={composite.events?.change ? () => handleEvent(composite.events!.change!) : undefined}
    ondragstart={composite.events?.dragstart ? (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        const contextItemData = "item" in data && data.item ? (data.item as Record<string, unknown>) : undefined;
        const payload = resolvePayload(composite.events!.dragstart!.payload, contextItemData);
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          const payloadObj = payload as Record<string, unknown>;
          if ("id" in payloadObj) {
            e.dataTransfer.setData("text/plain", String(payloadObj.id));
          }
        } else if (typeof payload === "string") {
          e.dataTransfer.setData("text/plain", payload);
        }
      }
      handleEvent(composite.events!.dragstart!);
    } : undefined}
    ondragenter={composite.events?.dragenter ? (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      isDragOver = true;
      handleEvent(composite.events!.dragenter!);
    } : undefined}
    ondragover={composite.events?.dragover ? (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    } : undefined}
    ondragleave={composite.events?.dragleave ? (e: DragEvent) => {
      const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect();
      if (rect && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) {
        isDragOver = false;
      }
      handleEvent(composite.events!.dragleave!);
    } : undefined}
    ondrop={composite.events?.drop ? (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragOver = false;
      const draggedId = e.dataTransfer?.getData("text/plain");
      const dropPayload = resolvePayload(composite.events!.drop!.payload);
      if (draggedId && dropPayload && typeof dropPayload === "object") {
        if (onEvent) onEvent(composite.events!.drop!.event, { id: draggedId, ...dropPayload });
      } else if (draggedId) {
        if (onEvent) onEvent(composite.events!.drop!.event, { id: draggedId });
      } else {
        handleEvent(composite.events!.drop!);
      }
    } : undefined}
    ondragend={composite.events?.dragend ? () => handleEvent(composite.events!.dragend!) : undefined}
  >
    {#if composite.elements && composite.elements.length > 0}
      <!-- Nested elements structure -->
      {#each composite.elements as element}
        {#if element.slot === 'children'}
          <svelte:element this={element.tag || 'div'} class={element.classes} {...element.attributes || {}}>
            {#if childActors && childActors.length > 0}
              {#each childActors as childActor}
                {@const childActorId = childActor?.$jazz?.id}
                {#if childActorId}
                  <ActorEngine actorId={childActorId} {accountCoState} />
                {/if}
              {/each}
            {:else if resolvedChildren && resolvedChildren.length > 0}
              {#each resolvedChildren as child}
                {@const childVisibility = child.visible || (child.composite?.bindings?.visible) || (child.composite?.visible)}
                {@const isChildVisible = !childVisibility || evaluateVisibility(childVisibility)}
                {#if isChildVisible}
                  <ViewEngine node={child} {data} {config} {onEvent} />
                {/if}
              {/each}
            {/if}
          </svelte:element>
        {:else}
          <svelte:element this={element.tag} class={element.classes} {...element.attributes || {}} />
        {/if}
      {/each}
    {:else if composite.foreach && foreachItems}
      <!-- Foreach rendering -->
      {@const foreachConfig = composite.foreach}
      {@const keyProp = foreachConfig.key || "_index"}
      {#each foreachItems as item, index (typeof item === "object" && item !== null && keyProp in item ? String((item as Record<string, unknown>)[keyProp]) : index)}
        {@const itemData = typeof item === "object" && item !== null ? item : {}}
        {@const itemRecord = itemData as Record<string, unknown>}
        {#if foreachConfig.composite}
          {@const compositeTemplate = foreachConfig.composite}
          {@const visibilityPath = compositeTemplate.bindings?.visible}
          {@const isCompositeVisible = !visibilityPath || evaluateVisibility(visibilityPath, itemRecord)}
          {#if isCompositeVisible}
            <ViewEngine
              node={{ slot: "item", composite: compositeTemplate }}
              data={{ ...data, item: itemData }}
              {config}
              {onEvent}
            />
          {/if}
        {:else if foreachConfig.leaf}
          <ViewEngine
            node={{ slot: "item", leaf: foreachConfig.leaf }}
            data={{ ...data, item: itemData }}
            {config}
            {onEvent}
          />
        {/if}
      {/each}
    {:else if childActors && childActors.length > 0}
      <!-- Actor-based rendering -->
      {#each childActors as childActor}
        {@const childActorId = childActor?.$jazz?.id}
        {#if childActorId}
          <ActorEngine actorId={childActorId} {accountCoState} />
        {/if}
      {/each}
    {:else if resolvedChildren && resolvedChildren.length > 0}
      <!-- Regular children rendering -->
      {#each resolvedChildren as child}
        {@const childVisibility = child.visible || (child.composite?.bindings?.visible) || (child.composite?.visible)}
        {@const isChildVisible = !childVisibility || evaluateVisibility(childVisibility)}
        {#if isChildVisible}
          <ViewEngine node={child} {data} {config} {onEvent} />
        {/if}
      {/each}
    {/if}
  </svelte:element>
{:else if nodeType === 'leaf' && leaf && validation.valid}
  <!-- LEAF RENDERING -->
  {#if leafForeachItems && leaf.bindings?.foreach}
    <!-- List rendering -->
    {@const foreachConfig = leaf.bindings.foreach}
    {@const keyProp = foreachConfig.key || "_index"}
    {#if isVoidElement}
      <div class="text-red-500">Error: Cannot use void element '{leaf.tag}' as foreach container</div>
    {:else}
      <svelte:element
        this={leaf.tag}
        class={`${leafClasses} ${leaf.attributes?.['data-dropzone'] === 'true' && isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
        {...attributes}
      >
        {#each leafForeachItems as item, index (typeof item === "object" && item !== null && keyProp in item ? String((item as Record<string, any>)[keyProp]) : index)}
          {@const itemData = typeof item === "object" && item !== null ? item : {}}
          <ViewEngine
            node={{ slot: "item", leaf: foreachConfig.leaf }}
            data={{ ...data, item: itemData }}
            {config}
            {onEvent}
          />
        {/each}
      </svelte:element>
    {/if}
  {:else if leaf.tag === "icon" && leaf.icon}
    <!-- Icon rendering -->
    {@const iconName = typeof leaf.icon.name === "string" && (leaf.icon.name.includes("item.") || leaf.icon.name.includes("data."))
      ? String(resolveValue(leaf.icon.name))
      : leaf.icon.name}
    {@const iconClasses = leaf.icon.classes ? leaf.icon.classes.split(/\s+/).filter(Boolean).map((cls) => {
      if (typeof cls === "string" && (cls.includes("item.") || cls.includes("data."))) {
        return String(resolveValue(cls));
      }
      return cls;
    }) : []}
    {@const iconColor = leaf.icon.color ? (leaf.icon.color.includes("item.") || leaf.icon.color.includes("data.") ? String(resolveValue(leaf.icon.color)) : leaf.icon.color) : undefined}
    {@const iconStyle = iconColor ? `color: ${iconColor}` : undefined}
    <Icon
      icon={iconName}
      class={iconClasses.length > 0 ? sanitizeClasses(iconClasses).sanitized.join(" ") : "w-4 h-4"}
      style={iconStyle}
      {...attributes}
    />
  {:else}
    <!-- Regular element rendering -->
    {@const baseHref = leaf.tag === "a" && leaf.attributes?.href && typeof leaf.attributes.href === "string" ? leaf.attributes.href : undefined}
    {@const resolvedHref = baseHref && baseHref.endsWith("=") && "item" in data && data.item ? baseHref + String((data.item as Record<string, any>).id || "") : baseHref}
    {@const isInternalLink = leaf.tag === "a" && resolvedHref && resolvedHref.startsWith("/")}
    {@const finalAttributes = leaf.tag === "a" && resolvedHref ? { ...attributes, href: isInternalLink ? "#" : resolvedHref } : attributes}
    <svelte:element
      this={leaf.tag}
      class={`${leafClasses} ${leaf.attributes?.['data-dropzone'] === 'true' && isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
      {...finalAttributes}
      onclick={leaf.tag === "input" || leaf.tag === "textarea" ? undefined : (e: MouseEvent) => {
        if (leaf.tag === "a" && resolvedHref && resolvedHref.startsWith("/")) {
          e.preventDefault();
          e.stopPropagation();
          goto(resolvedHref, { noScroll: true });
          return;
        }
        if (!leaf.events?.click) return;
        if (leaf.tag === "div" && leafClasses.includes("fixed") && e.target !== e.currentTarget) return;
        if (leaf.events.click.event === "") {
          e.stopPropagation();
          return;
        }
        handleEvent(leaf.events.click);
        if (leaf.tag === "button") e.stopPropagation();
      }}
      onsubmit={leaf.events?.submit ? (e: Event) => { e.preventDefault(); handleEvent(leaf.events!.submit!); } : undefined}
    >
      {#if !isVoidElement}
        {#if boundText !== undefined}
          {String(boundText)}
        {:else if leaf.elements && leaf.elements.length > 0}
          {#each leaf.elements as child}
            {#if typeof child === "string"}
              {child}
            {:else}
              <ViewEngine node={{ slot: "child", leaf: child }} {data} {config} {onEvent} />
            {/if}
          {/each}
        {/if}
      {/if}
    </svelte:element>
  {/if}
{:else if nodeType === 'leaf' && !validation.valid}
  <div class="text-red-500 p-4 rounded bg-red-50">
    Invalid leaf configuration: {validation.errors?.join(", ")}
  </div>
{/if}
