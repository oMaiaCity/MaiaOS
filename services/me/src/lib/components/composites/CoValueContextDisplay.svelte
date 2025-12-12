<script lang="ts">
  import type { LocalNode } from "cojson";
  import PropertyItem from "./PropertyItem.svelte";
  import { Image } from "jazz-tools/svelte";
  import Badge from "../leafs/Badge.svelte";
  import CoValueCard from "../leafs/CoValueCard.svelte";
  import {
    extractCoValueProperties,
    extractCoListItems,
  } from "../../utilities/coValueExtractor.js";
  import { isCoList, isFileStream } from "../../utilities/coValueType.js";
  import { ensureLoaded } from "../../utilities/coValueLoader.js";
  import { getDisplayLabel } from "../../utilities/coValueFormatter.js";
  import { useResolvedCoValue, getNodeFromCoValue } from "../../utilities/useResolvedCoValue.js";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coValue: any;
    // Optional node for resolving string IDs
    node?: LocalNode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNavigate: (coValue: any, label?: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onObjectNavigate?: (object: any, label: string, parentCoValue: any, parentKey: string) => void;
  }

  let { coValue, node: propNode, onNavigate, onObjectNavigate }: Props = $props();

  // Ensure CoValue is loaded (but don't pre-load nested properties)
  $effect(() => {
    if (
      typeof coValue !== "string" &&
      coValue &&
      coValue.$jazz &&
      !coValue.$isLoaded &&
      coValue.$jazz?.ensureLoaded
    ) {
      ensureLoaded(coValue).catch((e) => console.warn("Error loading CoValue:", e));
    }
  });

  // Get node for resolving CoValues
  const node = $derived(() => propNode || getNodeFromCoValue(coValue));

  // Get CoValue ID
  const coValueId = $derived(() => (typeof coValue === "string" ? coValue : coValue?.$jazz?.id));

  // Resolve CoValue using inspector-style approach
  // Create store once and update it reactively when inputs change
  const resolvedStore = $derived.by(() => {
    const id = coValueId();
    const n = node();
    return useResolvedCoValue(id, n);
  });
  const resolved = $derived($resolvedStore);

  const isCoListValue = $derived(() => {
    if (!resolved.type) return false;
    return resolved.type === "colist";
  });

  const isFileStreamValue = $derived(() => {
    if (!resolved.type) return false;
    return resolved.extendedType === "file" || isFileStream(coValue);
  });

  // Extract CoList items - use centralized utility
  const coListItems = $derived(() => {
    if (!isCoListValue() || !coValue?.$isLoaded) return [];
    return extractCoListItems(coValue);
  });

  // Extract properties from snapshot (no async loading needed)
  const properties = $derived(() => {
    if (!coValue || !coValue.$isLoaded || isCoListValue() || isFileStreamValue()) {
      return null;
    }
    return extractCoValueProperties(coValue);
  });

  // Get image property directly from avatar CoValue
  const avatarImageDirect = $derived(() => {
    if (!coValue?.$isLoaded) return null;
    try {
      if (coValue.$jazz && typeof coValue.$jazz.has === "function") {
        try {
          if (coValue.$jazz.has("image") && coValue.image?.$isLoaded) {
            return coValue.image;
          }
        } catch (e) {
          if (coValue.image?.$isLoaded && coValue.image.$jazz?.id) {
            return coValue.image;
          }
        }
      } else {
        if (coValue.image?.$isLoaded && coValue.image.$jazz?.id) {
          return coValue.image;
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return null;
  });

  function handleCoValueSelect(coValue: any, propKey?: string) {
    onNavigate(coValue, propKey);
  }
</script>

{#if !coValue || !coValue.$isLoaded}
  <div class="text-center">
    <p class="text-sm text-slate-500">Loading...</p>
  </div>
{:else if isFileStreamValue()}
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
                <div class="text-xs text-slate-600">Chunk {index + 1}: {chunk.length} bytes</div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else if isCoListValue()}
  <div>
    {#if coListItems().length > 0}
      <div class="space-y-3">
        {#each coListItems() as item}
          {#if item.coValue || item.item}
            <!-- CoValue item - use CoValueCard for navigation, shows exact type -->
            <CoValueCard
              {item}
              isSelected={false}
              onSelect={(coValue) => handleCoValueSelect(coValue)}
            />
          {:else}
            <!-- Primitive item - display as non-clickable -->
            <div
              class="px-4 py-3 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)]"
            >
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-xs text-slate-500">[{item.index}]</span>
                <Badge type="primitive" variant="compact">Primitive</Badge>
                <span class="text-xs text-slate-600 break-all wrap-break-word">
                  {typeof item.value === "string" ? item.value : JSON.stringify(item.value)}
                </span>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="ml-4 text-sm text-slate-400 italic">Empty list</div>
    {/if}
  </div>
{:else if properties()}
  <div>
    <div class="space-y-4">
      {#each Object.entries(properties()?.properties ?? {}).filter(([propKey]) => {
        if (propKey === "image" && avatarImageDirect()) {
          return false;
        }
        return true;
      }) as [propKey, propValue]}
        {#if typeof propValue === "object" && propValue !== null && "type" in propValue}
          {#if propValue.type === "CoList"}
            <!-- CoList properties should be navigable, not expanded inline -->
            <PropertyItem
              {propKey}
              {propValue}
              onSelect={(coValue, fallbackKey) =>
                handleCoValueSelect(coValue, fallbackKey || propKey)}
            />
          {:else}
            <PropertyItem
              {propKey}
              {propValue}
              {coValue}
              node={node()}
              onSelect={(coValue, fallbackKey) =>
                handleCoValueSelect(coValue, fallbackKey || propKey)}
              onObjectSelect={onObjectNavigate
                ? (object, label, parentCoValue, parentKey) => {
                    onObjectNavigate(object, label, parentCoValue, parentKey);
                  }
                : undefined}
            />
          {/if}
        {:else}
          <PropertyItem
            {propKey}
            {propValue}
            {coValue}
            node={node()}
            onSelect={(coValue, fallbackKey) =>
              handleCoValueSelect(coValue, fallbackKey || propKey)}
            onObjectSelect={onObjectNavigate
              ? (object, label, parentCoValue, parentKey) => {
                  onObjectNavigate(object, label, parentCoValue, parentKey);
                }
              : undefined}
          />
        {/if}
      {/each}

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
          {coValue}
          node={node()}
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
