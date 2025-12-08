<!--
  Leaf Component
  Renders leaf nodes (content nodes) with dataPath, type, config, events
  Uses Composite/Leaf pattern - leaf nodes cannot have children
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import { HOVERABLE_STYLE } from "$lib/utils/styles";
  import type { ViewNode } from "./types";
  import type { Data } from "../dataStore";
  import { resolveDataPath } from "./resolver";

  interface Props {
    node: ViewNode;
    data: Data;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  let { node, data, onEvent }: Props = $props();

  if (!node.dataPath) {
    throw new Error("Leaf component requires a node with dataPath property");
  }

  // Resolve data value - ensure reactivity by accessing data properties
  const value = $derived.by(() => {
    // Access data to ensure reactivity tracking
    const currentData = data;
    if (!node.dataPath) return undefined;
    return resolveDataPath(currentData, node.dataPath);
  });
  const slotType = $derived(node.type || inferSlotType(node.slot, value));
  const isLoading = $derived((data.isLoading as boolean) || false);
  const viewMode = $derived((data.viewMode as string) || "list");

  // Drag and drop state (for kanban board)
  let draggedItem = $state<Record<string, unknown> | null>(null);
  let draggedOverColumn = $state<string | null>(null);

  function handleDragStart(item: Record<string, unknown>, event: DragEvent) {
    draggedItem = item;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(item.id || ""));
    }
  }

  function handleDragOver(columnStatus: string | undefined, event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    draggedOverColumn = columnStatus || null;
  }

  function handleDragLeave() {
    draggedOverColumn = null;
  }

  function handleDrop(columnStatus: string | undefined, event: DragEvent) {
    event.preventDefault();
    draggedOverColumn = null;

    if (draggedItem && columnStatus && node.events?.onDrop) {
      const eventConfig = node.events.onDrop;
      const eventName = typeof eventConfig === "string" ? eventConfig : eventConfig.event;
      const payload =
        typeof eventConfig === "string"
          ? { todoId: draggedItem.id, status: columnStatus }
          : eventConfig.payload
            ? eventConfig.payload({ ...draggedItem, status: columnStatus })
            : { todoId: draggedItem.id, status: columnStatus };
      onEvent?.(eventName, payload);
    }
    draggedItem = null;
  }

  function triggerEvent(
    interaction:
      | "onSubmit"
      | "onInput"
      | "onChange"
      | "onClick"
      | "onToggle"
      | "onDelete"
      | "onClear"
      | "onDrop",
    itemData?: Record<string, unknown>,
    additionalPayload?: Record<string, unknown>,
  ) {
    const eventConfig = node.events?.[interaction];
    if (!eventConfig) return;

    let eventName: string;
    let payload: unknown = undefined;

    if (typeof eventConfig === "string") {
      eventName = eventConfig;
      if (interaction === "onSubmit" || interaction === "onInput") {
        payload = { text: String(value || ""), ...additionalPayload };
      } else if (interaction === "onToggle" || interaction === "onDelete") {
        payload = { todoId: itemData?.id, ...additionalPayload };
      } else {
        payload = additionalPayload;
      }
    } else {
      eventName = eventConfig.event;
      if (eventConfig.payload) {
        payload = eventConfig.payload(itemData || {});
      } else {
        if (interaction === "onSubmit" || interaction === "onInput") {
          payload = { text: String(value || ""), ...additionalPayload };
        } else if (interaction === "onToggle" || interaction === "onDelete") {
          payload = { todoId: itemData?.id, ...additionalPayload };
        } else {
          payload = additionalPayload;
        }
      }
    }

    onEvent?.(eventName, payload);
  }

  function inferSlotType(slotId: string, val: unknown): string {
    if (Array.isArray(val)) return "list";
    if (typeof val === "string" || typeof val === "number") return "text";
    if (slotId.includes("input")) return "input";
    if (slotId.includes("button")) return "button";
    return "text";
  }

  // Reactive list items - updates when value changes
  const listItems = $derived.by((): Array<Record<string, unknown>> => {
    if (!Array.isArray(value)) return [];
    return value.map((item, index) => ({
      ...(typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {}),
      _index: index,
    }));
  });
</script>

{#if !browser}
  <!-- SSR fallback -->
  <div class="text-slate-600">Loading...</div>
{:else if slotType === "text" && node.slot === "title"}
  <div class="text-center mb-4">
    <h1 class="text-3xl font-bold text-slate-900 mb-2">{String(value || "")}</h1>
  </div>
{:else if slotType === "text" && node.slot === "description"}
  <div class="text-center mb-4">
    <p class="text-slate-600">{String(value || "")}</p>
  </div>
{:else if slotType === "button" && node.slot === "viewToggle"}
  {@const currentView = String(value || "list")}
  {@const label = node.config?.label as string | undefined}
  {@const options = node.config?.options as { list?: string; kanban?: string } | undefined}
  <div class="flex justify-center mb-4">
    <button
      type="button"
      onclick={() => triggerEvent("onClick")}
      class="px-4 py-2 rounded-full bg-[#001a42] border border-[#001a42] text-[#e6ecf7] shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-sm"
    >
      {label ||
        (currentView === "list"
          ? options?.kanban || "Switch View"
          : options?.list || "Switch View")}
    </button>
  </div>
{:else if slotType === "input" && node.slot === "input.value"}
  {@const listSlotId = node.config?.listSlotId as string | undefined}
  {@const listDataPath = listSlotId ? `data.todos` : "data.todos"}
  {@const listData = resolveDataPath(data, listDataPath) as Array | null}
  {@const hasListItems = listData && Array.isArray(listData) && listData.length > 0}
  {@const clearSlotId = node.config?.clearSlotId as string | undefined}
  <form
    onsubmit={(e) => {
      e.preventDefault();
      const text = String(value || "");
      if (text.trim()) {
        triggerEvent("onSubmit");
        onEvent?.("SUCCESS");
      }
    }}
    class="mb-4 flex gap-2 items-center"
  >
    <input
      type={String(node.config?.inputType || "text")}
      value={String(value || "")}
      placeholder={String(node.config?.placeholder || node.config?.label || "Enter value...")}
      oninput={(e) => {
        triggerEvent("onInput", undefined, { text: e.currentTarget.value });
      }}
      class="flex-1 px-4 py-2 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-300 transition-all text-slate-900 placeholder:text-slate-400"
    />
    <button
      type="submit"
      disabled={isLoading}
      class="px-4 py-2 bg-[#001a42] border border-[#001a42] text-[#e6ecf7] rounded-full shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isLoading
        ? (node.config?.loadingLabel as string) || "Submitting..."
        : String(node.config?.submitLabel || node.config?.label || "Submit")}
    </button>
    {#if hasListItems && clearSlotId}
      <button
        type="button"
        onclick={() => onEvent?.("CLEAR_TODOS")}
        class="w-8 h-8 rounded-full bg-red-500 border border-red-500 text-white shadow-button-primary hover:bg-red-600 hover:border-red-600 hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center shrink-0"
        aria-label="Clear todos"
        title="Clear todos"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    {/if}
  </form>
{:else if slotType === "text" && node.slot === "error"}
  {#if value}
    <div
      class="mb-4 px-4 py-3 rounded-2xl bg-linear-to-r from-red-50 to-red-100/50 border border-red-200/60 shadow-[0_2px_8px_rgba(239,68,68,0.1)] text-red-800 text-sm flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div class="flex items-center gap-2 flex-1">
        <svg
          class="w-5 h-5 text-red-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span class="font-medium">{String(value)}</span>
      </div>
    </div>
  {/if}
{:else if slotType === "list" && node.slot === "list"}
  {@const textProperty = (node.config?.textProperty as string) || "text"}
  {@const statusProperty = (node.config?.statusProperty as string) || "status"}
  {@const deleteLabel = (node.config?.deleteLabel as string) || "Delete"}
  {@const kanbanColumns = (node.config?.kanbanColumns as Array) || undefined}

  {#if viewMode === "kanban"}
    <!-- Kanban Board View -->
    {#if kanbanColumns && kanbanColumns.length > 0}
      {@const columns = kanbanColumns}
      {@const gridColsClass =
        columns.length === 2
          ? "grid-cols-2"
          : columns.length === 3
            ? "grid-cols-3"
            : columns.length === 4
              ? "grid-cols-4"
              : "grid-cols-1"}
      <div class={`grid ${gridColsClass} gap-4 h-full`}>
        {#each columns as column}
          {@const columnStatus = column.status as string}
          <div
            role="region"
            aria-label={`${column.label} column`}
            class="bg-slate-100 rounded-2xl p-4 transition-colors {draggedOverColumn ===
            columnStatus
              ? 'bg-slate-200 ring-2 ring-[#001a42]'
              : ''}"
            ondragover={(e) => handleDragOver(columnStatus, e)}
            ondrop={(e) => handleDrop(columnStatus, e)}
            ondragleave={handleDragLeave}
          >
            <h3 class="text-sm font-semibold text-slate-700 mb-3 uppercase">{column.label}</h3>
            <div class="space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
              {#each listItems as item (item.id || item._index)}
                {#if column.filter(item as Record)}
                  <div
                    role="button"
                    tabindex="0"
                    aria-label={`Drag ${String(item[textProperty] || "")}`}
                    class="px-3 py-2 rounded-xl bg-white border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE} cursor-move"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(item as Record, e)}
                    ondragend={() => {
                      draggedItem = null;
                    }}
                  >
                    <div class="flex items-start gap-2">
                      <span
                        class="flex-1 text-sm {String(item[statusProperty]) === 'done'
                          ? 'text-slate-500 line-through'
                          : 'text-slate-700 font-medium'}"
                      >
                        {String(item[textProperty] || "")}
                      </span>
                      {#if node.events?.onDelete}
                        <button
                          type="button"
                          onclick={() => {
                            triggerEvent("onDelete", item as Record);
                          }}
                          class="px-1 py-1 text-xs text-slate-500 hover:text-slate-700"
                          aria-label={deleteLabel}
                        >
                          ✕
                        </button>
                      {/if}
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      {@const emptyStateMessage =
        (node.config?.emptyStateMessage as string) ||
        (node.config?.kanbanEmptyMessage as string) ||
        "Kanban view requires kanbanColumns configuration"}
      <div class="text-center text-slate-500 py-8">
        {emptyStateMessage}
      </div>
    {/if}
  {:else}
    <!-- List View -->
    <ul class="space-y-2 min-h-[100px]">
      {#each listItems as item (item.id || item._index)}
        <li
          class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE}"
        >
          {#if node.events?.onToggle}
            <button
              type="button"
              onclick={() => {
                triggerEvent("onToggle", item as Record);
              }}
              class="w-6 h-6 rounded-full border-2 border-slate-300 bg-slate-100 flex items-center justify-center transition-all duration-200 hover:border-slate-400 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-[#001a42] focus:ring-offset-1 cursor-pointer {item[
                statusProperty
              ] === 'done'
                ? 'bg-slate-300 border-slate-400'
                : ''}"
              aria-label={item[statusProperty] === "done"
                ? "Mark as incomplete"
                : "Mark as complete"}
            >
              {#if item[statusProperty] === "done"}
                <svg
                  class="w-4 h-4 text-slate-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="3"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              {/if}
            </button>
          {/if}
          <span
            class="flex-1 text-sm {String(item[statusProperty]) === 'done'
              ? 'line-through text-slate-500'
              : 'text-slate-700 font-medium'}"
          >
            {String(item[textProperty] || "")}
          </span>
          {#if node.config?.statusBadge !== undefined}
            {@const currentStatus = String(item[statusProperty] || "todo")}
            {@const statusBadgeConfig = node.config?.statusBadge as Record | undefined}
            {@const badgeLabel = statusBadgeConfig?.[currentStatus]?.label || currentStatus}
            {@const badgeColor =
              statusBadgeConfig?.[currentStatus]?.color ||
              (currentStatus === "done"
                ? "bg-green-100 text-green-700"
                : currentStatus === "in-progress"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-700")}
            <span class="px-2 py-0.5 text-xs font-medium rounded-full {badgeColor}">
              {badgeLabel}
            </span>
          {:else}
            {@const currentStatus = String(item[statusProperty] || "todo")}
            {@const badgeColor =
              currentStatus === "done"
                ? "bg-green-100 text-green-700"
                : currentStatus === "in-progress"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-700"}
            <span class="px-2 py-0.5 text-xs font-medium rounded-full {badgeColor}">
              {currentStatus}
            </span>
          {/if}
          {#if node.events?.onDelete}
            <button
              type="button"
              onclick={() => {
                triggerEvent("onDelete", item as Record);
              }}
              class="px-2 py-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all duration-200 w-6 h-6 flex items-center justify-center"
              aria-label={deleteLabel}
            >
              ✕
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{:else}
  <!-- Default: render as string -->
  {String(value || "")}
{/if}
