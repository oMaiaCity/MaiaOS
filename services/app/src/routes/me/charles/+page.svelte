<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getZeroContext } from '$lib/zero-utils';
	import { allProjects } from '@hominio/zero';
	import { GlassCard, LoadingSpinner, Alert, BackgroundBlobs } from '@hominio/brand';
	import { loadAgentConfig, handleActionSkill, UIRenderer } from '@hominio/agents';
	import { createAuthClient } from '@hominio/auth';

	// Load agent config
	let agentConfig = $state(null);
	let agentLoading = $state(true);
	let agentError = $state(null);

	// Agent info (fallback if config fails)
		const agent = {
		name: 'Charles',
		role: 'Hotel Concierge',
		description: 'Dein persönlicher Concierge. Ich kann Dir bei Buchungen, Empfehlungen, Room Service und allem anderen helfen, was Du während Deines Aufenthalts benötigst.',
		color: 'from-blue-400 to-cyan-400'
	};

	// Agent skills/capabilities (fallback)
	const skillsFallback = [
		{ 
			id: 'hotels', 
			name: 'My Hotels', 
			description: 'View and manage your hotel properties', 
			svg: '<path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.83l6 6V19h-2v-6H8v6H6v-7.17l6-6z"/>'
		},
		{ 
			id: 'menu', 
			name: 'Restaurant Menu', 
			description: 'Browse dining options and menus', 
			svg: '<path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.20-1.10-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/>'
		},
		{ 
			id: 'room-service', 
			name: 'Room Service', 
			description: 'Order food and drinks to your room', 
			svg: '<path d="M2 17h20v2H2v-2zm11.84-9.21A2.006 2.006 0 0012 5c-.86 0-1.61.55-1.89 1.32L2 18h20l-8.16-10.21zM12 9c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>'
		},
		{ 
			id: 'spa', 
			name: 'Spa & Wellness', 
			description: 'Book spa treatments and wellness services', 
			svg: '<path d="M8.55 12c-1.07-.71-2.25-1.27-3.53-1.61 1.28.34 2.46.9 3.53 1.61zm10.43-1.61c-1.29.34-2.49.91-3.57 1.64 1.08-.73 2.28-1.3 3.57-1.64z"/><path d="M15.49 9.63c-.18-2.79-1.31-5.51-3.43-7.63-2.14 2.14-3.32 4.86-3.55 7.63 1.28.68 2.46 1.56 3.49 2.63 1.03-1.06 2.21-1.94 3.49-2.63zm-6.5 2.65c-.14-.1-.3-.19-.45-.29.15.11.31.19.45.29zm.15.09c-.17-.11-.35-.22-.53-.32.18.1.36.21.53.32zm-.13-.08c-.11-.07-.23-.14-.35-.2.12.06.24.13.35.2zm1.15.08c.17-.11.35-.22.53-.32-.18.1-.36.21-.53.32zm.13-.09c.11-.07.23-.14.35-.2-.12.06-.24.13-.35.2zm-1.4-1.34C7.82 7.68 5.64 5.5 3.44 4.44c1.11 2.2 3.29 4.38 5.03 6.02zM12 15.45C9.85 12.17 6.18 10 2 10c0 5.32 3.36 9.82 8.03 11.49.63.23 1.29.4 1.97.51.68-.12 1.33-.29 1.97-.51C18.64 19.82 22 15.32 22 10c-4.18 0-7.85 2.17-10 5.45z"/>'
		},
		{ 
			id: 'taxi', 
			name: 'Transportation', 
			description: 'Book taxis and transportation services', 
			svg: '<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>'
		},
		{ 
			id: 'housekeeping', 
			name: 'Housekeeping', 
			description: 'Request cleaning and maintenance', 
			svg: '<path d="M3 5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5zm2 0v14h14V5H5zm3.5 2.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5S10.83 6 10 6s-1.5.67-1.5 1.5zM14 18l-4-5 2-2 4 5v2z"/>'
		},
		{ 
			id: 'recommendations', 
			name: 'Local Guide', 
			description: 'Discover local attractions and activities', 
			svg: '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>'
		},
		{ 
			id: 'events', 
			name: 'Events', 
			description: 'View and book hotel events', 
			svg: '<path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>'
		}
	];

	// Projects state
	/** @type {Array<{id: string, title: string, description: string | null, createdAt: string, userId: string}>} */
	let projects = $state([]);
	let loading = $state(true);
	/** @type {string | null} */
	let error = $state(null);

	// ActionSkill result state
	let skillResult = $state(null);
	let skillResultFunctionId = $state(null);
	let showingSkillResult = $state(false);
	
	// Function to go back to agent view
	function goBackToAgent() {
		showingSkillResult = false;
		skillResult = null;
		skillResultFunctionId = null;
	}

	// Get Zero context from layout (for projects display)
	const zeroContext = getZeroContext();
	const authClient = createAuthClient();
	const session = authClient.useSession();

	// Handle actionSkill tool calls
	async function executeSkill(agentId: string, skillId: string, args: any) {
		try {
			const userId = $session.data?.user?.id;
			const result = await handleActionSkill(
				{ agentId, skillId, args },
				{
					userId
				}
			);

			if (result.success) {
				// Find function ID from agent config
				const skill = agentConfig?.skills.find(s => s.id === skillId);
				const functionId = skill?.functionId || skillId;
				
				skillResult = result.data;
				skillResultFunctionId = functionId;
				showingSkillResult = true;
			} else {
				console.error('[Charles] Skill execution failed:', result.error);
				alert(`Fehler: ${result.error}`);
			}
		} catch (err) {
			console.error('[Charles] Error executing skill:', err);
			alert(`Fehler beim Ausführen der Funktion: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
		}
	}

	onMount(() => {
		// Load agent config
		(async () => {
			try {
				const config = await loadAgentConfig('charles');
				agentConfig = config;
				agentLoading = false;
			} catch (err) {
				console.error('[Charles] Failed to load agent config:', err);
				agentError = err instanceof Error ? err.message : 'Fehler beim Laden der Agent-Konfiguration';
				agentLoading = false;
			}
		})();

		// Listen for actionSkill events from NavPill
		const handleActionSkillEvent = async (event: Event) => {
			const customEvent = event as CustomEvent;
			const { agentId, skillId, args } = customEvent.detail;
			
			if (agentId === 'charles') {
				// Ensure agent config is loaded before executing
				if (!agentConfig) {
					// Wait for config to load
					while (!agentConfig && !agentError) {
						await new Promise((resolve) => setTimeout(resolve, 100));
					}
					if (agentError) {
						console.error('[Charles] Failed to load agent config:', agentError);
						return;
					}
				}
				executeSkill(agentId, skillId, args);
			}
		};

		window.addEventListener('actionSkill', handleActionSkillEvent);

		// Load projects (still using Zero for projects display)
		if (!zeroContext) {
			console.error('Zero context not found');
			loading = false;
			error = 'Zero-Synchronisation ist nicht verfügbar';
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
				error = 'Fehler beim Initialisieren des Zero-Clients';
				return;
			}

			try {
				// Query all projects using synced query
				const projectsQuery = allProjects();
				projectsView = zero.materialize(projectsQuery);

				projectsView.addListener((data: any) => {
					const newProjects = Array.from(data || []);
					projects = newProjects;
					loading = false;
					error = null;
				});
			} catch (err) {
				console.error('Error setting up Zero query:', err);
				error = err instanceof Error ? err.message : 'Fehler beim Laden der Projekte';
				loading = false;
			}
		})();

		return () => {
			window.removeEventListener('actionSkill', handleActionSkillEvent as EventListener);
			if (projectsView) projectsView.destroy();
		};
	});

	function handleSkillClick(skillId: string) {
		console.log(`Skill clicked: ${skillId}`);
		executeSkill('charles', skillId, {});
	}

	// Use skills from config or fallback
	const skills = $derived(agentConfig?.skills || skillsFallback);
</script>

<div class="relative min-h-screen overflow-x-hidden bg-glass-gradient px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
	<BackgroundBlobs />

	<div class="relative z-10 mx-auto max-w-6xl">
		{#if showingSkillResult && skillResult && skillResultFunctionId}
			<!-- Skill Result View (replaces agent UI) -->
			<div class="pt-8">
				<GlassCard class="p-6">
					<UIRenderer 
						functionId={skillResultFunctionId}
						resultData={skillResult}
						onClose={goBackToAgent}
					/>
				</GlassCard>
			</div>
		{:else}
			<!-- Agent Info Card -->
			<div class="mb-8">
				<GlassCard class="overflow-hidden p-8">
					<div class="flex flex-col items-center text-center md:flex-row md:text-left md:gap-6">
						<div class="mb-4 md:mb-0">
							<svg class="w-20 h-20 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.83l6 6V19h-2v-6H8v6H6v-7.17l6-6z"/>
							</svg>
						</div>
						<div class="flex-1">
							<h1 class="mb-2 text-3xl font-bold text-slate-900">{agentConfig?.name || agent.name}</h1>
							<div class="mb-3 inline-block rounded-full bg-gradient-to-r {agent.color} px-4 py-1 text-sm font-semibold text-white">
								{agentConfig?.role || agent.role}
							</div>
							<p class="mt-3 text-base leading-relaxed text-slate-600">{agentConfig?.description || agent.description}</p>
						</div>
					</div>
				</GlassCard>
			</div>

			<!-- Skills Section -->
			<div class="mb-12">
				<h2 class="mb-6 text-2xl font-bold text-center text-slate-900">Womit ich helfen kann</h2>
				{#if agentLoading}
					<div class="flex justify-center py-8">
						<LoadingSpinner />
					</div>
				{:else if agentError}
					<div class="py-8 text-center">
						<Alert type="warning" class="mx-auto max-w-md">
							<p class="font-medium">Konfigurationsfehler</p>
							<p class="mt-1 text-sm opacity-80">{agentError}</p>
						</Alert>
					</div>
				{:else}
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{#each skills as skill (skill.id)}
							<GlassCard 
								lifted={true}
								class="relative p-6 transition-all duration-300 cursor-pointer group hover:scale-105"
								role="button"
								tabindex="0"
								onclick={() => handleSkillClick(skill.id)}
								onkeydown={(e) => e.key === 'Enter' && handleSkillClick(skill.id)}
							>
								<div class="flex flex-col items-center text-center">
									{#if skill.svg}
										<svg class="mb-3 w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
											{@html skill.svg}
										</svg>
									{:else}
										<div class="flex justify-center items-center mb-3 w-10 h-10 text-xl text-white bg-blue-500 rounded-full">
											{skill.name[0]?.toUpperCase() || '?'}
										</div>
									{/if}
									<h3 class="mb-2 text-sm font-bold text-slate-900">{skill.name}</h3>
									<p class="text-xs leading-relaxed text-slate-600">{skill.description}</p>
								</div>
							</GlassCard>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Projects Section -->
			<div class="mb-8">
				<h2 class="mb-6 text-2xl font-bold text-center text-slate-900">Deine Hotel-Projekte</h2>
				
				{#if loading}
					<div class="flex relative z-10 flex-col justify-center items-center py-12">
						<LoadingSpinner />
						<p class="mt-4 text-sm font-medium text-slate-500">Projekte werden geladen...</p>
					</div>
				{:else if error}
					<div class="relative z-10 py-12 text-center">
						<Alert type="warning" class="mx-auto max-w-md">
							<p class="font-medium">Fehler</p>
							<p class="mt-1 text-sm opacity-80">{error}</p>
						</Alert>
					</div>
				{:else if projects.length === 0}
					<div class="relative z-10 py-12 text-center">
						<GlassCard class="p-8 mx-auto max-w-md">
							<p class="text-base text-slate-500">Noch keine Hotel-Projekte. Erstellen Sie Ihr erstes Projekt, um zu beginnen!</p>
						</GlassCard>
					</div>
				{:else}
					<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{#each projects as project (project.id)}
							<GlassCard lifted={true} class="flex relative flex-col gap-3 p-6 cursor-pointer group" role="button" tabindex="0">
								<div class="flex-1">
									<h3 class="mb-2 text-lg font-semibold tracking-tight text-slate-900">
										{project.title}
									</h3>
									{#if project.description}
										<p class="mb-3 text-sm leading-relaxed text-slate-600">
											{project.description}
										</p>
									{/if}
									<div class="mt-auto text-xs text-slate-400">
										Erstellt am {new Date(project.createdAt).toLocaleDateString('de-DE')}
									</div>
								</div>
							</GlassCard>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

