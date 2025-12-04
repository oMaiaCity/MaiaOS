<script lang="ts">
  import { Image } from "jazz-tools/svelte";

  interface Props {
    propKey: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propValue: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect?: (coValue: any, fallbackKey?: string) => void;
  }

  let { propKey, propValue, onSelect }: Props = $props();

  // Extract display value and type
  const displayInfo = $derived(() => {
    // Handle primitive values
    if (typeof propValue !== "object" || propValue === null) {
      return {
        displayValue: String(propValue || ""),
        type: typeof propValue,
        isCoValue: false,
        coValue: null,
        showImagePreview: false,
      };
    }

    // Handle arrays (before checking for type property)
    if (Array.isArray(propValue)) {
      // Display array items individually, joined with commas
      const arrayDisplay = propValue.map((item) => String(item)).join(", ");
      return {
        displayValue: arrayDisplay,
        type: "array",
        isCoValue: false,
        coValue: null,
        showImagePreview: false,
        isArray: true,
        arrayItems: propValue,
      };
    }

    // Handle plain objects (not CoValues) - check if it has $jazz property
    if (!("$jazz" in propValue) && !("type" in propValue)) {
      try {
        // Check if it's a plain object (not a CoValue)
        const keys = Object.keys(propValue).filter((k) => !k.startsWith("$"));
        if (keys.length > 0) {
          return {
            displayValue: JSON.stringify(propValue, null, 2),
            type: "object",
            isCoValue: false,
            coValue: null,
            showImagePreview: false,
          };
        }
      } catch (e) {
        // Fall through to default handling
      }
    }

    // Handle extracted property objects with type
    if ("type" in propValue) {
      if (propValue.type === "ImageDefinition") {
        // ImageDefinition: Show preview
        const imageId = (() => {
          try {
            if (propValue.coValue?.$jazz?.id) {
              return propValue.coValue.$jazz.id;
            }
            if (propValue.imageDefinition?.$jazz?.id) {
              return propValue.imageDefinition.$jazz.id;
            }
            if (propValue.rawValue?.$jazz?.id) {
              return propValue.rawValue.$jazz.id;
            }
          } catch (e) {
            // Ignore errors
          }
          return propValue.id || "unknown";
        })();
        const isImageLoaded = (() => {
          try {
            if (propValue.coValue?.$isLoaded) return true;
            if (propValue.imageDefinition?.$isLoaded) return true;
            if (propValue.rawValue?.$isLoaded) return true;
          } catch (e) {
            // Ignore errors
          }
          return propValue.isLoaded || false;
        })();

        return {
          displayValue: imageId,
          type: "Image",
          isCoValue: true,
          coValue: propValue.coValue || propValue.imageDefinition || propValue.rawValue,
          showImagePreview: isImageLoaded && imageId !== "unknown",
          imageId,
        };
      } else if (propValue.type === "FileStream") {
        return {
          displayValue: propValue.id || "unknown",
          type: "FileStream",
          isCoValue: true,
          coValue: propValue.coValue || propValue.fileStream,
          showImagePreview: false,
        };
      } else if (propValue.type === "CoMap") {
        return {
          displayValue: propValue.id || "unknown",
          type: "CoMap",
          isCoValue: true,
          coValue: propValue.coValue,
          showImagePreview: false,
        };
      } else if (propValue.type === "CoList") {
        return {
          displayValue: `${propValue.length || 0} items`,
          type: "CoList",
          isCoValue: true,
          coValue: propValue.coValue,
          showImagePreview: false,
        };
      } else if (propValue.type === "CoValue") {
        return {
          displayValue: propValue.id || "unknown",
          type: "CoValue",
          isCoValue: true,
          coValue: propValue.coValue,
          showImagePreview: false,
        };
      } else {
        // Other types
        return {
          displayValue: String(propValue),
          type: propValue.type || "unknown",
          isCoValue: false,
          coValue: null,
          showImagePreview: false,
        };
      }
    }

    // Fallback for raw values
    return {
      displayValue: String(propValue),
      type: typeof propValue,
      isCoValue: false,
      coValue: null,
      showImagePreview: false,
    };
  });

  // Get type badge color based on type
  function getTypeBadgeClass(type: string): string {
    const baseClass = "px-2 py-0.5 rounded-full border border-white text-[10px] font-bold uppercase tracking-wider shrink-0";
    switch (type.toLowerCase()) {
      case "string":
        return `${baseClass} bg-blue-50 text-blue-700`;
      case "number":
        return `${baseClass} bg-purple-50 text-purple-700`;
      case "boolean":
        return `${baseClass} bg-green-50 text-green-700`;
      case "image":
        return `${baseClass} bg-green-100 text-green-700`;
      case "filestream":
        return `${baseClass} bg-orange-100 text-orange-700`;
      case "comap":
        return `${baseClass} bg-purple-100 text-purple-700`;
      case "colist":
        return `${baseClass} bg-blue-100 text-blue-700`;
      case "covalue":
        return `${baseClass} bg-purple-100 text-purple-700`;
      case "object":
        return `${baseClass} bg-amber-50 text-amber-700`;
      case "array":
        return `${baseClass} bg-cyan-50 text-cyan-700`;
      default:
        return `${baseClass} bg-slate-50/80 text-slate-500`;
    }
  }
</script>

<div class="flex items-start gap-3">
  <!-- Left: Prop Key -->
  <span
    class="text-sm font-semibold text-slate-700 uppercase tracking-wider min-w-[120px] shrink-0 pt-0.5 break-all break-words whitespace-pre-wrap word-break break-word"
    style="word-break: break-all; overflow-wrap: anywhere;"
  >
    {propKey}:
  </span>

  <!-- Middle: Value (left-aligned) -->
  <div class="flex-1 min-w-0">
    {#if displayInfo().showImagePreview && displayInfo().imageId}
      <!-- ImageDefinition: Show preview -->
      {#if displayInfo().coValue && onSelect}
        <button
          type="button"
          onclick={() => {
            if (displayInfo().coValue && onSelect) {
              onSelect(displayInfo().coValue, propKey);
            }
          }}
          class="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div class="w-8 h-8 rounded overflow-hidden border border-slate-300 shrink-0">
            <Image
              imageId={displayInfo().imageId}
              width={32}
              height={32}
              alt={propKey}
              class="object-cover w-full h-full"
              loading="lazy"
            />
          </div>
          <span class="text-xs text-slate-700 font-mono break-all">{displayInfo().displayValue.slice(0, 8)}...</span>
          <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      {:else}
        <div class="inline-flex items-center gap-2">
          <div class="w-8 h-8 rounded overflow-hidden border border-slate-300 shrink-0">
            <Image
              imageId={displayInfo().imageId}
              width={32}
              height={32}
              alt={propKey}
              class="object-cover w-full h-full"
              loading="lazy"
            />
          </div>
          <span class="text-xs text-slate-700 font-mono break-all">{displayInfo().displayValue.slice(0, 8)}...</span>
        </div>
      {/if}
    {:else if displayInfo().isCoValue && displayInfo().coValue && onSelect}
      <!-- CoValue: Show ID and make clickable -->
      <button
        type="button"
        onclick={() => {
          if (displayInfo().coValue && onSelect) {
            onSelect(displayInfo().coValue, propKey);
          }
        }}
        class="inline-flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
      >
        <span class="text-sm text-slate-700 font-mono break-all">{displayInfo().displayValue.slice(0, 12)}...</span>
        <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    {:else}
      <!-- Primitive or non-navigable value: Allow wrapping for long strings -->
      {#if displayInfo().type === "object"}
        <!-- Object: Use monospace font and preserve formatting -->
        <pre
          class="text-xs text-slate-700 break-all break-words whitespace-pre-wrap word-break break-word font-mono bg-slate-50/50 p-2 rounded border border-slate-200 max-w-full overflow-x-auto"
          style="word-break: break-all; overflow-wrap: anywhere;"
        >
          {displayInfo().displayValue}
        </pre>
      {:else if displayInfo().type === "array" && displayInfo().arrayItems}
        <!-- Array: Display items individually without brackets -->
        <div class="flex flex-wrap items-center gap-1">
          {#each displayInfo().arrayItems as item, index}
            <span class="text-sm text-slate-700 bg-slate-50/50 px-2 py-0.5 rounded border border-slate-200">
              {String(item)}
            </span>
            {#if index < displayInfo().arrayItems.length - 1}
              <span class="text-slate-400">,</span>
            {/if}
          {/each}
        </div>
      {:else}
        <!-- Primitive values: Regular text with wrapping -->
        <span
          class="text-sm text-slate-700 break-all break-words whitespace-pre-wrap word-break break-word"
          style="word-break: break-all; overflow-wrap: anywhere;"
        >
          {displayInfo().displayValue}
        </span>
      {/if}
    {/if}
  </div>

  <!-- Right: Type Badge (right-aligned) -->
  <span class="{getTypeBadgeClass(displayInfo().type)} shrink-0 pt-0.5">
    {displayInfo().type}
  </span>
</div>

