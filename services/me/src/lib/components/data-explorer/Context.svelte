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
      <!-- Table View - styled like list items -->
      <div class="space-y-3">
        {#each entries as [key, value]}
          {@const isCoID = typeof value === "string" && value.startsWith("co_")}
          {@const child = isCoID ? context.directChildren.find((c) => c.key === key) : null}
          {@const isClickable = isCoID && onNavigate !== undefined}
          {#if isClickable}
            <button
              type="button"
              class="w-full text-left bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm cursor-pointer hover:border-slate-300"
              onclick={() => {
                if (typeof value === "string" && onNavigate) {
                  onNavigate(value, key);
                }
              }}
            >
              <div class="flex justify-between items-center gap-2">
                <!-- Left side: Prop Key -->
                <div class="flex items-center gap-1.5 flex-shrink-0 min-w-0">
                  <span
                    class="text-xs font-medium text-slate-500 uppercase tracking-wide truncate"
                    >{key}</span
                  >
                </div>

                <!-- Right side: Type Badge and Value -->
                <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
                  {#if isCoID}
                    <div class="inline-flex items-center gap-2 text-left min-w-0">
                      <span class="text-xs font-mono text-slate-600 hover:underline"
                        >{value}</span
                      >
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
                    </div>
                  {:else}
                    <span class="text-xs text-slate-600 break-all min-w-0">
                      {typeof value === "object" &&
                      value !== null &&
                      !Array.isArray(value)
                        ? JSON.stringify(value).slice(0, 50) +
                          (JSON.stringify(value).length > 50 ? "..." : "")
                        : Array.isArray(value)
                          ? `[${value.length} items]`
                          : String(value).slice(0, 50)}
                    </span>
                  {/if}

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
                  {:else}
                    <Badge type={typeof value}>{typeof value}</Badge>
                  {/if}
                </div>
              </div>
            </button>
          {:else}
            <div
              class="w-full bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
            >
              <div class="flex justify-between items-center gap-2">
                <!-- Left side: Prop Key -->
                <div class="flex items-center gap-1.5 flex-shrink-0 min-w-0">
                  <span
                    class="text-xs font-medium text-slate-500 uppercase tracking-wide truncate"
                    >{key}</span
                  >
                </div>

                <!-- Right side: Type Badge and Value -->
                <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
                  {#if isCoID}
                    <div class="inline-flex items-center gap-2 text-left min-w-0">
                      <span class="text-xs font-mono text-slate-600"
                        >{value}</span
                      >
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
                    </div>
                  {:else}
                    <span class="text-xs text-slate-600 break-all min-w-0">
                      {typeof value === "object" &&
                      value !== null &&
                      !Array.isArray(value)
                        ? JSON.stringify(value).slice(0, 50) +
                          (JSON.stringify(value).length > 50 ? "..." : "")
                        : Array.isArray(value)
                          ? `[${value.length} items]`
                          : String(value).slice(0, 50)}
                    </span>
                  {/if}

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
                  {:else}
                    <Badge type={typeof value}>{typeof value}</Badge>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>
