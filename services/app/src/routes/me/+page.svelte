<script lang="ts">
	import { onMount } from 'svelte';
	import { getZeroContext } from '$lib/zero-utils';
	import { allProjects } from '@hominio/zero';
	import { GlassCard, LoadingSpinner, Alert, BackgroundBlobs } from '@hominio/brand';
	import VoiceCall from '$lib/components/VoiceCall.svelte';

	/** @type {Array<{id: string, title: string, description: string | null, createdAt: string, userId: string}>} */
	let projects = $state([]);
	let loading = $state(true);
	/** @type {string | null} */
	let error = $state(null);

	// Get Zero context from layout
	const zeroContext = getZeroContext();

	onMount(() => {
		if (!zeroContext) {
			console.error('Zero context not found');
			loading = false;
			error = 'Zero sync is not available';
			return;
		}

		let projectsView: any;

		(async () => {
			// Wait for Zero to be ready
			while (!zeroContext.isReady() || !zeroContext.getInstance()) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			const zero = zeroContext.getInstance();

			if (!zero) {
				loading = false;
				error = 'Failed to initialize Zero client';
				return;
	}

			try {
				// Query all projects using synced query - data is already cached locally!
				const projectsQuery = allProjects();
				projectsView = zero.materialize(projectsQuery);

				projectsView.addListener((data: any) => {
					const newProjects = Array.from(data || []);
					projects = newProjects;
					// Set loading to false IMMEDIATELY - ZeroDB data is already available locally
					loading = false;
					error = null;
				});
		} catch (err) {
				console.error('Error setting up Zero query:', err);
			error = err instanceof Error ? err.message : 'Failed to load projects';
			loading = false;
		}
		})();

		return () => {
			if (projectsView) projectsView.destroy();
		};
	});
</script>

<div class="relative min-h-screen overflow-x-hidden bg-glass-gradient px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
	<BackgroundBlobs />

	<div class="relative z-10 mb-12 pt-[env(safe-area-inset-top)] text-center">
		<h1 class="mb-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">My Projects</h1>
		<p class="text-base font-normal text-slate-500">View and manage your projects</p>
	</div>

	{#if loading}
		<div class="relative z-10 flex flex-col items-center justify-center py-12">
			<LoadingSpinner />
			<p class="mt-4 text-sm font-medium text-slate-500">Loading projects...</p>
		</div>
	{:else if error}
		<div class="relative z-10 py-12 text-center">
			<Alert type="warning" class="mx-auto max-w-md">
				<p class="font-medium">Error</p>
				<p class="mt-1 text-sm opacity-80">{error}</p>
			</Alert>
		</div>
	{:else if projects.length === 0}
		<div class="relative z-10 py-12 text-center">
			<GlassCard class="mx-auto max-w-md p-8">
				<p class="text-base text-slate-500">No projects found. Create your first project to get started!</p>
			</GlassCard>
		</div>
	{:else}
		<div class="relative z-10 mx-auto grid max-w-4xl grid-cols-1 gap-6 px-4 md:grid-cols-2 lg:grid-cols-3">
			{#each projects as project (project.id)}
				<GlassCard lifted={true} class="group relative flex cursor-pointer flex-col gap-3 p-6" role="button" tabindex="0">
					<div class="flex-1">
						<h2 class="mb-2 text-lg font-semibold tracking-tight text-slate-900">
							{project.title}
						</h2>
						{#if project.description}
							<p class="mb-3 text-sm leading-relaxed text-slate-600">
								{project.description}
							</p>
						{/if}
						<div class="mt-auto text-xs text-slate-400">
							Created {new Date(project.createdAt).toLocaleDateString()}
						</div>
					</div>
				</GlassCard>
			{/each}
		</div>
	{/if}

	<!-- Voice Call Component -->
	<div class="relative z-10 mx-auto mt-12 max-w-2xl px-4">
		<VoiceCall />
	</div>
</div>

