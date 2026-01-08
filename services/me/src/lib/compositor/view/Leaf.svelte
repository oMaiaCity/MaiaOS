<!--
  Leaf Component
  JAZZ-NATIVE ARCHITECTURE
  Validates and renders leaf nodes recursively
  Data is derived from actor.context (no dataStore copies)
-->
<script lang="ts">
  import type { VibeConfig } from "../types";
  import type { ViewNode } from "./types";
  import type { LeafNode } from "./leaf-types";
  import { browser } from "$app/environment";
  import { validateLeaf } from "./whitelist";
  import { resolveDataPath } from "./resolver";
  import { sanitizeClasses } from "./whitelist";
  import { viewNodeRegistry } from "./view-node-registry";
  import { resolveSchemaLeaf } from "./schema-resolver";
  import Icon from "@iconify/svelte";
  import { goto } from "$app/navigation";

  interface Props {
    node: ViewNode;
    data: Record<string, any>; // Jazz-native data from actor.context
    config?: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  const { node, data, config, onEvent }: Props = $props();

  // Recursive component reference (Svelte allows this)
  import LeafRecursive from "./Leaf.svelte";

  // Track drag-over state for visual feedback
  let isDragOver = $state(false);

  // Resolve leaf - either inline or by ID from registry
  const leaf = $derived.by(() => {
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
          console.error(`[Leaf] Leaf not found in registry: ${leafId}`, {
            nodeLeafId: node.leafId,
            resolvedLeafId: leafId,
            totalLeaves: leafIds.length,
            allRegisteredIds: leafIds,
            matchingIds: leafIds.filter(id => id?.includes('kanbanColumn')),
          });
        }
      } else if (node.leafId && typeof window !== 'undefined' && import.meta.env?.DEV) {
        // leafId resolution failed
        console.error(`[Leaf] Failed to resolve leafId: ${node.leafId}`, {
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

  // Validate leaf
  const validation = $derived(
    leaf ? validateLeaf(leaf) : { valid: false, errors: ["No leaf definition"] },
  );

  $effect(() => {
    if (!validation.valid) {
      // If leafId was provided but not resolved, show detailed warning
      if (node.leafId) {
        const allLeaves = viewNodeRegistry.getAllLeaves();
        const leafIds = allLeaves.map(l => l.id).filter(Boolean);
        
        console.warn(
          `Leaf component: leafId "${node.leafId}" not resolved.`,
          {
            nodeLeafId: node.leafId,
            resolvedLeaf: leaf,
            totalRegisteredLeaves: leafIds.length,
            allRegisteredIds: leafIds,
            dataView: data.view,
          }
        );
        return;
      }
      // Validation errors are handled in template
    }
  });

  // Resolve data path to value or evaluate expression
  function resolveValue(path: string): unknown {
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
      (path.includes("!") && path.match(/\s*!\s*data\./)) || // Handle !data.property patterns
      path.includes("String(") || // Handle String() function calls
      path.includes(".trim()") // Handle .trim() method calls
    ) {
      // Evaluate JavaScript expression in the context of data
      try {
        // Extract item from data if it exists (for foreach contexts)
        const item =
          "item" in data && data.item
            ? (data.item as Record<string, unknown>)
            : {};

        // Access all item properties to ensure reactivity tracking
        // This ensures Svelte tracks changes to any nested properties
        if (item && typeof item === "object") {
          Object.keys(item).forEach((key) => {
            const _ = item[key];
          });
        }

        // Check if expression references 'data.' - if so, we need to provide data context
        if (path.includes("data.")) {
          // Dynamically extract all data properties and create variables
          const dataObj = data as Record<string, unknown>;
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
          const dataObj = data as Record<string, unknown>;
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
      } catch (_error) {
        return false;
      }
    }
    // Otherwise resolve as data path
    return resolveDataPath(data, path);
  }

  // Resolve payload (can be data path string or object)
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
      // Data path - resolve it
      // If itemData is provided, use it as context
      const contextData = itemData ? { ...data, item: itemData } : data;
      const resolvedValue = resolveDataPath(contextData, payload);

      // Standardize: Always wrap ID paths as { id: ... }
      // This handles cases where config passes "item.id" and skills expect { id: "..." }
      if (payload.endsWith(".id") || payload.match(/\.\w+Id$/)) {
        return { id: resolvedValue };
      }

      // If payload is just "item.id" (without the .id check above), wrap it
      if (payload === "item.id" || payload === "data.item.id") {
        return { id: resolvedValue };
      }

      return resolvedValue;
    }

    if (typeof payload === "function") {
      // Function - call it with data
      return payload(itemData || data);
    }

    // Object payload - recursively resolve values
    if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
      const contextData = itemData ? { ...data, item: itemData } : data;
      const resolved: Record<string, unknown> = {};
      
      // Known data path root prefixes - only resolve strings that start with these
      // This is explicit and unambiguous - no guessing or heuristics
      const DATA_PATH_ROOTS = ['data.', 'item.', 'queries.', 'view.'];
      
      /**
       * Check if a string is an explicit data path reference
       * Rules:
       * 1. Must start with a known data path root (data., item., queries., view.)
       * 2. Must contain at least one dot after the root (ensures it's a path, not just a prefix match)
       * 3. This is explicit - no ambiguity, no guessing
       */
      function isExplicitDataPath(str: string): boolean {
        for (const root of DATA_PATH_ROOTS) {
          if (str.startsWith(root)) {
            // Must have at least one more character after the root (the dot is part of root)
            // e.g., "item.id" is valid, "item." alone would be invalid (but shouldn't happen)
            return str.length > root.length;
          }
        }
        return false;
      }
      
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === "string") {
          if (isExplicitDataPath(value)) {
            // Explicit data path - resolve it
            const resolvedValue = resolveDataPath(contextData, value);
            resolved[key] = resolvedValue;
          } else {
            // Literal string - keep as-is (no resolution)
            resolved[key] = value;
          }
        } else {
          // Keep non-string values as-is
          resolved[key] = value;
        }
      }
      
      return resolved;
    }

    // Static object - return as-is
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

    // If itemData is not provided but we're in a foreach context, extract it from data
    const contextItemData =
      itemData ||
      ("item" in data && data.item
        ? (data.item as Record<string, unknown>)
        : undefined);
    const payload = resolvePayload(eventConfig.payload, contextItemData);

    onEvent(eventConfig.event, payload);
  }

  // Get sanitized classes - resolve dynamic class values
  const classes = $derived.by(() => {
    let baseClasses = "";
    let dynamicClasses = "";

    // 1. Process static classes from leaf.classes
    if (leaf && leaf.classes) {
      const classArray = leaf.classes.split(/\s+/).filter(Boolean);
      const resolvedClasses = classArray.map((cls) => {
        if (
          typeof cls === "string" &&
          (cls.includes("item.") || cls.includes("data."))
        ) {
          // Try to resolve as data path or expression
          const resolved = resolveValue(cls);
          return typeof resolved === "string" ? resolved : cls;
        }
        return cls;
      });
      baseClasses = sanitizeClasses(resolvedClasses).sanitized.join(" ");
    }

    // 2. Process dynamic classes from leaf.bindings.class
    if (leaf && leaf.bindings?.class) {
      // Access data to ensure reactivity
      const _ = data;
      ensureReactivityForExpression(leaf.bindings.class);
      const resolved = resolveValue(leaf.bindings.class);
      if (typeof resolved === "string" && resolved.trim()) {
        const dynamicClassArray = resolved.split(/\s+/).filter(Boolean);
        dynamicClasses = sanitizeClasses(dynamicClassArray).sanitized.join(" ");
      }
    }

    // Combine base and dynamic classes
    return [baseClasses, dynamicClasses].filter(Boolean).join(" ");
  });

  // Helper function to extract and access properties from expressions for reactivity tracking
  function ensureReactivityForExpression(expression: string) {
    const dataObj = data as Record<string, unknown>;
    const accessedProperties = new Set<string>();

    // Extract properties referenced as "data.property"
    const dataPropertyMatches = expression.matchAll(/data\.(\w+)/g);
    for (const match of dataPropertyMatches) {
      const propName = match[1];
      if (!accessedProperties.has(propName) && propName in dataObj) {
        accessedProperties.add(propName);
        // Access the property to ensure reactivity
        const _ = dataObj[propName];
      }
    }

    // Extract direct property references (not keywords)
    const propertyMatches = expression.matchAll(/\b(\w+)\b/g);
    const keywords = new Set([
      "item",
      "String",
      "Number",
      "typeof",
      "isNaN",
      "trim",
      "return",
      "true",
      "false",
      "null",
      "undefined",
      "void",
      "new",
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

    // If we're in a foreach context, access all item properties to trigger reactivity
    if ("item" in data && data.item && typeof data.item === "object") {
      const item = data.item as Record<string, unknown>;
      Object.keys(item).forEach((key) => {
        const _ = item[key];
      });
    }
  }

  // Resolve bindings - ensure we access data to trigger reactivity
  const _boundValue = $derived.by(() => {
    if (!leaf.bindings?.value) return undefined;
    const _ = data; // Access data to ensure reactivity
    return resolveValue(leaf.bindings.value);
  });
  const boundText = $derived.by(() => {
    if (!leaf.bindings?.text) return undefined;
    const _ = data; // Access data to ensure reactivity
    return resolveValue(leaf.bindings.text);
  });
  const visibleValue = $derived.by(() => {
    if (!leaf.bindings?.visible) return undefined;
    // Access data to ensure reactivity
    const _ = data;
    // Dynamically extract and access properties from the expression for reactivity
    ensureReactivityForExpression(leaf.bindings.visible);
    return resolveValue(leaf.bindings.visible);
  });
  const isVisible = $derived(
    visibleValue === undefined ? true : Boolean(visibleValue),
  );

  const disabledValue = $derived.by(() => {
    if (!leaf.bindings?.disabled) return undefined;
    // Access data to ensure reactivity
    const _ = data;
    // Dynamically extract and access properties from the expression for reactivity
    ensureReactivityForExpression(leaf.bindings.disabled);
    // Evaluate the expression with current data values
    return resolveValue(leaf.bindings.disabled);
  });
  const isDisabled = $derived(
    disabledValue === undefined ? false : Boolean(disabledValue),
  );
  const foreachItems = $derived.by(() => {
    if (!leaf.bindings?.foreach) return undefined;

    // Access data to ensure reactivity
    const _ = data;

    // Resolve the items path generically
    const items = resolveValue(leaf.bindings.foreach.items);

    // Ensure we return an array (even if empty) or undefined
    if (Array.isArray(items)) {
      // Access array length and iterate through items to ensure reactivity
      // This ensures Svelte tracks changes to the array and individual items
      const __ = items.length;
      items.forEach((item) => {
        if (item && typeof item === "object") {
          // Access all properties of each item to ensure reactivity
          Object.keys(item).forEach((key) => {
            const ___ = (item as Record<string, unknown>)[key];
          });
        }
      });
      return items;
    }
    return undefined;
  });

  // Void elements that cannot have children
  const VOID_ELEMENTS = new Set([
    "input",
    "img",
    "br",
    "hr",
    "meta",
    "link",
    "area",
    "base",
    "col",
    "embed",
    "source",
    "track",
    "wbr",
  ]);

  const isVoidElement = $derived(leaf && leaf.tag ? VOID_ELEMENTS.has(leaf.tag) : false);

  // Build attributes object - reactive to ensure updates
  // For inputs, directly access the data property to ensure Svelte tracks changes
  const inputValue = $derived.by(() => {
    if (!leaf || leaf.tag !== "input" || !leaf.bindings?.value) return undefined;

    // Use resolveValue to properly handle nested paths (e.g., "data.view.someProperty")
    // This ensures we can access nested properties correctly
    const dataPath = leaf.bindings.value;
    const _ = data; // Access data to ensure reactivity

    // Use resolveValue to handle both top-level and nested paths
    const value = resolveValue(dataPath);

    // Return the value, ensuring empty strings are preserved
    return value !== undefined ? value : undefined;
  });

  const attributes = $derived.by(() => {
    const attrs: Record<
      string,
      string | boolean | number | ((e: Event) => void)
    > = {
      ...leaf.attributes,
    };

    // Don't resolve href here - we'll do it in the template to ensure consistency
    // This prevents conflicts between the resolved href in attributes and the click handler

    // Bind value for inputs - use reactive value
    // CRITICAL: If there's an input event handler, set initial value but don't make it reactive
    // This allows the browser to manage the input naturally while the handler updates data
    if (leaf.tag === "input" && leaf.bindings?.value) {
      if (!leaf.events?.input) {
        // No input handler: use reactive value binding
        const _ = data;
        const value = inputValue;
        attrs.value = value !== undefined ? String(value) : "";
      } else {
        // Has input handler: set value (including empty string to allow clearing)
        // The input handler will manage updates, but we need to sync empty values too
        // ALWAYS set the value (even if empty string) to override browser autocomplete
        const value = inputValue;
        attrs.value = value !== undefined ? String(value) : "";
      }
    }

    // Bind disabled state from bindings (reactive)
    if (leaf.bindings?.disabled !== undefined) {
      attrs.disabled = isDisabled;
    }

    // CRITICAL: Add input event handler to attrs so it gets properly attached
    if (leaf.events?.input) {
      const eventConfig = leaf.events.input;
      attrs.oninput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        
        // Extract field name from binding path (e.g., "context.newTodoText" → "newTodoText")
        let payloadKey = "text"; // fallback only
        if (leaf.bindings?.value && typeof leaf.bindings.value === 'string') {
          const bindingPath = leaf.bindings.value;
          const parts = bindingPath.split('.');
          if (parts.length > 0) {
            payloadKey = parts[parts.length - 1]; // ✅ EXTRACTED
          }
        }
        
        // Always send the input value in the payload
        const payload: Record<string, unknown> = eventConfig.payload
          ? {
              ...(typeof eventConfig.payload === "object" &&
              !Array.isArray(eventConfig.payload)
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
</script>

{#if !browser}
  <!-- SSR fallback -->
  <div class="text-slate-600">Loading...</div>
{:else if !leaf || !validation.valid}
  <div class="text-red-500 p-4 rounded bg-red-50">
    Invalid leaf configuration: {validation.errors?.join(", ")}
  </div>
{:else if !isVisible}
  <!-- Conditional rendering - hidden -->
{:else if foreachItems && leaf.bindings?.foreach}
  <!-- List rendering -->
  {@const foreachConfig = leaf.bindings.foreach}
  {@const keyProp = foreachConfig.key || "_index"}
  {#if isVoidElement}
    <!-- Void elements cannot be containers for foreach -->
    <div class="text-red-500">
      Error: Cannot use void element '{leaf.tag}' as foreach container
    </div>
  {:else}
    <svelte:element
      this={leaf.tag}
      class={`${classes} ${leaf.attributes?.['data-dropzone'] === 'true' && isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
      {...attributes}
      ondragenter={leaf.events?.dragenter
        ? (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
              e.dataTransfer.dropEffect = "move";
            }
            isDragOver = true;
            if (leaf.events?.dragenter) {
              handleEvent(leaf.events.dragenter);
            }
          }
        : undefined}
      ondragover={leaf.events?.dragover
        ? (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent bubbling to parent drop zones
            if (e.dataTransfer) {
              e.dataTransfer.dropEffect = "move";
            }
            // Don't call handleEvent on dragover - just allow the drop
          }
        : undefined}
      ondragleave={leaf.events?.dragleave
        ? (e: DragEvent) => {
            // Only remove drag-over state if we're actually leaving the element
            // (not just moving to a child element)
            const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect();
            if (rect && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) {
              isDragOver = false;
            }
            if (leaf.events?.dragleave) {
              handleEvent(leaf.events.dragleave);
            }
          }
        : undefined}
      ondrop={leaf.events?.drop
        ? (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent bubbling to parent drop zones
            isDragOver = false; // Reset drag-over state
            // Get the dragged item ID from dataTransfer (set during dragstart)
            const draggedId = e.dataTransfer?.getData("text/plain");
            // Get the drop payload (may contain status, category, or any other properties)
            const dropPayload = resolvePayload(leaf.events!.drop!.payload);

            if (draggedId && dropPayload && typeof dropPayload === "object") {
              // Combine dragged ID with drop payload - always use "id" as the key
              handleEvent({
                ...leaf.events!.drop!,
                payload: { id: draggedId, ...dropPayload },
              });
            } else {
              handleEvent(leaf.events!.drop!);
            }
          }
        : undefined}
    >
      {#each foreachItems as item, index (typeof item === "object" && item !== null && keyProp in item ? String((item as Record)[keyProp]) : index)}
        {@const itemData =
          typeof item === "object" && item !== null ? item : {}}
        <!-- Access all item properties to ensure reactivity when any property changes -->
        {@const itemRecord = itemData as Record}
        {#if itemRecord}
          {@const _ = Object.keys(itemRecord).map(
            (key) => (itemRecord as Record)[key],
          )}
        {/if}
        <LeafRecursive
          node={{ slot: "item", leaf: foreachConfig.leaf ? (foreachConfig.leaf['@schema'] ? resolveSchemaLeaf(foreachConfig.leaf) : foreachConfig.leaf) : undefined }}
          data={{ ...data, item: itemData }}
          {config}
          {onEvent}
        />
      {/each}
    </svelte:element>
  {/if}
{:else if isVoidElement}
  <!-- Void element rendering - no children allowed -->
  <svelte:element
    this={leaf.tag}
      class={`${classes} ${leaf.attributes?.['data-dropzone'] === 'true' && isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
      {...attributes}
    onclick={leaf.tag === "input" || leaf.tag === "textarea"
      ? undefined // Don't attach onclick handler for inputs/textareas - let browser handle focus naturally
      : (e: MouseEvent) => {
          if (!leaf.events?.click) {
            e.stopPropagation();
            return;
          }
          if (
            leaf.tag === "div" &&
            classes.includes("fixed") &&
            e.target !== e.currentTarget
          ) {
            return;
          }
          handleEvent(leaf.events.click);
        }}
    onchange={leaf.events?.change
      ? () => handleEvent(leaf.events!.change!)
      : undefined}
    onsubmit={leaf.events?.submit
      ? (e: Event) => {
          e.preventDefault();
          handleEvent(leaf.events!.submit!);
        }
      : undefined}
    ondragstart={leaf.events?.dragstart
      ? (e: DragEvent) => {
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            // Store the item ID in dataTransfer for drop event
            // Extract itemData from data if in foreach context
            const contextItemData =
              "item" in data && data.item ? (data.item as Record) : undefined;
            const payload = resolvePayload(
              leaf.events!.dragstart!.payload,
              contextItemData,
            );

            if (
              payload &&
              typeof payload === "object" &&
              !Array.isArray(payload)
            ) {
              // Always use "id" property - standardized across the stack
              const payloadObj = payload as Record;
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
    ondragover={leaf.events?.dragover
      ? (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation(); // Prevent bubbling to parent drop zones
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
          }
          // Don't call handleEvent on dragover - just allow the drop
        }
      : undefined}
    ondragleave={leaf.events?.dragleave
      ? () => handleEvent(leaf.events!.dragleave!)
      : undefined}
    ondrop={leaf.events?.drop
      ? (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation(); // Prevent bubbling to parent drop zones
          // Get the dragged item ID from dataTransfer (set during dragstart)
          const draggedId = e.dataTransfer?.getData("text/plain");
          // Get the drop payload (may contain status, category, or any other properties)
          const dropPayload = resolvePayload(leaf.events!.drop!.payload);

          if (draggedId && dropPayload && typeof dropPayload === "object") {
            // Merge dragged ID with drop payload properties
            // Extract the ID property name from the dragstart payload if available
            const dragStartPayload = resolvePayload(
              leaf.events!.dragstart?.payload,
            );
            let idKey = "id"; // Default key

            // Try to infer the ID key from the dragstart payload
            if (dragStartPayload && typeof dragStartPayload === "object") {
              // Look for common ID property names
              const possibleIdKeys = Object.keys(dragStartPayload).filter(
                (key) => key.toLowerCase().endsWith("id") || key === "id",
              );
              if (possibleIdKeys.length > 0) {
                idKey = possibleIdKeys[0];
              }
            }

            // Combine dragged ID with drop payload
            handleEvent({
              ...leaf.events!.drop!,
              payload: { [idKey]: draggedId, ...dropPayload },
            });
          } else {
            handleEvent(leaf.events!.drop!);
          }
        }
      : undefined}
    ondragend={leaf.events?.dragend
      ? () => handleEvent(leaf.events!.dragend!)
      : undefined}
    onkeydown={leaf.events?.keydown
      ? (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            handleEvent(leaf.events!.keydown!);
          }
        }
      : leaf.tag === 'input' && leaf.events?.blur
      ? (e: KeyboardEvent) => {
          // For input elements with blur handler, trigger update on Enter or Tab
          if (e.key === "Enter") {
            e.preventDefault();
            // Blur the input to trigger the blur event handler
            if (e.target instanceof HTMLInputElement) {
              e.target.blur();
            }
          } else if (e.key === "Tab") {
            // For Tab, trigger the blur event handler before focus moves
            // This ensures the value is saved when Tab is pressed
            if (e.target instanceof HTMLInputElement && onEvent) {
              const eventConfig = leaf.events!.blur!
              const inputValue = e.target.value
              // Merge input value into payload if payload exists
              // Extract itemData from data.item if available (for foreach contexts)
              const contextItemData = ("item" in data && data.item
                ? (data.item as Record<string, unknown>)
                : undefined)
              const payload = resolvePayload(eventConfig.payload, contextItemData)
              
              // Determine the field name from the payload
              // If payload has a field with a literal string value (like 'name' or 'text'), use that as the field name
              let fieldName = 'name' // Default to 'name' for Todo entities
              if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
                // Look for a field that has a literal string value matching common field names
                for (const [key, value] of Object.entries(payload)) {
                  if (key !== 'id' && typeof value === 'string' && (value === 'name' || value === 'text')) {
                    fieldName = value
                    break
                  }
                }
              }
              
              const finalPayload = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
                ? { ...payload, [fieldName]: inputValue }
                : { [fieldName]: inputValue }
              onEvent(eventConfig.event, finalPayload)
              // Don't prevent default - let Tab work normally to move focus
            }
          }
        }
      : undefined}
    onkeyup={leaf.events?.keyup
      ? () => handleEvent(leaf.events!.keyup!)
      : undefined}
    onfocus={leaf.events?.focus
      ? () => handleEvent(leaf.events!.focus!)
      : undefined}
    onblur={leaf.events?.blur
      ? (e: FocusEvent) => {
          const eventConfig = leaf.events!.blur!
          // For input elements, read the value from the event target
          if (leaf.tag === 'input' && e.target instanceof HTMLInputElement) {
            const inputValue = e.target.value
            // Extract itemData from data.item if available (for foreach contexts)
            const contextItemData = ("item" in data && data.item
              ? (data.item as Record<string, unknown>)
              : undefined)
            // Merge input value into payload if payload exists
            const payload = resolvePayload(eventConfig.payload, contextItemData)
            
            // Extract field name from input binding (e.g., "item.name" -> "name", "context.newTodoText" -> "newTodoText")
            // This is generic and works for any field name
            let fieldName: string | undefined = undefined
            if (leaf.bindings?.value && typeof leaf.bindings.value === 'string') {
              const bindingPath = leaf.bindings.value
              console.log('[Leaf] Input event - binding path:', bindingPath, 'inputValue:', inputValue)
              // Extract the last part of the path (field name)
              const parts = bindingPath.split('.')
              if (parts.length > 0) {
                fieldName = parts[parts.length - 1]
                console.log('[Leaf] Input event - extracted field name:', fieldName)
              }
            }
            
            // Fallback: If no binding, try to extract from payload
            // Look for a field in payload that has a literal string value (not a data path)
            if (!fieldName && typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
              for (const [key, value] of Object.entries(payload)) {
                // If value is a literal string (not a data path), use the key as field name
                // Skip 'id' as it's always a data path
                if (key !== 'id' && typeof value === 'string' && !value.includes('.') && !value.startsWith('data.') && !value.startsWith('item.')) {
                  // Check if the value matches the key (like name: 'name') - that's the field name
                  if (value === key) {
                    fieldName = value
                    break
                  }
                }
              }
            }
            
            // If still no field name, we can't determine it - skip update
            if (!fieldName) {
              console.warn('[Leaf] Could not determine field name for input update', { binding: leaf.bindings?.value, payload })
              return
            }
            
            const finalPayload = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
              ? { ...payload, [fieldName]: inputValue }
              : { [fieldName]: inputValue }
            console.log('[Leaf] Input event - final payload:', finalPayload)
            if (onEvent) {
              onEvent(eventConfig.event, finalPayload)
            }
          } else {
            handleEvent(eventConfig)
          }
        }
      : undefined}
  />
{:else if leaf.tag === "icon" && leaf.icon}
  <!-- Iconify icon rendering -->
  {@const iconName =
    typeof leaf.icon.name === "string" &&
    (leaf.icon.name.includes("item.") || leaf.icon.name.includes("data."))
      ? String(resolveValue(leaf.icon.name))
      : leaf.icon.name}
  {@const iconClasses = leaf.icon.classes
    ? leaf.icon.classes
        .split(/\s+/)
        .filter(Boolean)
        .map((cls) => {
          // Resolve dynamic classes (e.g., "item.categoryColor")
          if (
            typeof cls === "string" &&
            (cls.includes("item.") || cls.includes("data."))
          ) {
            return String(resolveValue(cls));
          }
          return cls;
        })
    : []}
  {@const iconColor = leaf.icon.color
    ? leaf.icon.color.includes("item.") || leaf.icon.color.includes("data.")
      ? String(resolveValue(leaf.icon.color))
      : leaf.icon.color
    : undefined}
  {@const iconStyle = iconColor ? `color: ${iconColor}` : undefined}
  <Icon
    icon={iconName}
    class={iconClasses.length > 0
      ? sanitizeClasses(iconClasses).sanitized.join(" ")
      : "w-4 h-4"}
    style={iconStyle}
    {...attributes}
  />
{:else}
  <!-- Regular element rendering -->
  {@const baseHref =
    leaf.tag === "a" &&
    leaf.attributes?.href &&
    typeof leaf.attributes.href === "string"
      ? leaf.attributes.href
      : undefined}
  {@const resolvedHref =
    baseHref && baseHref.endsWith("=") && "item" in data && data.item
      ? baseHref + String((data.item as Record).id || "")
      : baseHref}
  {@const isInternalLink =
    leaf.tag === "a" && resolvedHref && resolvedHref.startsWith("/")}
  {@const finalAttributes =
    leaf.tag === "a" && resolvedHref
      ? { ...attributes, href: isInternalLink ? "#" : resolvedHref }
      : attributes}
  <svelte:element
    this={leaf.tag}
    class={`${classes} ${leaf.attributes?.['data-dropzone'] === 'true' && isDragOver ? 'bg-blue-50 border-blue-300 border-2' : ''}`}
    {...finalAttributes}
    onclick={leaf.tag === "input" || leaf.tag === "textarea"
      ? undefined // Don't attach onclick handler for inputs/textareas - let browser handle focus naturally
      : (e: MouseEvent) => {
          // Handle anchor tags with client-side navigation (SvelteKit)
          // CRITICAL: This must be checked FIRST and ALWAYS prevent default for internal links
          if (leaf.tag === "a" && resolvedHref && resolvedHref.startsWith("/")) {
            e.preventDefault();
            e.stopPropagation();
            goto(resolvedHref, { noScroll: true });
            return;
          }

          // Handle click events - allow clicks to bubble up to parent if no click handler
          if (!leaf.events?.click) {
            // Don't stop propagation - let clicks bubble up to parent elements
            // This allows parent elements (like vibe cards) to handle clicks on child elements
            return;
          }

          // For modal backdrop (fixed div), only trigger if clicking the backdrop itself
          if (
            leaf.tag === "div" &&
            classes.includes("fixed") &&
            e.target !== e.currentTarget
          ) {
            // Clicked inside modal content - don't close
            return;
          }

          // For empty event strings, just stop propagation (used for modal content)
          if (leaf.events.click.event === "") {
            e.stopPropagation();
            return;
          }

          // Handle the click event
          handleEvent(leaf.events.click);

          // Only stop propagation for buttons to prevent event bubbling issues
          // This is especially important for buttons inside modals
          // For other elements (like divs with click handlers), let clicks bubble naturally
          if (leaf.tag === "button") {
            e.stopPropagation();
          }
        }}
    onchange={leaf.events?.change
      ? () => handleEvent(leaf.events!.change!)
      : undefined}
    onsubmit={leaf.events?.submit
      ? (e: Event) => {
          e.preventDefault();

          // For forms, read input value, dispatch submit event, then clear
          if (leaf.tag === "form" && leaf.elements) {
            // Find input child with value binding
            const inputChild = leaf.elements.find(
              (child) =>
                typeof child === "object" &&
                child.tag === "input" &&
                child.bindings?.value
            );

            if (inputChild && typeof inputChild === "object" && inputChild.bindings?.value) {
              // Read current input value from data
              const inputValue = resolveValue(inputChild.bindings.value);
              const textValue = inputValue ? String(inputValue).trim() : "";

              // Don't submit if empty
              if (!textValue) {
                return;
              }

              // Dispatch submit event with value
              const submitEvent = leaf.events!.submit!;
              const payload = {
                ...(typeof submitEvent.payload === "object" ? submitEvent.payload : {}),
                text: textValue,
              };

              if (onEvent) {
                onEvent(submitEvent.event, payload);

                // Clear the input by dispatching UPDATE_INPUT with empty text
                if (inputChild.events?.input) {
                  onEvent(inputChild.events.input.event, { text: "" });
                }
              }
            } else {
              // No input child found, handle normally
              handleEvent(leaf.events!.submit!);
            }
          } else {
            // Not a form, handle normally
            handleEvent(leaf.events!.submit!);
          }
        }
      : undefined}
    ondragstart={leaf.events?.dragstart
      ? (e: DragEvent) => {
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            // Store the item ID in dataTransfer for drop event
            // Extract itemData from data if in foreach context
            const contextItemData =
              "item" in data && data.item ? (data.item as Record) : undefined;
            const payload = resolvePayload(
              leaf.events!.dragstart!.payload,
              contextItemData,
            );

            if (
              payload &&
              typeof payload === "object" &&
              !Array.isArray(payload)
            ) {
              // Always use "id" property - standardized across the stack
              const payloadObj = payload as Record;
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
    ondragover={leaf.events?.dragover
      ? (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation(); // Prevent bubbling to parent drop zones
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
          }
          // Don't call handleEvent on dragover - just allow the drop
        }
      : undefined}
    ondragleave={leaf.events?.dragleave
      ? () => handleEvent(leaf.events!.dragleave!)
      : undefined}
    ondrop={leaf.events?.drop
      ? (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation(); // Prevent bubbling to parent drop zones
          // Get the dragged item ID from dataTransfer (set during dragstart)
          const draggedId = e.dataTransfer?.getData("text/plain");
          // Get the drop payload (may contain status, category, or any other properties)
          const dropPayload = resolvePayload(leaf.events!.drop!.payload);

          if (draggedId && dropPayload && typeof dropPayload === "object") {
            // Merge dragged ID with drop payload properties
            // Extract the ID property name from the dragstart payload if available
            const dragStartPayload = resolvePayload(
              leaf.events!.dragstart?.payload,
            );
            let idKey = "id"; // Default key

            // Try to infer the ID key from the dragstart payload
            if (dragStartPayload && typeof dragStartPayload === "object") {
              // Look for common ID property names
              const possibleIdKeys = Object.keys(dragStartPayload).filter(
                (key) => key.toLowerCase().endsWith("id") || key === "id",
              );
              if (possibleIdKeys.length > 0) {
                idKey = possibleIdKeys[0];
              }
            }

            // Combine dragged ID with drop payload
            handleEvent({
              ...leaf.events!.drop!,
              payload: { [idKey]: draggedId, ...dropPayload },
            });
          } else {
            handleEvent(leaf.events!.drop!);
          }
        }
      : undefined}
    ondragend={leaf.events?.dragend
      ? () => handleEvent(leaf.events!.dragend!)
      : undefined}
    onkeydown={leaf.events?.keydown
      ? (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            handleEvent(leaf.events!.keydown!);
          }
        }
      : leaf.tag === 'input' && leaf.events?.blur
      ? (e: KeyboardEvent) => {
          // For input elements with blur handler, trigger update on Enter or Tab
          if (e.key === "Enter") {
            e.preventDefault();
            // Blur the input to trigger the blur event handler
            if (e.target instanceof HTMLInputElement) {
              e.target.blur();
            }
          } else if (e.key === "Tab") {
            // For Tab, trigger the blur event handler before focus moves
            // This ensures the value is saved when Tab is pressed
            if (e.target instanceof HTMLInputElement && onEvent) {
              const eventConfig = leaf.events!.blur!
              const inputValue = e.target.value
              // Merge input value into payload if payload exists
              // Extract itemData from data.item if available (for foreach contexts)
              const contextItemData = ("item" in data && data.item
                ? (data.item as Record<string, unknown>)
                : undefined)
              const payload = resolvePayload(eventConfig.payload, contextItemData)
              
              // Determine the field name from the payload
              // If payload has a field with a literal string value (like 'name' or 'text'), use that as the field name
              let fieldName = 'name' // Default to 'name' for Todo entities
              if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
                // Look for a field that has a literal string value matching common field names
                for (const [key, value] of Object.entries(payload)) {
                  if (key !== 'id' && typeof value === 'string' && (value === 'name' || value === 'text')) {
                    fieldName = value
                    break
                  }
                }
              }
              
              const finalPayload = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
                ? { ...payload, [fieldName]: inputValue }
                : { [fieldName]: inputValue }
              onEvent(eventConfig.event, finalPayload)
              // Don't prevent default - let Tab work normally to move focus
            }
          }
        }
      : undefined}
    onkeyup={leaf.events?.keyup
      ? () => handleEvent(leaf.events!.keyup!)
      : undefined}
    onfocus={leaf.events?.focus
      ? () => handleEvent(leaf.events!.focus!)
      : undefined}
    onblur={leaf.events?.blur
      ? (e: FocusEvent) => {
          const eventConfig = leaf.events!.blur!
          // For input elements, read the value from the event target
          if (leaf.tag === 'input' && e.target instanceof HTMLInputElement) {
            const inputValue = e.target.value
            // Extract itemData from data.item if available (for foreach contexts)
            const contextItemData = ("item" in data && data.item
              ? (data.item as Record<string, unknown>)
              : undefined)
            // Merge input value into payload if payload exists
            const payload = resolvePayload(eventConfig.payload, contextItemData)
            
            // Extract field name from input binding (e.g., "item.name" -> "name", "context.newTodoText" -> "newTodoText")
            // This is generic and works for any field name
            let fieldName: string | undefined = undefined
            if (leaf.bindings?.value && typeof leaf.bindings.value === 'string') {
              const bindingPath = leaf.bindings.value
              console.log('[Leaf] Input event - binding path:', bindingPath, 'inputValue:', inputValue)
              // Extract the last part of the path (field name)
              const parts = bindingPath.split('.')
              if (parts.length > 0) {
                fieldName = parts[parts.length - 1]
                console.log('[Leaf] Input event - extracted field name:', fieldName)
              }
            }
            
            // Fallback: If no binding, try to extract from payload
            // Look for a field in payload that has a literal string value (not a data path)
            if (!fieldName && typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
              for (const [key, value] of Object.entries(payload)) {
                // If value is a literal string (not a data path), use the key as field name
                // Skip 'id' as it's always a data path
                if (key !== 'id' && typeof value === 'string' && !value.includes('.') && !value.startsWith('data.') && !value.startsWith('item.')) {
                  // Check if the value matches the key (like name: 'name') - that's the field name
                  if (value === key) {
                    fieldName = value
                    break
                  }
                }
              }
            }
            
            // If still no field name, we can't determine it - skip update
            if (!fieldName) {
              console.warn('[Leaf] Could not determine field name for input update', { binding: leaf.bindings?.value, payload })
              return
            }
            
            const finalPayload = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
              ? { ...payload, [fieldName]: inputValue }
              : { [fieldName]: inputValue }
            console.log('[Leaf] Input event - final payload:', finalPayload)
            if (onEvent) {
              onEvent(eventConfig.event, finalPayload)
            }
          } else {
            handleEvent(eventConfig)
          }
        }
      : undefined}
  >
    {#if !isVoidElement}
      {#if boundText !== undefined}
        <!-- Bound text content -->
        {String(boundText)}
      {:else if leaf.elements && leaf.elements.length > 0}
        <!-- Render elements -->
        {#each leaf.elements as child}
          {#if typeof child === "string"}
            {child}
          {:else}
            <LeafRecursive
              node={{ slot: "child", leaf: child }}
              {data}
              {config}
              {onEvent}
            />
          {/if}
        {/each}
      {/if}
    {/if}
  </svelte:element>
{/if}
