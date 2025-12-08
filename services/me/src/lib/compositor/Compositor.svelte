<script lang="ts">
  import { HOVERABLE_STYLE } from "$lib/utils/styles";
  import { createDataStore } from "./dataStore";
  import { mergeActionsIntoConfig } from "./actions";
  import type { CompositorConfig } from "./types";

  // ========== PROPS ==========
  interface Props {
    config: CompositorConfig;
  }

  let { config }: Props = $props();

  // ========== UNIFIED DATA STORE SETUP ==========
  const mergedConfig = mergeActionsIntoConfig(config.stateMachine, config.actions);
  const dataStore = createDataStore(mergedConfig);

  // ========== REACTIVE DATA ACCESS ==========
  // Single unified reactive interface - everything is just data
  const data = $derived($dataStore);

  // Access any data property reactively - no distinction between types
  const title = $derived((data.title as string) || "");
  const description = $derived((data.description as string) || "");
  const todos = $derived(
    (data.todos as Array<{ id: string; text: string; completed: boolean }>) || [],
  );
  const newTodoText = $derived((data.newTodoText as string) || "");
  const error = $derived(data.error);
  const isLoading = $derived((data.isLoading as boolean) || false);

  // ========== UI CLASSES ==========
  const containerClass = $derived(
    config.ui?.containerClass || "min-h-screen bg-gray-100 pt-20 px-4",
  );
  const cardClass = $derived(
    config.ui?.cardClass ||
      "relative overflow-hidden rounded-3xl bg-slate-50 border border-white shadow-card-default p-6",
  );
</script>

<div class={containerClass}>
  <div class="max-w-4xl mx-auto py-8">
    <!-- Card rendered directly -->
    <div class={cardClass}>
      <!-- Glossy gradient overlay -->
      <div class="absolute inset-0 pointer-events-none"></div>

      <!-- Content -->
      <div class="relative z-10">
        <div class="text-center mb-6">
          <h1 class="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
          <p class="text-slate-600">{description}</p>
        </div>

        <!-- Todo List -->
        <div class="mt-6 pt-6 border-t border-white/50">
          <h2 class="text-xl font-semibold text-slate-700 mb-4 uppercase tracking-wider">
            Todo List
          </h2>

          <!-- Add Todo Form -->
          <form
            onsubmit={(e) => {
              e.preventDefault();
              dataStore.send("ADD_TODO", { text: newTodoText });
              dataStore.send("SUCCESS");
            }}
            class="mb-4 flex gap-2"
          >
            <input
              type="text"
              value={newTodoText}
              oninput={(e) => {
                dataStore.send("UPDATE_INPUT", {
                  text: e.currentTarget.value,
                });
              }}
              placeholder="Add a new todo..."
              class="flex-1 px-4 py-2 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-300 transition-all text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={isLoading}
              class="px-4 py-2 bg-[#001a42] border border-[#001a42] text-[#e6ecf7] rounded-full shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? "Adding..." : "Add"}
            </button>
          </form>

          {#if error}
            <div
              class="mb-4 px-4 py-2 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {error}
              <button
                type="button"
                onclick={() => dataStore.send("CLEAR_ERROR")}
                class="ml-2 text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          {/if}

          <!-- Todo Items -->
          <ul class="space-y-2">
            {#each todos as todo (todo.id)}
              <li
                class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] {HOVERABLE_STYLE}"
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onchange={() => dataStore.send("TOGGLE_TODO", { todoId: todo.id })}
                  class="w-5 h-5 rounded border-slate-300 text-[#001a42] focus:ring-2 focus:ring-[#001a42] cursor-pointer"
                />
                <span
                  class="flex-1 text-sm {todo.completed
                    ? 'line-through text-slate-500'
                    : 'text-slate-700 font-medium'}"
                >
                  {todo.text}
                </span>
                <button
                  type="button"
                  onclick={() => dataStore.send("REMOVE_TODO", { todoId: todo.id })}
                  class="px-2 py-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all duration-200 w-6 h-6 flex items-center justify-center"
                  aria-label="Delete todo"
                >
                  ✕
                </button>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
