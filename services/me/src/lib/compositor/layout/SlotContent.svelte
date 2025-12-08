<!--
  Slot Content Component
  Renders slot content for use in LayoutEngine
  Handles all slot types: title, description, input, list, error, etc.
-->
<script lang="ts">
  import { HOVERABLE_STYLE } from "$lib/utils/styles";
  import type { ResolvedUISlot } from "../ui-slots/types";
  import { getSlotsByPattern } from "../ui-slots/renderer";

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
  <div class="flex justify-center mb-4">
    <button
      type="button"
      onclick={() => {
        triggerEvent("viewToggle", "onClick");
      }}
      class="px-4 py-2 rounded-full bg-[#001a42] border border-[#001a42] text-[#e6ecf7] shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-sm"
    >
      Switch to {currentView === "list" ? "Kanban" : "List"} View
    </button>
  </div>
{:else if slotId === "input.value"}
  {@const inputData = renderSlot(slotId) as Record}
  {@const inputMapping = getSlotMapping(slotId)}
  {@const todos = getSlotValue("list") as Array}
  {@const hasTodos = todos && Array.isArray(todos) && todos.length > 0}
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
      type={String(inputData.type || "text")}
      value={String(inputData.value || "")}
      placeholder={String(inputMapping?.config?.placeholder || "Add a new todo...")}
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
      {isLoading ? "Adding..." : String(inputMapping?.config?.submitLabel || "Add")}
    </button>
    {#if hasTodos}
      <button
        type="button"
        onclick={() => triggerEvent("clearTodos", "onClick")}
        class="w-8 h-8 rounded-full bg-red-500 border border-red-500 text-white shadow-button-primary hover:bg-red-600 hover:border-red-600 hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center flex-shrink-0"
        aria-label="Clear all todos"
        title="Clear all todos"
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
  {#if viewMode === "kanban"}
    <!-- Kanban Board View -->
    <div class="grid grid-cols-3 gap-4 h-full">
      <!-- Todo Column -->
      <div class="bg-slate-100 rounded-2xl p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3 uppercase">Todo</h3>
        <div class="space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
          {#each getListItems("list") as item (item.id || item._index)}
            {@const listItemMapping = getSlotMapping("list.item.id")}
            {#if !item.completed}
              <div
                class="px-3 py-2 rounded-xl bg-white border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE}"
              >
                <div class="flex items-start gap-2">
                  {#if listItemMapping?.events?.onToggle}
                    <input
                      type="checkbox"
                      checked={false}
                      onchange={() => {
                        triggerEvent("list.item.id", "onToggle", item as Record);
                      }}
                      class="w-4 h-4 rounded border-slate-300 text-[#001a42] focus:ring-2 focus:ring-[#001a42] cursor-pointer mt-0.5"
                    />
                  {/if}
                  <span class="flex-1 text-sm text-slate-700 font-medium">{String(item.text)}</span>
                  {#if listItemMapping?.events?.onDelete}
                    <button
                      type="button"
                      onclick={() => {
                        triggerEvent("list.item.id", "onDelete", item as Record);
                      }}
                      class="px-1 py-1 text-xs text-slate-500 hover:text-slate-700"
                      aria-label="Delete"
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
      <!-- In Progress Column -->
      <div class="bg-slate-100 rounded-2xl p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3 uppercase">In Progress</h3>
        <div class="space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
          <!-- Empty for now -->
        </div>
      </div>
      <!-- Done Column -->
      <div class="bg-slate-100 rounded-2xl p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3 uppercase">Done</h3>
        <div class="space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
          {#each getListItems("list") as item (item.id || item._index)}
            {@const listItemMapping = getSlotMapping("list.item.id")}
            {#if item.completed}
              <div
                class="px-3 py-2 rounded-xl bg-white border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE}"
              >
                <div class="flex items-start gap-2">
                  {#if listItemMapping?.events?.onToggle}
                    <input
                      type="checkbox"
                      checked={true}
                      onchange={() => {
                        triggerEvent("list.item.id", "onToggle", item as Record);
                      }}
                      class="w-4 h-4 rounded border-slate-300 text-[#001a42] focus:ring-2 focus:ring-[#001a42] cursor-pointer mt-0.5"
                    />
                  {/if}
                  <span class="flex-1 text-sm text-slate-500 line-through">{String(item.text)}</span
                  >
                  {#if listItemMapping?.events?.onDelete}
                    <button
                      type="button"
                      onclick={() => {
                        triggerEvent("list.item.id", "onDelete", item as Record);
                      }}
                      class="px-1 py-1 text-xs text-slate-500 hover:text-slate-700"
                      aria-label="Delete"
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
    </div>
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
              checked={Boolean(item.completed)}
              onchange={() => {
                triggerEvent("list.item.id", "onToggle", item as Record);
              }}
              class="w-5 h-5 rounded border-slate-300 text-[#001a42] focus:ring-2 focus:ring-[#001a42] cursor-pointer"
            />
          {/if}
          {#if item.text}
            <span
              class="flex-1 text-sm {item.completed
                ? 'line-through text-slate-500'
                : 'text-slate-700 font-medium'}"
            >
              {String(item.text)}
            </span>
          {/if}
          {#if listItemMapping?.events?.onDelete}
            <button
              type="button"
              onclick={() => {
                triggerEvent("list.item.id", "onDelete", item as Record);
              }}
              class="px-2 py-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all duration-200 w-6 h-6 flex items-center justify-center"
              aria-label="Delete"
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
