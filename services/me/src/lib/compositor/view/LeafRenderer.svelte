<!--
  Leaf Renderer Component
  Recursively renders LeafNode structures from JSON config
  Handles data bindings, events, and list rendering
-->
<script lang="ts">
  import type { Data } from "../dataStore";
  import type { LeafNode } from "./leaf-types";
  import { resolveDataPath } from "./resolver";
  import { sanitizeClasses } from "./whitelist";
  import LeafRenderer from "./LeafRenderer.svelte";
  import Icon from "@iconify/svelte";

  interface Props {
    leaf: LeafNode;
    data: Data;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  const { leaf, data, onEvent }: Props = $props();

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
          // Debug logging for disabled state
          if (
            path.includes("selectedRecipient") ||
            path.includes("sendAmount")
          ) {
            const valuesObj = Object.fromEntries(
              dataKeys.map((k, i) => [k, dataValues[i]]),
            );
            console.log(
              `[Disabled Expression] Expression: ${expression}, Result:`,
              result,
              "Values:",
              JSON.stringify(valuesObj, null, 2),
            );
          }
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
            // Debug logging for disabled state
            if (
              path.includes("selectedRecipient") ||
              path.includes("sendAmount")
            ) {
              const valuesObj = Object.fromEntries(
                dataKeys.map((k, i) => [k, dataValues[i]]),
              );
              console.log(
                `[Disabled Expression] Expression: ${path}, Result:`,
                result,
                "Values:",
                JSON.stringify(valuesObj, null, 2),
              );
            }
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
    if (!leaf.classes) return "";

    // Resolve dynamic classes (e.g., classes that reference data/item)
    const resolvedClasses = leaf.classes.map((cls) => {
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

    return sanitizeClasses(resolvedClasses).join(" ");
  });

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
    // Access data to ensure reactivity - explicitly access showSendModal for visibility
    const _ = data;
    const dataObj = data as Record<string, unknown>;
    const __ = dataObj.showSendModal; // Explicitly access showSendModal for reactivity
    // If we're in a foreach context, access all item properties to trigger reactivity
    if ("item" in data && data.item && typeof data.item === "object") {
      const item = data.item as Record<string, unknown>;
      // Access all properties to ensure reactivity tracking for any property changes
      Object.keys(item).forEach((key) => {
        const ___ = item[key];
      });
    }
    return resolveValue(leaf.bindings.visible);
  });
  const isVisible = $derived(
    visibleValue === undefined ? true : Boolean(visibleValue),
  );

  const disabledValue = $derived.by(() => {
    if (!leaf.bindings?.disabled) return undefined;
    // Access data to ensure reactivity - explicitly access selectedRecipient and sendAmount
    // Force reactivity by accessing these properties directly and storing them
    const dataObj = data as Record<string, unknown>;
    const selectedRecipient = dataObj.selectedRecipient;
    const sendAmount = dataObj.sendAmount;
    // Access the values to ensure Svelte tracks them - this is critical for reactivity
    const _ = selectedRecipient;
    const __ = sendAmount;
    // If we're in a foreach context, access all item properties to trigger reactivity
    if ("item" in data && data.item && typeof data.item === "object") {
      const item = data.item as Record<string, unknown>;
      // Access all properties to ensure reactivity tracking
      Object.keys(item).forEach((key) => {
        const ___ = item[key];
      });
    }
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

  const isVoidElement = $derived(VOID_ELEMENTS.has(leaf.tag));

  // Build attributes object - reactive to ensure updates
  // For inputs, directly access the data property to ensure Svelte tracks changes
  const inputValue = $derived.by(() => {
    if (leaf.tag !== "input" || !leaf.bindings?.value) return undefined;

    // Directly access the property from data to ensure Svelte tracks it
    const dataPath = leaf.bindings.value;
    // Remove "data." prefix if present (e.g., "data.newTodoText" -> "newTodoText")
    const propName = dataPath.startsWith("data.")
      ? dataPath.slice(5)
      : dataPath;

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
        // Has input handler: only set initial value (non-reactive)
        // The input handler will manage updates
        const value = inputValue;
        if (value !== undefined && value !== "") {
          attrs.value = String(value);
        }
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
        console.log(
          "[LeafRenderer] oninput fired on element:",
          leaf.tag,
          "event:",
          eventConfig.event,
        );
        const target = e.target as HTMLInputElement;
        // Determine payload key based on event name
        const payloadKey =
          eventConfig.event === "UPDATE_SEND_AMOUNT"
            ? "amount"
            : eventConfig.event === "UPDATE_SEND_DESCRIPTION"
              ? "description"
              : "text";
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

        console.log(
          "[Input Event]",
          eventConfig.event,
          "fired with payload:",
          payload,
        );

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
        {@const itemData =
          typeof item === "object" && item !== null ? item : {}}
        <!-- Access all item properties to ensure reactivity when any property changes -->
        {@const itemRecord = itemData as Record}
        {#if itemRecord}
          {@const _ = Object.keys(itemRecord).map(
            (key) => (itemRecord as Record)[key],
          )}
        {/if}
        <LeafRenderer
          leaf={foreachConfig.leaf}
          data={{ ...data, item: itemData }}
          {onEvent}
        />
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
      : undefined}
    onkeyup={leaf.events?.keyup
      ? () => handleEvent(leaf.events!.keyup!)
      : undefined}
    onfocus={leaf.events?.focus
      ? () => handleEvent(leaf.events!.focus!)
      : undefined}
    onblur={leaf.events?.blur
      ? () => handleEvent(leaf.events!.blur!)
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
    ? leaf.icon.classes.map((cls) => {
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
      ? sanitizeClasses(iconClasses).join(" ")
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
    class={classes}
    {...finalAttributes}
    onclick={(e: MouseEvent) => {
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
    oninput={leaf.events?.input
      ? (e: Event) => {
          const target = e.target as HTMLInputElement;
          const eventConfig = leaf.events!.input!;
          const payloadKey =
            eventConfig.event === "UPDATE_SEND_AMOUNT"
              ? "amount"
              : eventConfig.event === "UPDATE_SEND_DESCRIPTION"
                ? "description"
                : "text";
          const payload: Record = eventConfig.payload
            ? {
                ...(typeof eventConfig.payload === "object" &&
                !Array.isArray(eventConfig.payload)
                  ? (eventConfig.payload as Record)
                  : {}),
                [payloadKey]: target.value,
              }
            : { [payloadKey]: target.value };

          if (eventConfig.event === "UPDATE_SEND_AMOUNT") {
            console.log(
              "[Input Event] UPDATE_SEND_AMOUNT fired, value:",
              target.value,
              "payload:",
              payload,
            );
          }
          if (onEvent) {
            onEvent(eventConfig.event, payload);
          }
        }
      : undefined}
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
      : undefined}
    onkeyup={leaf.events?.keyup
      ? () => handleEvent(leaf.events!.keyup!)
      : undefined}
    onfocus={leaf.events?.focus
      ? () => handleEvent(leaf.events!.focus!)
      : undefined}
    onblur={leaf.events?.blur
      ? () => handleEvent(leaf.events!.blur!)
      : undefined}
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
