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
        // Access data.item directly to ensure reactivity - Svelte will track changes
        // If item doesn't exist, create an empty object so expressions don't error
        const item = "item" in data && data.item ? (data.item as Record<string, unknown>) : {};
        // Access item.status directly to ensure reactivity tracking
        // This ensures Svelte tracks changes to nested properties
        const _ = item.status;

        // Check if expression references 'data.' - if so, we need to provide data context
        if (path.includes("data.")) {
          // Access data properties to ensure reactivity
          const dataObj = data as Record<string, unknown>;
          const viewMode = dataObj.viewMode;
          const newTodoText = dataObj.newTodoText;
          const showModal = dataObj.showModal;
          const error = dataObj.error;

          // Replace 'data.' with direct variable access in the expression
          // e.g., "data.viewMode === 'list'" becomes "viewMode === 'list'"
          // Handle property access like "data.newTodoText.length" -> "newTodoText.length"
          let expression = path;
          // Replace data.property with just property (handles both simple and chained access)
          expression = expression.replace(/data\.viewMode/g, "viewMode");
          expression = expression.replace(/data\.newTodoText/g, "newTodoText");
          expression = expression.replace(/data\.showModal/g, "showModal");
          expression = expression.replace(/data\.error/g, "error");

          // Use Function constructor for safer evaluation than eval
          // The expression can access the data properties directly as variables
          const func = new Function(
            "viewMode",
            "newTodoText",
            "showModal",
            "error",
            "item",
            `return ${expression}`,
          );
          const result = func(viewMode, newTodoText, showModal, error, item);
          return result;
        } else {
          // Expression only references 'item' (for foreach contexts)
          // Use Function constructor for safer evaluation than eval
          // The expression can access 'item' directly
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

      // If the payload path looks like it's an ID (ends with .id), wrap it in an object
      // This handles cases where skills expect { todoId: "..." } but config passes "item.id"
      if (payload.endsWith(".id") || payload.endsWith("Id")) {
        // Extract the property name from the event context if possible
        // For now, default to "todoId" for todo-related events
        return { todoId: resolvedValue };
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
    // Access data and item.status directly to ensure reactivity
    const _ = data;
    // If we're in a foreach context, access item.status to trigger reactivity
    if ("item" in data && data.item) {
      const item = data.item as Record<string, unknown>;
      const __ = item.status; // Access status to ensure reactivity
    }
    return resolveValue(leaf.bindings.visible);
  });
  const isVisible = $derived(visibleValue === undefined ? true : Boolean(visibleValue));
  const foreachItems = $derived.by(() => {
    if (!leaf.bindings?.foreach) return undefined;

    // Access data to ensure reactivity
    const _ = data;
    // If the path is "data.todos" or "todos", access it directly for better reactivity
    if (leaf.bindings.foreach.items === "data.todos" || leaf.bindings.foreach.items === "todos") {
      const todos = (data.todos as unknown[]) || [];
      // Access the array length and each item's status to ensure reactivity
      const __ = todos.length;
      todos.forEach((todo) => {
        if (todo && typeof todo === "object" && "status" in todo) {
          const ___ = (todo as Record<string, unknown>).status;
        }
      });
      return todos;
    }

    const items = resolveValue(leaf.bindings.foreach.items);
    // Ensure we return an array (even if empty) or undefined
    if (Array.isArray(items)) {
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
            // Get the todoId from dataTransfer (set during dragstart)
            const todoId = e.dataTransfer?.getData("text/plain");
            // Get the status from the drop event payload
            const dropPayload = resolvePayload(leaf.events!.drop!.payload);
            if (
              todoId &&
              dropPayload &&
              typeof dropPayload === "object" &&
              "status" in dropPayload
            ) {
              // Combine todoId and status
              handleEvent({
                ...leaf.events!.drop!,
                payload: { todoId, status: dropPayload.status },
              });
            } else {
              handleEvent(leaf.events!.drop!);
            }
          }
        : undefined}
    >
      {#each foreachItems as item, index (typeof item === "object" && item !== null && keyProp in item ? String((item as Record)[keyProp]) : index)}
        {@const itemData = typeof item === "object" && item !== null ? item : {}}
        <!-- Access item.status to ensure reactivity when status changes -->
        {@const _ = (itemData as Record).status}
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
            // Store the todoId in dataTransfer for drop event
            // Extract itemData from data if in foreach context
            const contextItemData = "item" in data && data.item ? (data.item as Record) : undefined;
            const payload = resolvePayload(leaf.events!.dragstart!.payload, contextItemData);
            if (payload && typeof payload === "object" && "todoId" in payload) {
              e.dataTransfer.setData("text/plain", String(payload.todoId));
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
          // Get the todoId from dataTransfer (set during dragstart)
          const todoId = e.dataTransfer?.getData("text/plain");
          // Get the status from the drop event payload
          const dropPayload = resolvePayload(leaf.events!.drop!.payload);
          if (todoId && dropPayload && typeof dropPayload === "object" && "status" in dropPayload) {
            // Combine todoId and status
            handleEvent({
              ...leaf.events!.drop!,
              payload: { todoId, status: dropPayload.status },
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
            // Store the todoId in dataTransfer for drop event
            // Extract itemData from data if in foreach context
            const contextItemData = "item" in data && data.item ? (data.item as Record) : undefined;
            const payload = resolvePayload(leaf.events!.dragstart!.payload, contextItemData);
            if (payload && typeof payload === "object" && "todoId" in payload) {
              e.dataTransfer.setData("text/plain", String(payload.todoId));
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
          // Get the todoId from dataTransfer (set during dragstart)
          const todoId = e.dataTransfer?.getData("text/plain");
          // Get the status from the drop event payload
          const dropPayload = resolvePayload(leaf.events!.drop!.payload);
          if (todoId && dropPayload && typeof dropPayload === "object" && "status" in dropPayload) {
            // Combine todoId and status
            handleEvent({
              ...leaf.events!.drop!,
              payload: { todoId, status: dropPayload.status },
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
