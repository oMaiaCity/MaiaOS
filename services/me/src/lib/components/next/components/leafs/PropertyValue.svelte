<script lang="ts">
  import { Image } from "jazz-tools/svelte";
  import Badge from "./Badge.svelte";
  import { getDisplayValue } from "../../utilities/propertyUtilities.js";
  import { formatCoValueId } from "../../utilities/coValueFormatter.js";
  
  // Component reference for recursive rendering (Svelte 5 - use component directly)
  import PropertyValueComponent from "./PropertyValue.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
    propKey: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedCoValue?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect?: (coValue: any, fallbackKey?: string) => void;
  }

  let { value, propKey, selectedCoValue, onSelect }: Props = $props();

  const displayInfo = $derived(getDisplayValue(value));
  const isSelected = $derived(
    selectedCoValue?.$jazz?.id === displayInfo.coValue?.$jazz?.id,
  );
</script>

{#if typeof value === "object" && value !== null && "type" in value}
  {#if value.type === "ImageDefinition"}
    {@const imageId = displayInfo.imageId || "unknown"}
    {@const isImageLoaded = displayInfo.showImagePreview}
    {#if isImageLoaded && imageId && imageId !== "unknown"}
      {#if value.coValue && onSelect}
        <button
          type="button"
          onclick={() => {
            if (value.coValue && onSelect) {
              onSelect(value.coValue, propKey);
            }
          }}
          class="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div class="w-8 h-8 rounded overflow-hidden border border-slate-300 shrink-0">
            <Image
              {imageId}
              width={32}
              height={32}
              alt={propKey}
              class="object-cover w-full h-full"
              loading="lazy"
            />
          </div>
          <Badge type="Image" variant="compact">Image</Badge>
          <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      {:else}
        <div class="flex items-center justify-end gap-2">
          <div class="w-8 h-8 rounded overflow-hidden border border-slate-300 shrink-0">
            <Image
              {imageId}
              width={32}
              height={32}
              alt={propKey}
              class="object-cover w-full h-full"
              loading="lazy"
            />
          </div>
          <Badge type="Image" variant="compact">Image</Badge>
        </div>
      {/if}
    {:else}
      <Badge type="loading" variant="compact">Loading...</Badge>
    {/if}
  {:else if value.type === "FileStream"}
    {#if value.isLoaded && value.coValue}
      {#if onSelect}
        <button
          type="button"
          onclick={() => {
            if (value.coValue && onSelect) {
              onSelect(value.coValue, propKey);
            }
          }}
          class="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Badge type="FileStream" variant="compact">FileStream</Badge>
          {#if value.mimeType && value.mimeType !== "unknown"}
            <span class="text-xs text-slate-600">{value.mimeType}</span>
          {/if}
          {#if value.size > 0}
            <span class="text-xs text-slate-500">({Math.round(value.size / 1024)}KB)</span>
          {/if}
          <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      {:else}
        <div class="inline-flex items-center gap-2">
          <Badge type="FileStream" variant="compact">FileStream</Badge>
          {#if value.mimeType && value.mimeType !== "unknown"}
            <span class="text-xs text-slate-600">{value.mimeType}</span>
          {/if}
          {#if value.size > 0}
            <span class="text-xs text-slate-500">({Math.round(value.size / 1024)}KB)</span>
          {/if}
        </div>
      {/if}
    {:else}
      <Badge type="loading" variant="compact">Loading...</Badge>
    {/if}
  {:else if value.type === "CoMap"}
    {#if value.coValue && onSelect}
      {@const isSelected = selectedCoValue?.$jazz?.id === value.coValue?.$jazz?.id}
      <button
        type="button"
        onclick={() => {
          if (value.coValue && onSelect) {
            onSelect(value.coValue, propKey);
          }
        }}
        class="w-full mt-2 text-left"
      >
        <div
          class="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-slate-100/90 border-2 transition-all cursor-pointer {isSelected
            ? 'border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
            : 'border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] hover:border-slate-300'}"
        >
          <div class="absolute inset-0 bg-linear-to-br from-white/60 via-white/20 to-transparent pointer-events-none"></div>
          <div class="relative p-4">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">{propKey}</span>
              <div class="flex items-center gap-2">
                <Badge type="CoMap" variant="compact">CoMap</Badge>
                <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
            {#if value.properties && Object.keys(value.properties).length > 0}
              <div
                class="bg-slate-200/50 rounded-xl p-3 border border-white shadow-[0_0_2px_rgba(0,0,0,0.01)] backdrop-blur-sm space-y-2"
              >
                {#each Object.entries(value.properties).slice(0, 3) as [nestedKey, nestedValue]}
                  <div
                    class="flex justify-between items-center pt-2 border-t border-white/50 first:pt-0 first:border-t-0"
                  >
                    <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">{nestedKey}</span>
                    <div class="flex-1 text-right ml-4 min-w-0">
                      <PropertyValueRecursive
                        value={nestedValue}
                        propKey={nestedKey}
                        {selectedCoValue}
                        onSelect={undefined}
                      />
                    </div>
                  </div>
                {/each}
                {#if Object.keys(value.properties).length > 3}
                  <div class="text-xs text-slate-400 italic text-center pt-1">
                    +{Object.keys(value.properties).length - 3} more
                  </div>
                {/if}
              </div>
            {:else}
              <p class="text-xs text-slate-400 italic">(empty)</p>
            {/if}
          </div>
        </div>
      </button>
    {:else}
      <div class="space-y-2 mt-1">
        <div class="flex items-center gap-2">
          <Badge type="CoMap" variant="compact">CoMap</Badge>
          {#if value.id}
            <span class="font-mono text-xs text-slate-400">({formatCoValueId(value.id, 8)})</span>
          {/if}
        </div>
      </div>
    {/if}
  {:else if value.type === "CoList"}
    {#if value.coValue && onSelect}
      <button
        type="button"
        onclick={() => {
          if (value.coValue && onSelect) {
            onSelect(value.coValue, propKey);
          }
        }}
        class="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <Badge type="CoList">CoList</Badge>
        <span>({value.length} items)</span>
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    {:else}
      <Badge type="CoList" variant="compact">CoList</Badge>
      <span class="ml-2 text-slate-500">({value.length} items)</span>
    {/if}
  {:else if value.type === "CoValue"}
    {#if value.coValue && onSelect}
      <button
        type="button"
        onclick={() => {
          if (value.coValue && onSelect) {
            onSelect(value.coValue, propKey);
          }
        }}
        class="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <Badge type="CoValue" variant="compact">CoValue</Badge>
        <span class="font-mono">({formatCoValueId(value.id, 8)})</span>
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    {:else}
      <Badge type="CoValue" variant="compact">CoValue</Badge>
      <span class="ml-2 font-mono text-xs text-slate-400">({formatCoValueId(value.id, 8)})</span>
    {/if}
  {:else}
    <span class="text-xs text-slate-600 break-all break-words">{JSON.stringify(value)}</span>
  {/if}
{:else if typeof value === "string"}
  <div class="flex items-center gap-2 justify-end">
    <span class="text-xs text-slate-600 break-all break-words">{value || "(empty)"}</span>
    <Badge type="string">{typeof value === "string" ? "string" : typeof value}</Badge>
  </div>
{:else if typeof value === "number"}
  <div class="flex items-center gap-2 justify-end">
    <span class="text-xs text-slate-600 break-all break-words">{String(value)}</span>
    <Badge type="number">number</Badge>
  </div>
{:else if typeof value === "boolean"}
  <div class="flex items-center gap-2 justify-end">
    <span class="text-xs text-slate-600 break-all break-words">{String(value)}</span>
    <Badge type="boolean">boolean</Badge>
  </div>
{:else}
  <div class="flex items-center gap-2 justify-end">
    <span class="text-xs text-slate-600 break-all break-words">{JSON.stringify(value)}</span>
    <Badge type={typeof value}>{typeof value}</Badge>
  </div>
{/if}

