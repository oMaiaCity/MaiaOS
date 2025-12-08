<!--
  Slot Content Component
  Renders slot content for use in LayoutEngine
  Handles all slot types: title, description, input, list, error, etc.
-->
<script lang="ts">
  import { HOVERABLE_STYLE } from "$lib/utils/styles";
  import type { ResolvedUISlot } from "../ui-slots/types";

  interface Props {
    slotId: string;
    resolvedSlots: ResolvedUISlot[];
    renderSlot: (slotId: string) => unknown;
    getSlotValue: (slotId: string) => unknown;
    getSlotMapping: (
      slotId: string,
    ) => { events?: Record<string, unknown>; config?: Record<string, unknown> } | undefined;
    triggerEvent: (
      slotId: string,
      interaction: string,
      itemData?: Record<string, unknown>,
      additionalPayload?: Record<string, unknown>,
    ) => void;
    getListItems: (listSlotId: string) => Array<Record<string, unknown>>;
    isLoading: boolean;
    viewMode: string;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  let {
    slotId,
    resolvedSlots,
    renderSlot,
    getSlotValue,
    getSlotMapping,
    triggerEvent,
    getListItems,
    isLoading,
    viewMode,
    onEvent,
  }: Props = $props();

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

    if (draggedItem && columnStatus) {
      triggerEvent("list.item.id", "onDrop", draggedItem, { status: columnStatus });
    }
    draggedItem = null;
  }
</script>

{#if slotId === "title"}
  <div class="text-center mb-4">
    <h1 class="text-3xl font-bold text-slate-900 mb-2">{String(renderSlot(slotId))}</h1>
  </div>
{:else if slotId === "description"}
  <div class="text-center mb-4">
    <p class="text-slate-600">{String(renderSlot(slotId))}</p>
  </div>
{:else if slotId === "viewToggle"}
  {@const currentView = getSlotValue(slotId) as string}
  {@const viewToggleMapping = getSlotMapping(slotId)}
  {@const label = viewToggleMapping?.config?.label as string | undefined}
  {@const options = viewToggleMapping?.config?.options as
    | { list?: string; kanban?: string }
    | undefined}
  <div class="flex justify-center mb-4">
    <button
      type="button"
      onclick={() => {
        triggerEvent("viewToggle", "onClick");
      }}
      class="px-4 py-2 rounded-full bg-[#001a42] border border-[#001a42] text-[#e6ecf7] shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-sm"
    >
      {label ||
        (currentView === "list"
          ? options?.kanban || "Switch View"
          : options?.list || "Switch View")}
    </button>
  </div>
{:else if slotId === "input.value"}
  {@const inputData = renderSlot(slotId) as Record}
  {@const inputMapping = getSlotMapping(slotId)}
  {@const listSlotId = inputMapping?.config?.listSlotId as string | undefined}
  {@const listData = listSlotId ? (getSlotValue(listSlotId) as Array) : null}
  {@const hasListItems = listData && Array.isArray(listData) && listData.length > 0}
  {@const clearSlotId = inputMapping?.config?.clearSlotId as string | undefined}
  <form
    onsubmit={(e) => {
      e.preventDefault();
      const text = String(inputData.value || "");
      if (text.trim()) {
        triggerEvent("input.value", "onSubmit");
        onEvent?.("SUCCESS");
      }
    }}
    class="mb-4 flex gap-2 items-center"
  >
    <input
      type={String(inputData.type || inputMapping?.config?.inputType || "text")}
      value={String(inputData.value || "")}
      placeholder={String(
        inputMapping?.config?.placeholder || inputMapping?.config?.label || "Enter value...",
      )}
      oninput={(e) => {
        triggerEvent("input.value", "onInput", undefined, { text: e.currentTarget.value });
      }}
      class="flex-1 px-4 py-2 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-300 transition-all text-slate-900 placeholder:text-slate-400"
    />
    <button
      type="submit"
      disabled={isLoading}
      class="px-4 py-2 bg-[#001a42] border border-[#001a42] text-[#e6ecf7] rounded-full shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isLoading
        ? (inputMapping?.config?.loadingLabel as string) || "Submitting..."
        : String(inputMapping?.config?.submitLabel || inputMapping?.config?.label || "Submit")}
    </button>
    {#if hasListItems && clearSlotId}
      {@const clearMapping = getSlotMapping(clearSlotId)}
      <button
        type="button"
        onclick={() => triggerEvent(clearSlotId, "onClick")}
        class="w-8 h-8 rounded-full bg-red-500 border border-red-500 text-white shadow-button-primary hover:bg-red-600 hover:border-red-600 hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center flex-shrink-0"
        aria-label={(clearMapping?.config?.label as string) || "Clear"}
        title={(clearMapping?.config?.label as string) || "Clear"}
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
{:else if slotId === "error"}
  {@const errorValue = getSlotValue(slotId)}
  {@const errorMapping = getSlotMapping(slotId)}
  {#if errorValue}
    <div
      class="mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-red-50 to-red-100/50 border border-red-200/60 shadow-[0_2px_8px_rgba(239,68,68,0.1)] text-red-800 text-sm flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div class="flex items-center gap-2 flex-1">
        <svg
          class="w-5 h-5 text-red-600 flex-shrink-0"
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
        <span class="font-medium">{String(errorValue)}</span>
      </div>
    </div>
  {/if}
{:else if slotId === "list"}
  {@const listMapping = getSlotMapping(slotId)}
  {@const textProperty = (listMapping?.config?.textProperty as string) || "text"}
  {@const statusProperty = (listMapping?.config?.statusProperty as string) || "status"}
  {@const deleteLabel = (listMapping?.config?.deleteLabel as string) || "Delete"}
  {@const kanbanColumns = (listMapping?.config?.kanbanColumns as Array) || undefined}

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
          {@const columnStatus =
            column.status ||
            (column.filter.toString().includes('"todo"')
              ? "todo"
              : column.filter.toString().includes('"in-progress"')
                ? "in-progress"
                : column.filter.toString().includes('"done"')
                  ? "done"
                  : undefined)}
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
              {#each getListItems("list") as item (item.id || item._index)}
                {@const listItemMapping = getSlotMapping("list.item.id")}
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
                      {#if listItemMapping?.events?.onToggle}
                        <input
                          type="checkbox"
                          checked={item[statusProperty] === "done"}
                          onchange={() => {
                            triggerEvent("list.item.id", "onToggle", item as Record);
                          }}
                          class="w-4 h-4 rounded border-slate-300 text-[#001a42] focus:ring-2 focus:ring-[#001a42] cursor-pointer mt-0.5"
                        />
                      {/if}
                      <span
                        class="flex-1 text-sm {String(item[statusProperty]) === 'done'
                          ? 'text-slate-500 line-through'
                          : 'text-slate-700 font-medium'}">{String(item[textProperty] || "")}</span
                      >
                      {#if listItemMapping?.events?.onDelete}
                        <button
                          type="button"
                          onclick={() => {
                            triggerEvent("list.item.id", "onDelete", item as Record);
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
      <!-- Empty state when kanbanColumns not configured -->
      {@const emptyStateMessage =
        (listMapping?.config?.emptyStateMessage as string) ||
        (listMapping?.config?.kanbanEmptyMessage as string) ||
        "Kanban view requires kanbanColumns configuration"}
      <div class="text-center text-slate-500 py-8">
        {emptyStateMessage}
      </div>
    {/if}
  {:else}
    <!-- List View -->
    <ul class="space-y-2">
      {#each getListItems("list") as item (item.id || item._index)}
        {@const listItemMapping = getSlotMapping("list.item.id")}
        <li
          class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE}"
        >
          {#if listItemMapping?.events?.onToggle}
            <input
              type="checkbox"
              checked={item[statusProperty] === "done"}
              onchange={() => {
                triggerEvent("list.item.id", "onToggle", item as Record);
              }}
              class="w-5 h-5 rounded border-slate-300 text-[#001a42] focus:ring-2 focus:ring-[#001a42] cursor-pointer"
            />
          {/if}
          {#if item[textProperty]}
            <span
              class="flex-1 text-sm {String(item[statusProperty]) === 'done'
                ? 'line-through text-slate-500'
                : 'text-slate-700 font-medium'}"
            >
              {String(item[textProperty])}
            </span>
          {/if}
          <!-- Status Badge -->
          {#if listMapping?.config?.statusBadge !== undefined}
            {@const currentStatus = String(item[statusProperty] || "todo")}
            {@const statusBadgeConfig = listMapping?.config?.statusBadge as Record | undefined}
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
          {#if listItemMapping?.events?.onDelete}
            <button
              type="button"
              onclick={() => {
                triggerEvent("list.item.id", "onDelete", item as Record);
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
  {String(renderSlot(slotId))}
{/if}
