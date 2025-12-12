<script lang="ts">
  import type { CoID, JsonValue, RawCoValue } from "cojson";
  import Badge from "./Badge.svelte";

  interface Props {
    json: JsonValue | undefined;
    onCoIDClick?: (coId: CoID<RawCoValue>) => void;
    compact?: boolean;
  }

  let { json, onCoIDClick, compact = false }: Props = $props();

  let isExpanded = $state(false);

  function isCoId(value: any): value is string {
    return typeof value === "string" && value.startsWith("co_");
  }
</script>

{#if typeof json === "undefined" || json === undefined}
  <span class="text-sm text-slate-400">undefined</span>
{:else if json === null}
  <span class="text-sm text-slate-400">null</span>
{:else if typeof json === "string" && isCoId(json)}
  {#if onCoIDClick}
    <button
      type="button"
      class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline"
      onclick={() => onCoIDClick(json as CoID)}
    >
      {json}
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    </button>
  {:else}
    <span class="inline-flex items-center gap-1 text-sm">{json}</span>
  {/if}
{:else if typeof json === "string"}
  <span class="text-sm">{json}</span>
{:else if typeof json === "number"}
  <span class="text-sm font-mono">{json}</span>
{:else if typeof json === "boolean"}
  <span class="text-sm font-mono {json ? 'text-green-600' : 'text-red-600'}">
    {json.toString()}
  </span>
{:else if typeof json === "object" && json !== null}
  {@const longJson = JSON.stringify(json, null, 2)}
  {@const shortJson = longJson
    .split("\n")
    .slice(0, compact ? 3 : 8)
    .join("\n")}
  {@const hasDifference = longJson !== shortJson}
  <div>
    <p class="text-sm">
      {Array.isArray(json) ? `Array (${json.length})` : "Object"}
    </p>
    <pre class="mt-1.5 text-xs whitespace-pre-wrap">{isExpanded
        ? longJson
        : shortJson}{hasDifference && !isExpanded ? "\n ..." : ""}</pre>
    {#if !compact && hasDifference}
      <button
        type="button"
        class="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
        onclick={() => (isExpanded = !isExpanded)}
      >
        {isExpanded ? "Show less" : "Show more"}
      </button>
    {/if}
  </div>
{:else}
  <span class="text-sm">{String(json)}</span>
{/if}






