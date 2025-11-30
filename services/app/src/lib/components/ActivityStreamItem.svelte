<script lang="ts">
	import { UIRenderer } from '@hominio/vibes';
	import { GlassCard, LoadingSpinner } from '@hominio/brand';
	import { slide } from 'svelte/transition';

	let { item, isExpanded = false, onToggle } = $props();

    // Derived state
	const isQueryTodos = $derived(item.toolName === 'queryTodos');
	const isCreateTodo = $derived(item.toolName === 'createTodo');
	const isEditTodo = $derived(item.toolName === 'editTodo');
    
    // Extract args
    const args = $derived(item.args || {});
    
    // State for collapsing
    const initialExpanded = isExpanded;
    let expanded = $state(initialExpanded);
    let lastPropValue = $state(isExpanded);
    let hasUserToggled = $state(false);
    
    
    // Sync expanded state with props only when prop changes externally (not from our toggle)
    $effect(() => {
        // Only sync if prop changed externally AND user hasn't manually toggled this item
        if (!hasUserToggled && isExpanded !== lastPropValue) {
            lastPropValue = isExpanded;
                expanded = isExpanded;
		}
	});

    function handleToggle() {
        expanded = !expanded;
        hasUserToggled = true; // Mark that user has manually toggled
        // Update lastPropValue to prevent effect from resetting our toggle
        lastPropValue = expanded;
        // Always call onToggle if provided to sync parent state
        if (onToggle) {
            onToggle();
        }
    }
</script>

<div class="flex justify-center w-full transition-all duration-300">
    {#if isQueryTodos || isCreateTodo || isEditTodo}
        <!-- Todo Tool Call Item (queryTodos/createTodo) -->
        <GlassCard class="overflow-hidden w-full border-l-4 border-l-purple-400" lifted={true}>
            <!-- Header / Collapsed View -->
            <button 
                class="flex justify-between items-center px-4 py-2 w-full text-left border-b transition-all cursor-pointer border-slate-200/30 bg-slate-100/40"
                onclick={handleToggle}
            >
                <div class="flex gap-3 items-center">
                    <div class="flex-1">
                        <div class="text-sm font-semibold tracking-wide text-slate-800">
                            {#if isCreateTodo && args.title}
                                Create: "{Array.isArray(args.title) ? args.title.join(', ') : args.title}"
                            {:else if isEditTodo && args.id}
                                Edit: {Array.isArray(args.id) ? `${args.id.length} todo(s)` : 'todo'}
                            {:else if isQueryTodos}
                                Show all todos
                    {:else}
                                {item.toolName}
                            {/if}
                        </div>
                        <div class="mt-0.5 text-xs tabular-nums text-slate-400">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 items-center">
                    <div class="transition-transform duration-300 text-slate-400" class:rotate-180={expanded}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
            </button>

            <!-- Expanded Content -->
            {#if expanded}
                <div transition:slide={{ duration: 300 }} class="p-4 bg-slate-50/30 border-t border-slate-200/20">
                    {#if item.status === 'pending'}
                        <div class="flex justify-center items-center p-4">
                            <LoadingSpinner />
                            <span class="ml-2 text-sm text-slate-500">Executing {item.toolName}...</span>
                        </div>
                    {:else if item.status === 'error'}
                        <div class="p-4 text-red-500 rounded bg-red-50/50">
                            <p class="text-sm font-bold">Error executing tool</p>
                            <p class="text-xs opacity-80">{item.error}</p>
                        </div>
                    {:else if item.result}
                        <!-- Only show the UI component, no JSON -->
                        <div class="pt-4 pb-2">
                            <UIRenderer 
                                functionId={isQueryTodos ? 'query-todos' : isCreateTodo ? 'create-todo' : 'edit-todo'} 
                                resultData={item.result} 
                                onClose={() => { expanded = false; }} 
                            />
                        </div>
                    {:else}
                        <div class="p-6 text-sm italic text-center text-slate-500">
                            No output data available
                        </div>
                    {/if}
                    <!-- JSON data hidden for TodoView components -->
                </div>
            {/if}
        </GlassCard>
    {:else}
        <!-- Don't render unknown tools at all - they're filtered out earlier -->
    {/if}
</div>

