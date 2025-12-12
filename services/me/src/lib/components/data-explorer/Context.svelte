<script lang="ts">
  import type { CoValueContext } from "@hominio/data";
  import type { LocalNode } from "cojson";
  import Badge from "./Badge.svelte";
  import ListView from "./ListView.svelte";

  interface Props {
    context: CoValueContext;
    node?: LocalNode;
    onNavigate?: (coValueId: string, label?: string) => void;
    onObjectNavigate?: (
      object: any,
      label: string,
      parentCoValue: any,
      parentKey: string,
    ) => void;
    onBack?: () => void;
    view?: "list" | "table" | "grid";
  }

  const {
    context,
    node,
    onNavigate,
    onObjectNavigate,
    onBack,
    view = "list",
  }: Props = $props();

  const displayType = $derived(
    context.resolved.extendedType || context.resolved.type || "CoValue",
  );

  // Derive snapshot and properties (fixes @const error)
  const snapshot = $derived(context.resolved.snapshot);
  const properties = $derived(
    snapshot &&
      typeof snapshot === "object" &&
      snapshot !== null &&
      snapshot !== "unavailable"
      ? snapshot
      : {},
  );

  // Filter out @label and @schema from main view (they're shown in metadata sidebar)
  const entries = $derived(
    Object.entries(properties).filter(([key]) => key !== '@label' && key !== '@schema'),
  );

  // Initialize with default, then sync with prop
  let currentView = $state<"list" | "table">("list");

  // Sync view prop changes reactively
  $effect(() => {
    const viewValue = view;
    if (viewValue === "list" || viewValue === "table") {
      currentView = viewValue;
    }
  });
</script>

<div class="w-full">
  <!-- Header -->
  <div class="mb-6">
    <div class="flex items-center gap-3">
      {#if onBack}
        <button
          type="button"
          onclick={onBack}
          class="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          aria-label="Back"
        >
          <svg
            class="w-5 h-5 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      {/if}
      <h2 class="text-lg font-semibold text-slate-700 m-0">
        {context.coValueId.slice(0, 12)}...
      </h2>
      <Badge type={displayType}>{displayType}</Badge>
    </div>
  </div>

  <!-- View Switcher Tabs (outside card, attached to top with less rounded corners like listitems) -->
  <div class="flex items-end gap-1 mb-0 -mb-px relative z-10 pl-4">
    <button
      type="button"
      onclick={() => (currentView = "list")}
      class="text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-t-lg transition-colors border border-b-0 {currentView ===
      'list'
        ? 'bg-[var(--color-card-bg)] border-[var(--color-card-border)] text-slate-700'
        : 'bg-slate-200 border-transparent text-slate-500 hover:bg-slate-300'}"
      style="border-bottom: none;"
    >
      List
    </button>
    <button
      type="button"
      onclick={() => (currentView = "table")}
      class="text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-t-lg transition-colors border border-b-0 {currentView ===
      'table'
        ? 'bg-[var(--color-card-bg)] border-[var(--color-card-border)] text-slate-700'
        : 'bg-slate-200 border-transparent text-slate-500 hover:bg-slate-300'}"
      style="border-bottom: none;"
    >
      Table
    </button>
  </div>

  <!-- Glass Card Container (matches legacy Card component) -->
  <div class="card p-6">
    <!-- Content Views -->
    {#if currentView === "list"}
      <ListView
        {properties}
        {node}
        directChildren={context.directChildren}
        {onNavigate}
        {onObjectNavigate}
        parentCoValue={context.resolved.snapshot}
      />
    {:else if currentView === "table"}
      <!-- Table View - proper table layout with list item styling -->
      <div class="space-y-3">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th
                class="text-left p-0 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                Property
              </th>
              <th
                class="text-left p-0 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                Type
              </th>
              <th
                class="text-left p-0 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {#each entries as [key, value]}
              {@const isComputedField = key.startsWith("@")}
              {@const isCoID =
                !isComputedField &&
                typeof value === "string" &&
                value.startsWith("co_")}
              {@const isObject =
                !isComputedField &&
                !isCoID &&
                typeof value === "object" &&
                value !== null &&
                !Array.isArray(value) &&
                onObjectNavigate !== undefined}
              {@const child = isCoID
                ? context.directChildren.find((c) => c.key === key)
                : null}
              {@const isClickable = (isCoID && onNavigate !== undefined) || isObject}
              {@const isCoList = child?.resolved?.type === 'colist' || child?.resolved?.extendedType === 'CoList'}
              <tr>
                <td class="p-0 pb-3 pr-3">
                  <span
                    class="text-xs font-medium text-slate-500 uppercase tracking-wide"
                    >{key}</span
                  >
                </td>
                <td class="p-0 pb-3 pr-3">
                  {#if isCoID && child?.resolved}
                    <Badge
                      type={child.resolved.extendedType ||
                        child.resolved.type ||
                        "CoValue"}
                    >
                      {child.resolved.extendedType ||
                        child.resolved.type ||
                        "CoValue"}
                    </Badge>
                  {:else if isCoID}
                    <Badge type="CoValue">CoValue</Badge>
                  {:else if isObject}
                    <Badge type="object">Object</Badge>
                  {:else}
                    <Badge type={typeof value}>{typeof value}</Badge>
                  {/if}
                </td>
                <td class="p-0 pb-3">
                  {#if isClickable}
                    <button
                      type="button"
                      class="w-full text-left bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm cursor-pointer hover:border-slate-300"
                      onclick={() => {
                        if (isCoID && typeof value === "string" && onNavigate) {
                          onNavigate(value, key);
                        } else if (isObject && onObjectNavigate) {
                          onObjectNavigate(value, key, context.resolved.snapshot, key);
                        }
                      }}
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        {#if isCoID}
                          {#if !isCoList}
                            {@const displayLabel = child?.resolved?.snapshot && typeof child.resolved.snapshot === 'object' && '@label' in child.resolved.snapshot && child.resolved.snapshot['@label'] ? child.resolved.snapshot['@label'] : value}
                            <span
                              class="text-xs font-mono text-slate-600 hover:underline"
                              >{displayLabel}</span
                            >
                          {/if}
                          <svg
                            class="w-3 h-3 text-slate-400 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        {:else if isObject}
                          <!-- Object: just arrow, no preview -->
                          <svg
                            class="w-3 h-3 text-slate-400 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        {:else}
                          <span
                            class="text-xs text-slate-600 break-all min-w-0"
                          >
                            {Array.isArray(value)
                              ? `[${value.length} items]`
                              : String(value).slice(0, 50)}
                          </span>
                        {/if}
                      </div>
                    </button>
                  {:else}
                    <div
                      class="w-full bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        {#if isCoID}
                          {#if !isCoList}
                            {@const displayLabel = child?.resolved?.snapshot && typeof child.resolved.snapshot === 'object' && '@label' in child.resolved.snapshot && child.resolved.snapshot['@label'] ? child.resolved.snapshot['@label'] : value}
                            <span class="text-xs font-mono text-slate-600"
                              >{displayLabel}</span
                            >
                          {/if}
                          <svg
                            class="w-3 h-3 text-slate-400 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        {:else if isObject}
                          <!-- Object: just arrow, no preview -->
                          <svg
                            class="w-3 h-3 text-slate-400 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        {:else}
                          <span
                            class="text-xs text-slate-600 break-all min-w-0"
                          >
                            {Array.isArray(value)
                              ? `[${value.length} items]`
                              : String(value).slice(0, 50)}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
