<!--
	Todo View Component
	Displays todos with checkboxes, allows toggling completion and deleting
-->
<script>
	import GlassCard from '../components/GlassCard.svelte';
	import { toggleTodo, deleteTodo } from '@hominio/vibes';
	
	let { data, onClose } = $props();
	
	const todosList = $derived(data?.todos || []);
	const todo = $derived(data?.todo); // For createTodo - single todo
	
	// Separate completed and uncompleted todos
	const uncompletedTodos = $derived(todosList.filter(t => !t.completed));
	const completedTodos = $derived(todosList.filter(t => t.completed));
	
	// If this is a createTodo result, show just that todo
	const isCreateMode = $derived(!!todo);
	const displayTodos = $derived(isCreateMode ? [todo] : todosList);
	
	async function handleToggle(id) {
		try {
			await toggleTodo(id);
			// Update local state reactively
			// The store will update, but we need to trigger reactivity
			// For now, we'll rely on the store update
		} catch (error) {
			console.error('[TodoView] Failed to toggle todo:', error);
		}
	}
	
	async function handleDelete(id) {
		try {
			await deleteTodo(id);
			// Update local state reactively
		} catch (error) {
			console.error('[TodoView] Failed to delete todo:', error);
		}
	}
</script>

<div class="p-4 md:p-8">
	<div class="mx-auto max-w-3xl">
		<div class="flex justify-center items-center mb-6">
			<h2 class="text-2xl font-extrabold tracking-tight text-center text-transparent bg-clip-text bg-gradient-to-br sm:text-3xl from-secondary-400 to-secondary-500">
				{isCreateMode ? 'Todo erstellt' : 'Meine Todos'}
			</h2>
		</div>
		
		{#if isCreateMode && todo}
			<!-- Single todo display (createTodo result) -->
			<GlassCard lifted={true} class="p-6">
				<div class="flex gap-4 items-start">
					<button
						onclick={() => handleToggle(todo.id)}
						class="flex-shrink-0 mt-1 w-5 h-5 rounded border-2 transition-colors {todo.completed ? 'bg-secondary-500 border-secondary-500' : 'border-slate-300'}"
						aria-label="Toggle todo completion"
					>
						{#if todo.completed}
							<svg class="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
							</svg>
						{/if}
					</button>
					<div class="flex-1 min-w-0">
						<h3 class="text-lg font-semibold {todo.completed ? 'line-through text-slate-400' : 'text-slate-800'}">
							{todo.title}
						</h3>
						{#if todo.completed}
							<p class="mt-1 text-sm text-slate-500">Erledigt</p>
						{/if}
					</div>
					<button
						onclick={() => handleDelete(todo.id)}
						class="flex-shrink-0 p-2 transition-colors text-slate-400 hover:text-red-500"
						aria-label="Delete todo"
						title="Löschen"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
						</svg>
					</button>
				</div>
			</GlassCard>
		{:else if uncompletedTodos.length > 0 || completedTodos.length > 0}
			<!-- List of todos -->
			<div class="space-y-4">
				{#if uncompletedTodos.length > 0}
					<section>
						<h3 class="mb-4 text-lg font-bold text-center sm:text-xl text-secondary-500">Offen</h3>
						<div class="space-y-3">
							{#each uncompletedTodos as item (item.id)}
								<GlassCard lifted={true} class="p-4">
									<div class="flex gap-4 items-start">
										<button
											onclick={() => handleToggle(item.id)}
											class="flex-shrink-0 mt-1 w-5 h-5 rounded border-2 transition-colors border-slate-300 hover:border-secondary-400"
											aria-label="Toggle todo completion"
										>
										</button>
										<div class="flex-1 min-w-0">
											<h4 class="text-base font-semibold text-slate-800">{item.title}</h4>
										</div>
										<button
											onclick={() => handleDelete(item.id)}
											class="flex-shrink-0 p-2 transition-colors text-slate-400 hover:text-red-500"
											aria-label="Delete todo"
											title="Löschen"
										>
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
											</svg>
										</button>
									</div>
								</GlassCard>
							{/each}
						</div>
					</section>
				{/if}
				
				{#if completedTodos.length > 0}
					<section>
						<h3 class="mb-4 text-lg font-bold text-center sm:text-xl text-slate-400">Erledigt</h3>
						<div class="space-y-3">
							{#each completedTodos as item (item.id)}
								<GlassCard lifted={true} class="p-4 opacity-75">
									<div class="flex gap-4 items-start">
										<button
											onclick={() => handleToggle(item.id)}
											class="flex-shrink-0 mt-1 w-5 h-5 rounded border-2 transition-colors bg-secondary-500 border-secondary-500"
											aria-label="Toggle todo completion"
										>
											<svg class="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
											</svg>
										</button>
										<div class="flex-1 min-w-0">
											<h4 class="text-base font-semibold line-through text-slate-400">{item.title}</h4>
										</div>
										<button
											onclick={() => handleDelete(item.id)}
											class="flex-shrink-0 p-2 transition-colors text-slate-400 hover:text-red-500"
											aria-label="Delete todo"
											title="Löschen"
										>
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
											</svg>
										</button>
									</div>
								</GlassCard>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		{:else}
			<GlassCard class="p-8 text-center text-slate-500">
				<p>Noch keine Todos vorhanden.</p>
			</GlassCard>
		{/if}
	</div>
</div>

