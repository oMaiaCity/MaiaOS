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

  // Derive entries array for table view
  const entries = $derived(Object.entries(properties));

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
    <div class="flex items-center gap-3 mb-2">
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
      <h2 class="text-lg font-semibold text-slate-700">
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
      <!-- Table View -->
      <div class="overflow-x-auto border border-slate-300 rounded-lg">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-slate-100 border-b border-slate-300">
              <th
                class="text-left p-3 text-xs font-semibold text-slate-700 uppercase tracking-wide"
              >
                Property
              </th>
              <th
                class="text-left p-3 text-xs font-semibold text-slate-700 uppercase tracking-wide"
              >
                Type
              </th>
              <th
                class="text-left p-3 text-xs font-semibold text-slate-700 uppercase tracking-wide"
              >
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {#each entries as [key, value]}
              {#if typeof value === "string" && value.startsWith("co_")}
                {@const child = context.directChildren.find(
                  (c) => c.key === key,
                )}
                <tr
                  class="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <td class="p-3 text-sm font-medium text-slate-700 font-mono"
                    >{key}</td
                  >
                  <td class="p-3">
                    {#if child?.resolved}
                      <Badge
                        type={child.resolved.extendedType ||
                          child.resolved.type ||
                          "CoValue"}
                      >
                        {child.resolved.extendedType ||
                          child.resolved.type ||
                          "CoValue"}
                      </Badge>
                    {:else}
                      <Badge type="CoValue">CoValue</Badge>
                    {/if}
                  </td>
                  <td class="p-3">
                    {#if onNavigate}
                      <button
                        type="button"
                        onclick={() => onNavigate(value as string, key)}
                        class="text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {value}
                      </button>
                    {:else}
                      <span class="text-xs font-mono text-slate-600"
                        >{value}</span
                      >
                    {/if}
                  </td>
                </tr>
              {:else}
                <tr
                  class="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <td class="p-3 text-sm font-medium text-slate-700 font-mono"
                    >{key}</td
                  >
                  <td class="p-3">
                    <Badge type={typeof value}>{typeof value}</Badge>
                  </td>
                  <td class="p-3">
                    <span class="text-xs text-slate-600 font-mono break-all">
                      {typeof value === "object" && value !== null
                        ? JSON.stringify(value).slice(0, 100) +
                          (JSON.stringify(value).length > 100 ? "..." : "")
                        : String(value).slice(0, 100)}
                    </span>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
