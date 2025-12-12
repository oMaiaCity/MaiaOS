<script lang="ts">
  import type { CoID, LocalNode, RawCoValue } from "cojson";
  import { useResolvedCoValue } from "../../utilities/useResolvedCoValue.js";
  import ValueRenderer from "./ValueRenderer.svelte";
  import Badge from "./Badge.svelte";

  interface Props {
    coId: CoID<RawCoValue> | string;
    node: LocalNode | undefined;
    limit?: number;
  }

  let { coId, node, limit = 6 }: Props = $props();

  // Create store reactively - recreate when props change
  const resolvedStore = $derived.by(() => useResolvedCoValue(coId, node));
  const resolved = $derived($resolvedStore);

  function isBrowserImage(snapshot: any): boolean {
    return (
      snapshot &&
      typeof snapshot === "object" &&
      "originalSize" in snapshot &&
      "placeholderDataURL" in snapshot
    );
  }
</script>

{#if !resolved.snapshot}
  <div class="rounded bg-slate-200 animate-pulse whitespace-pre w-24 h-4">
    {" "}
  </div>
{:else if resolved.snapshot === "unavailable" && !resolved.value}
  <span class="text-sm text-slate-400">Unavailable</span>
{:else if resolved.type === "coplaintext"}
  <span class="text-sm">{resolved.value?.toString()}</span>
{:else if resolved.extendedType === "image" && isBrowserImage(resolved.snapshot)}
  {@const snapshot = resolved.snapshot as any}
  <div class="flex flex-col items-start">
    <img
      src={snapshot.placeholderDataURL}
      alt="Preview"
      class="w-8 h-8 border-2 border-white shadow-sm my-2"
    />
    <span class="text-xs text-slate-500">
      {snapshot.originalSize?.[0]} x {snapshot.originalSize?.[1]}
    </span>
  </div>
{:else if resolved.extendedType === "record"}
  <div class="flex items-center gap-1 text-sm">
    Record
    <span class="text-slate-500">
      ({Object.keys(resolved.snapshot).length})
    </span>
  </div>
{:else if resolved.type === "colist"}
  <div class="flex items-center gap-1 text-sm">
    List
    <span class="text-slate-500">
      ({(resolved.snapshot as unknown as []).length})
    </span>
  </div>
{:else}
  {@const properties = Object.entries(resolved.snapshot)}
  {@const limitedProperties =
    resolved.extendedType === "account"
      ? properties
          .filter(
            ([key]) => !key.startsWith("key_z") && !key.startsWith("sealer_z") && key !== "readKey",
          )
          .slice(0, limit)
      : properties.slice(0, limit)}
  <div class="flex flex-col gap-2 text-sm">
    <div class="grid grid-cols-[auto_1fr] gap-2">
      {#each limitedProperties as [key, value]}
        <span class="font-semibold">{key}:</span>
        <ValueRenderer compact json={value} />
      {/each}
    </div>
    {#if properties.length > limit}
      <span class="text-xs text-slate-500 mt-2">
        {properties.length - limit} more
      </span>
    {/if}
  </div>
{/if}






