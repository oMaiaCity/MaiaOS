<script lang="ts">
  import PropertyItem from "./PropertyItem.svelte";
  import { Image } from "jazz-tools/svelte";
  import Badge from "./Badge.svelte";
  import { HOVERABLE_STYLE } from "$lib/utils/styles";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coValue: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractCoValueProperties: (coValue: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNavigate: (coValue: any, label?: string) => void;
  }

  let { coValue, extractCoValueProperties, onNavigate }: Props = $props();

  // Ensure CoValue is loaded
  $effect(() => {
    if (coValue && !coValue.$isLoaded && coValue.$jazz?.ensureLoaded) {
      coValue.$jazz.ensureLoaded();
    }
  });

  // Check if coValue is a CoList
  const isCoList = $derived(() => {
    if (!coValue || !coValue.$isLoaded) return false;
    try {
      // Check if it's iterable (CoList characteristic)
      return (
        Array.isArray(coValue) ||
        (coValue.length !== undefined && typeof coValue[Symbol.iterator] === "function")
      );
    } catch (e) {
      return false;
    }
  });

  // Check if coValue is a FileStream
  const isFileStream = $derived(() => {
    if (!coValue || !coValue.$isLoaded) return false;
    try {
      // Check for FileStream-specific methods
      const hasGetChunks = typeof (coValue as any).getChunks === "function";
      const hasToBlob = typeof (coValue as any).toBlob === "function";
      const hasIsBinaryStreamEnded = typeof (coValue as any).isBinaryStreamEnded === "function";
      return hasGetChunks || hasToBlob || hasIsBinaryStreamEnded;
    } catch (e) {
      return false;
    }
  });

  // Extract CoList items if it's a CoList
  const coListItems = $derived(() => {
    if (!isCoList() || !coValue.$isLoaded) return [];
    try {
      const items: any[] = [];
      const listArray = Array.from(coValue);
      items.push(
        ...listArray.map((item, index) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const itemAny = item as any;
          if (item && typeof item === "object" && "$jazz" in item) {
            return {
              index,
              type: "CoValue",
              id: itemAny.$jazz?.id || "unknown",
              isLoaded: itemAny.$isLoaded || false,
              preview: itemAny.$isLoaded
                ? itemAny["@label"] || itemAny.$jazz?.id?.slice(0, 8) || "CoValue"
                : "Loading...",
              item: item,
            };
          } else {
            return {
              index,
              type: "primitive",
              value: item,
            };
          }
        }),
      );
      return items;
    } catch (e) {
      return [];
    }
  });

  const properties = $derived(
    coValue && coValue.$isLoaded && !isCoList() && !isFileStream()
      ? extractCoValueProperties(coValue)
      : null,
  );

  // Get image property directly from avatar CoValue (like CoListGridCard does)
  // This avoids Proxy errors by accessing the image directly instead of through extracted properties
  const avatarImageDirect = $derived(() => {
    if (!coValue?.$isLoaded) return null;
    try {
      // Check if this is an avatar CoMap by checking if it has image property
      // Access directly like CoListGridCard: avatar.$jazz.has("image") && avatar.image?.$isLoaded
      if (coValue.$jazz && typeof coValue.$jazz.has === "function") {
        try {
          if (coValue.$jazz.has("image") && coValue.image?.$isLoaded) {
            return coValue.image;
          }
        } catch (e) {
          // If has() fails, try direct access
          if (coValue.image?.$isLoaded && coValue.image.$jazz?.id) {
            return coValue.image;
          }
        }
      } else {
        // Fallback: try direct access if has() not available
        if (coValue.image?.$isLoaded && coValue.image.$jazz?.id) {
          return coValue.image;
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return null;
  });

  // Handle navigation for nested CoValues
  function handleCoValueSelect(coValue: any, propKey?: string) {
    // Pass propKey as fallback label for CoMaps without @label
    onNavigate(coValue, propKey);
  }
</script>

{#if !coValue || !coValue.$isLoaded}
  <div class="text-center">
    <p class="text-sm text-slate-500">Loading...</p>
  </div>
{:else if isFileStream()}
  <!-- FileStream: Show metadata and properties -->
  {@const fileStream = coValue}
  {@const chunks = (() => {
    try {
      return fileStream.getChunks?.({ allowUnfinished: true });
    } catch (e) {
      return null;
    }
  })()}
  <div>
    <div class="space-y-4">
      <div
        class="bg-slate-200/50 rounded-2xl p-4 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
      >
        <div class="flex items-center gap-2 mb-3">
          <Badge type="FileStream" variant="compact">FileStream</Badge>
          {#if chunks}
            {#if chunks.mimeType}
              <span class="text-xs text-slate-600">{chunks.mimeType}</span>
            {/if}
            {#if chunks.totalSizeBytes}
              <span class="text-xs text-slate-500">
                ({Math.round(chunks.totalSizeBytes / 1024)}KB)
              </span>
            {/if}
            {#if chunks.fileName}
              <span class="text-xs text-slate-600">{chunks.fileName}</span>
            {/if}
            {#if chunks.finished}
              <Badge type="complete" variant="compact">Complete</Badge>
            {:else}
              <Badge type="uploading" variant="compact">Uploading...</Badge>
            {/if}
          {:else}
            <span class="text-xs text-slate-500">Loading metadata...</span>
          {/if}
        </div>
        {#if chunks && chunks.chunks && chunks.chunks.length > 0}
          <div class="mt-3">
            <div class="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Chunks: {chunks.chunks.length}
            </div>
            <div class="space-y-1">
              {#each chunks.chunks as chunk, index}
                <div class="text-xs text-slate-600">
                  Chunk {index + 1}: {chunk.length} bytes
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else if isCoList()}
  <!-- CoList: Show as styled metadata cards with @label and CoValue type -->
  <div>
    <div>
      {#if coListItems().length > 0}
        <div class="space-y-3">
          {#each coListItems() as item}
            {#if item.type === "CoValue" && item.item}
              {@const displayLabel =
                item.item.$isLoaded && item.item.$jazz.has("@label")
                  ? item.item["@label"]
                  : item.item.$isLoaded
                    ? item.item.$jazz.id.slice(0, 8) + "..."
                    : item.preview || "Loading..."}
              {@const schema =
                item.item.$isLoaded && item.item.$jazz.has("@schema")
                  ? item.item["@schema"]
                  : "CoValue"}
              <button
                type="button"
                onclick={() => handleCoValueSelect(item.item)}
                class="relative overflow-hidden rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE} w-full text-left p-4"
              >
                <!-- Glossy gradient overlay -->
                <div class="absolute inset-0 pointer-events-none"></div>
                <div class="relative flex items-center justify-between gap-3">
                  <span class="text-sm font-semibold text-slate-700">{displayLabel}</span>
                  <Badge type={schema}>{schema}</Badge>
                </div>
              </button>
            {:else}
              <div
                class="relative overflow-hidden rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] p-4"
              >
                <!-- Glossy gradient overlay -->
                <div
                  class="absolute inset-0 bg-linear-to-br from-white/60 via-white/20 to-transparent pointer-events-none"
                ></div>
                <div class="relative text-sm text-slate-600">
                  {typeof item.value === "string" ? item.value : JSON.stringify(item.value)}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <p class="text-sm text-slate-400 italic">Empty list</p>
      {/if}
    </div>
  </div>
{:else if properties}
  <!-- CoValue properties (Card wrapper handled by DataLayout) -->
  <div>
    <div class="space-y-4">
      {#each Object.entries(properties.properties).filter(([propKey]) => {
        // Skip image property if we're viewing avatar and have direct access
        // We'll render it separately using direct access (like CoListGridCard does)
        if (propKey === "image" && avatarImageDirect()) {
          return false;
        }
        return true;
      }) as [propKey, propValue]}
        {#if typeof propValue === "object" && propValue !== null && "type" in propValue}
          {#if propValue.type === "CoList"}
            <!-- CoList: Show as styled metadata cards with @label and CoValue type -->
            {@const coListProp = propValue as { type: string; items?: any[] }}
            {#if coListProp.items && coListProp.items.length > 0}
              <div class="space-y-3">
                {#each coListProp.items as item}
                  {#if item.type === "CoValue" && item.item}
                    {@const displayLabel =
                      item.item.$isLoaded && item.item.$jazz.has("@label")
                        ? item.item["@label"]
                        : item.item.$isLoaded
                          ? item.item.$jazz.id.slice(0, 8) + "..."
                          : item.preview || "Loading..."}
                    {@const schema =
                      item.item.$isLoaded && item.item.$jazz.has("@schema")
                        ? item.item["@schema"]
                        : "CoValue"}
                    <button
                      type="button"
                      onclick={() => handleCoValueSelect(item.item)}
                      class="relative overflow-hidden rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE} w-full text-left p-4"
                    >
                      <!-- Glossy gradient overlay -->
                      <div
                        class="absolute inset-0 bg-linear-to-br from-white/60 via-white/20 to-transparent pointer-events-none"
                      ></div>
                      <div class="relative flex items-center justify-between gap-3">
                        <span class="text-sm font-semibold text-slate-700">{displayLabel}</span>
                        <Badge type={schema}>{schema}</Badge>
                      </div>
                    </button>
                  {:else}
                    <div
                      class="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-slate-200/50 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] p-4"
                    >
                      <!-- Glossy gradient overlay -->
                      <div
                        class="absolute inset-0 bg-linear-to-br from-white/60 via-white/20 to-transparent pointer-events-none"
                      ></div>
                      <div class="relative text-sm text-slate-600">
                        {typeof item.value === "string" ? item.value : JSON.stringify(item.value)}
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            {:else}
              <p class="text-sm text-slate-400 italic">Empty list</p>
            {/if}
          {:else}
            <!-- All other property types: Use standardized PropertyItem component -->
            <PropertyItem
              {propKey}
              {propValue}
              onSelect={(coValue, fallbackKey) =>
                handleCoValueSelect(coValue, fallbackKey || propKey)}
            />
          {/if}
        {:else}
          <!-- Primitive values: Use standardized PropertyItem component -->
          <PropertyItem
            {propKey}
            {propValue}
            onSelect={(coValue, fallbackKey) =>
              handleCoValueSelect(coValue, fallbackKey || propKey)}
          />
        {/if}
      {/each}

      <!-- Render image property directly from avatar (like CoListGridCard does) -->
      {#if avatarImageDirect()}
        {@const img = avatarImageDirect()}
        {@const imagePropValue = {
          type: "ImageDefinition",
          id: img.$jazz?.id || "unknown",
          isLoaded: img.$isLoaded || false,
          coValue: img,
          imageDefinition: img,
        }}
        <PropertyItem
          propKey="image"
          propValue={imagePropValue}
          onSelect={(coValue, fallbackKey) => handleCoValueSelect(coValue, fallbackKey || "image")}
        />
      {/if}
    </div>
  </div>
{:else}
  <div class="text-center py-8">
    <p class="text-sm text-slate-500">No properties available</p>
  </div>
{/if}
