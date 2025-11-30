<!--
	Todo View Component
	Displays todos with checkboxes, allows toggling completion and deleting
-->
<script>
	import GlassCard from '../components/GlassCard.svelte';
	
	let { data, onClose } = $props();
	
	const todosList = $derived(data?.todos || []);
	const todo = $derived(data?.todo); // For createTodo - single todo
	const changes = $derived(data?.changes || []); // For editTodo - changes made
	
	// Separate completed and uncompleted todos
	const uncompletedTodos = $derived(todosList.filter(t => !t.completed));
	const completedTodos = $derived(todosList.filter(t => t.completed));
	
	// If this is a createTodo result, show just that todo
	const isCreateMode = $derived(!!todo);
	// If this is an editTodo result, show the updated todos with diff
	const titleChanges = $derived(changes.filter(c => c.fieldsChanged.includes('title')));
	const statusChanges = $derived(changes.filter(c => c.fieldsChanged.includes('completed')));
	// Get todos that were marked as completed (status changed to true)
	const completedInEdit = $derived(
		statusChanges
			.filter(c => c.updated.completed === true)
			.map(c => {
				const todo = todosList.find(t => t.id === c.id);
				return todo || { id: c.id, title: c.updated.title, completed: true };
			})
	);
	// isEditMode is true if there are ANY changes (to hide todo list)
	const isEditMode = $derived(changes.length > 0);
	const displayTodos = $derived(isCreateMode ? [todo] : todosList);
	
	// Helper to get change info for a todo
	function getChangeInfo(todoId) {
		return changes.find(c => c.id === todoId);
	}
</script>

	<div class="p-2 md:p-4">
	<div class="mx-auto max-w-3xl">
		<div class="flex justify-center items-center mb-3">
			<h2 class="text-sm font-semibold tracking-tight text-center text-transparent bg-clip-text bg-gradient-to-br from-secondary-400 to-secondary-500">
				{isCreateMode ? 'Todo erstellt' : isEditMode ? 'Todo bearbeitet' : 'Meine Todos'}
			</h2>
		</div>
		
		{#if isEditMode}
			<div class="mb-4 space-y-2">
				{#if titleChanges.length > 0}
					<!-- Diff View: Show title changes - old value in alert colors, new value in success colors -->
					{#each titleChanges as change (change.id)}
						<div class="flex gap-2 items-stretch">
							<!-- Old title (left, alert colors) -->
							<GlassCard lifted={true} bgColor="alert" class="flex-1 px-4 py-2 rounded-lg backdrop-blur-sm" style="border-color: var(--color-alert-200);">
								<div class="flex gap-2 items-center justify-between">
									<p class="text-base font-medium line-through flex-1" style="color: var(--color-alert-600);">{change.original.title}</p>
								</div>
							</GlassCard>
							<!-- New title (right, success colors with checkmark) -->
							<GlassCard lifted={true} bgColor="success" class="flex-1 px-4 py-2 rounded-lg backdrop-blur-sm" style="border-color: var(--color-success-200);">
								<div class="flex gap-2 items-center justify-between">
									<p class="text-base font-medium text-green-600 flex-1">{change.updated.title}</p>
									<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500 flex-shrink-0">
										<path d="M20 6L9 17l-5-5"/>
									</svg>
								</div>
							</GlassCard>
						</div>
					{/each}
				{/if}
				
				{#if completedInEdit.length > 0}
					<!-- Show completed todos in full green style with checkmark -->
					{#each completedInEdit as item (item.id)}
						<GlassCard lifted={true} bgColor="success" class="px-4 py-2 rounded-lg backdrop-blur-sm" style="border-color: var(--color-success-200);">
							<div class="flex gap-2 items-center justify-between">
								<p class="text-base font-medium text-green-600 flex-1">{item.title}</p>
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500 flex-shrink-0">
									<path d="M20 6L9 17l-5-5"/>
								</svg>
							</div>
						</GlassCard>
					{/each}
				{/if}
			</div>
		{/if}
		
		{#if isCreateMode && todo}
			<!-- Single todo display (createTodo result) -->
			<GlassCard lifted={true} class="px-4 py-3">
				<div class="flex gap-2 items-start">
					<div class="flex-1 min-w-0">
						<p class="text-base font-medium {todo.completed ? 'line-through text-slate-400' : 'text-slate-800'}">
							{todo.title}
						</p>
						{#if todo.completed}
							<p class="mt-0.5 text-xs text-slate-500">Erledigt</p>
						{/if}
					</div>
				</div>
			</GlassCard>
		{:else if isEditMode}
			<!-- Edit mode: Only show diff view, no todo list -->
			<!-- (Diff view is already shown above) -->
		{:else if uncompletedTodos.length > 0 || completedTodos.length > 0}
			<!-- List of todos (only shown for queryTodos, not editTodo) -->
			<div class="space-y-4">
				{#if uncompletedTodos.length > 0}
					<section>
						<h3 class="mb-2 text-xs font-semibold text-center text-secondary-500">Offen</h3>
						<div class="space-y-2">
							{#each uncompletedTodos as item (item.id)}
								<GlassCard lifted={true} class="px-4 py-2">
									<div class="flex gap-2 items-start">
										<div class="flex-1 min-w-0">
											<p class="text-base font-medium text-slate-800">{item.title}</p>
										</div>
									</div>
								</GlassCard>
							{/each}
						</div>
					</section>
				{/if}
				
				{#if completedTodos.length > 0}
					<section>
						<h3 class="mb-2 text-xs font-semibold text-center text-slate-400">Erledigt</h3>
						<div class="space-y-2">
							{#each completedTodos as item (item.id)}
								<GlassCard lifted={true} class="px-4 py-2 opacity-75">
									<div class="flex gap-2 items-start">
										<div class="flex-1 min-w-0">
											<p class="text-base font-medium line-through text-slate-400">{item.title}</p>
										</div>
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

