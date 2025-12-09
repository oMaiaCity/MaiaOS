<!--
  Leaf Renderer Component
  Recursively renders LeafNode structures from JSON config
  Handles data bindings, events, and list rendering
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import Icon from "@iconify/svelte";
  import type { LeafNode } from "./leaf-types";
  import type { Data } from "../dataStore";
  import { resolveDataPath } from "./resolver";
  import { sanitizeClasses } from "./whitelist";
  import LeafRenderer from "./LeafRenderer.svelte";

  interface Props {
    leaf: LeafNode;
    data: Data;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  let { leaf, data, onEvent }: Props = $props();

  // Resolve data path to value or evaluate expression
  function resolveValue(path: string): unknown {
    // Check if it's an expression (contains operators like ===, !==, etc.)
    if (
      path.includes("===") ||
      path.includes("!==") ||
      path.includes("==") ||
      path.includes("!=") ||
      path.includes(">") ||
      path.includes("<")
    ) {
      // Evaluate JavaScript expression in the context of data
      try {
        // Extract item from data if it exists (for foreach contexts)
        const item = "item" in data && data.item ? (data.item as Record<string, unknown>) : {};

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
            expression = expression.replace(new RegExp(`data\\.${key}`, "g"), key);
          });

          // Use Function constructor for safer evaluation than eval
          // Dynamically create function with all referenced data properties
          const func = new Function(...dataKeys, "item", `return ${expression}`);
          const result = func(...dataValues, item);
          return result;
        } else {
          // Expression only references 'item' (for foreach contexts)
          // Use Function constructor for safer evaluation than eval
          const func = new Function("item", `return ${path}`);
          const result = func(item);
          return result;
        }
      } catch (error) {
        console.warn(`Failed to evaluate expression "${path}":`, error);
        return false;
      }
    }
    // Otherwise resolve as data path
    return resolveDataPath(data, path);
  }

  // Resolve payload (can be data path string or object)
  function resolvePayload(
    payload: Record<string, unknown> | string | ((data: unknown) => unknown) | undefined,
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
      ("item" in data && data.item ? (data.item as Record<string, unknown>) : undefined);
    const payload = resolvePayload(eventConfig.payload, contextItemData);

    onEvent(eventConfig.event, payload);
  }

  // Get sanitized classes
  const classes = $derived(leaf.classes ? sanitizeClasses(leaf.classes).join(" ") : "");

  // Resolve bindings - ensure we access data to trigger reactivity
  const boundValue = $derived.by(() => {
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
    // If we're in a foreach context, access all item properties to trigger reactivity
    if ("item" in data && data.item && typeof data.item === "object") {
      const item = data.item as Record<string, unknown>;
      // Access all properties to ensure reactivity tracking for any property changes
      Object.keys(item).forEach((key) => {
        const __ = item[key];
      });
    }
    return resolveValue(leaf.bindings.visible);
  });
  const isVisible = $derived(visibleValue === undefined ? true : Boolean(visibleValue));
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

  const isVoidElement = $derived(VOID_ELEMENTS.has(leaf.tag));

  // Build attributes object - reactive to ensure updates
  // For inputs, directly access the data property to ensure Svelte tracks changes
  const inputValue = $derived.by(() => {
    if (leaf.tag !== "input" || !leaf.bindings?.value) return undefined;

    // Directly access the property from data to ensure Svelte tracks it
    const dataPath = leaf.bindings.value;
    // Remove "data." prefix if present (e.g., "data.newTodoText" -> "newTodoText")
    const propName = dataPath.startsWith("data.") ? dataPath.slice(5) : dataPath;

    // Access the entire data object first to ensure reactivity
    const currentData = data;
    // Then access the specific property
    // This ensures Svelte tracks changes to the property
    if (propName in currentData) {
      const value = (currentData as Record<string, unknown>)[propName];
      // Return the value, ensuring empty strings are preserved
      return value;
    }
    return undefined;
  });

  const attributes = $derived.by(() => {
    const attrs: Record<string, string | boolean | number> = { ...leaf.attributes };

    // Bind value for inputs - use reactive value
    if (leaf.tag === "input" && leaf.bindings?.value) {
      // Access data to ensure reactivity
      const _ = data;
      // Get the current input value (which is already reactive)
      const value = inputValue;
      // Always set value, even if empty string
      attrs.value = value !== undefined ? String(value) : "";
    }

    return attrs;
  });
</script>

{#if !browser}
  <!-- SSR fallback -->
  <div class="text-slate-600">Loading...</div>
{:else if !isVisible}
  <!-- Conditional rendering - hidden -->
{:else if foreachItems && leaf.bindings?.foreach}
  <!-- List rendering -->
  {@const foreachConfig = leaf.bindings.foreach}
  {@const keyProp = foreachConfig.key || "_index"}
  {#if isVoidElement}
    <!-- Void elements cannot be containers for foreach -->
    <div class="text-red-500">Error: Cannot use void element '{leaf.tag}' as foreach container</div>
  {:else}
    <svelte:element
      this={leaf.tag}
      class={classes}
      {...attributes}
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
      ondrop={leaf.events?.drop
        ? (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent bubbling to parent drop zones
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
        {@const itemData = typeof item === "object" && item !== null ? item : {}}
        <!-- Access all item properties to ensure reactivity when any property changes -->
        {@const itemRecord = itemData as Record}
        {#if itemRecord}
          {@const _ = Object.keys(itemRecord).map((key) => (itemRecord as Record)[key])}
        {/if}
        <LeafRenderer leaf={foreachConfig.leaf} data={{ ...data, item: itemData }} {onEvent} />
      {/each}
    </svelte:element>
  {/if}
{:else if isVoidElement}
  <!-- Void element rendering - no children allowed -->
  <svelte:element
    this={leaf.tag}
    class={classes}
    {...attributes}
    onclick={(e: MouseEvent) => {
      if (!leaf.events?.click) {
        e.stopPropagation();
        return;
      }
      if (leaf.tag === "div" && classes.includes("fixed") && e.target !== e.currentTarget) {
        return;
      }
      handleEvent(leaf.events.click);
    }}
    oninput={leaf.events?.input
      ? (e: Event) => {
          const target = e.target as HTMLInputElement;
          const eventConfig = leaf.events!.input!;
          const payload = eventConfig.payload
            ? {
                ...(typeof eventConfig.payload === "object" && !Array.isArray(eventConfig.payload)
                  ? eventConfig.payload
                  : {}),
                text: target.value,
              }
            : { text: target.value };
          if (onEvent) {
            onEvent(eventConfig.event, payload);
          }
        }
      : undefined}
    onchange={leaf.events?.change ? () => handleEvent(leaf.events!.change!) : undefined}
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
            const contextItemData = "item" in data && data.item ? (data.item as Record) : undefined;
            const payload = resolvePayload(leaf.events!.dragstart!.payload, contextItemData);

            if (payload && typeof payload === "object" && !Array.isArray(payload)) {
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
    ondragleave={leaf.events?.dragleave ? () => handleEvent(leaf.events!.dragleave!) : undefined}
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
            const dragStartPayload = resolvePayload(leaf.events!.dragstart?.payload);
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
    ondragend={leaf.events?.dragend ? () => handleEvent(leaf.events!.dragend!) : undefined}
    onkeydown={leaf.events?.keydown
      ? (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            handleEvent(leaf.events!.keydown!);
          }
        }
      : undefined}
    onkeyup={leaf.events?.keyup ? () => handleEvent(leaf.events!.keyup!) : undefined}
    onfocus={leaf.events?.focus ? () => handleEvent(leaf.events!.focus!) : undefined}
    onblur={leaf.events?.blur ? () => handleEvent(leaf.events!.blur!) : undefined}
  />
{:else if leaf.tag === "icon" && leaf.icon}
  <!-- Iconify icon rendering -->
  <Icon
    icon={leaf.icon.name}
    class={leaf.icon.classes ? sanitizeClasses(leaf.icon.classes).join(" ") : "w-4 h-4"}
    {...attributes}
  />
{:else}
  <!-- Regular element rendering -->
  <svelte:element
    this={leaf.tag}
    class={classes}
    {...attributes}
    onclick={(e: MouseEvent) => {
      // Stop propagation for elements without click events (like modal content)
      if (!leaf.events?.click) {
        e.stopPropagation();
        return;
      }

      // For modal backdrop (fixed div), only trigger if clicking the backdrop itself
      if (leaf.tag === "div" && classes.includes("fixed") && e.target !== e.currentTarget) {
        // Clicked inside modal content - don't close
        return;
      }

      // For empty event strings, just stop propagation (used for modal content)
      if (leaf.events.click.event === "") {
        e.stopPropagation();
        return;
      }

      // For buttons, ensure clicks work even when clicking child elements (like SVG)
      // Don't stop propagation - let the click bubble up to the button
      // But if the button is inside a modal backdrop, stop propagation after handling
      handleEvent(leaf.events.click);

      // If this is a button inside a modal backdrop, stop propagation after handling
      // This prevents the backdrop click from also firing
      if (leaf.tag === "button" && leaf.events.click.event === "CLOSE_MODAL") {
        e.stopPropagation();
      }
    }}
    oninput={leaf.events?.input
      ? (e: Event) => {
          const target = e.target as HTMLInputElement;
          const eventConfig = leaf.events!.input!;
          // Always send the input value in the payload
          const payload = eventConfig.payload
            ? {
                ...(typeof eventConfig.payload === "object" && !Array.isArray(eventConfig.payload)
                  ? eventConfig.payload
                  : {}),
                text: target.value,
              }
            : { text: target.value };
          if (onEvent) {
            onEvent(eventConfig.event, payload);
          }
        }
      : undefined}
    onchange={leaf.events?.change ? () => handleEvent(leaf.events!.change!) : undefined}
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
            const contextItemData = "item" in data && data.item ? (data.item as Record) : undefined;
            const payload = resolvePayload(leaf.events!.dragstart!.payload, contextItemData);

            if (payload && typeof payload === "object" && !Array.isArray(payload)) {
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
    ondragleave={leaf.events?.dragleave ? () => handleEvent(leaf.events!.dragleave!) : undefined}
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
            const dragStartPayload = resolvePayload(leaf.events!.dragstart?.payload);
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
    ondragend={leaf.events?.dragend ? () => handleEvent(leaf.events!.dragend!) : undefined}
    onkeydown={leaf.events?.keydown
      ? (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            handleEvent(leaf.events!.keydown!);
          }
        }
      : undefined}
    onkeyup={leaf.events?.keyup ? () => handleEvent(leaf.events!.keyup!) : undefined}
    onfocus={leaf.events?.focus ? () => handleEvent(leaf.events!.focus!) : undefined}
    onblur={leaf.events?.blur ? () => handleEvent(leaf.events!.blur!) : undefined}
  >
    {#if !isVoidElement}
      {#if boundText !== undefined}
        <!-- Bound text content -->
        {String(boundText)}
      {:else if leaf.children && leaf.children.length > 0}
        <!-- Render children -->
        {#each leaf.children as child}
          {#if typeof child === "string"}
            {child}
          {:else}
            <LeafRenderer leaf={child} {data} {onEvent} />
          {/if}
        {/each}
      {/if}
    {/if}
  </svelte:element>
{/if}
