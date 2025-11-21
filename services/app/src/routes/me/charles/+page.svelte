<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getZeroContext } from '$lib/zero-utils';
	// Hotels query will be imported dynamically
	import { GlassCard, LoadingSpinner, Alert } from '@hominio/brand';
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
		color: 'from-[#45b8c8] to-[#2da6b4]' // Secondary brand color gradient
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

	// Hotels state (replacing projects)
	/** @type {Array<{id: string, ownedBy: string, schema: string, data: string}>} */
	let hotels = $state([]);
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

		let hotelsView: any;
		let schemasView: any;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

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
			// First, get all schemas to find the hotel schema ID
			// Keep this reactive - don't destroy the view, let it update when data arrives
			const { allSchemas, allDataBySchema, getHotelSchemaIdFromSchemas } = await import('@hominio/zero');
			const schemasQuery = allSchemas();
			const schemasView = zero.materialize(schemasQuery);
			
			schemasView.addListener((schemasData: any) => {
				const schemasArray = Array.from(schemasData || []);
				
				// Debug: log schemas to see what we're getting
				console.log('[Charles] Found schemas:', schemasArray.length, schemasArray.map((s: any) => ({ id: s.id, name: s.name })));
				
				const foundHotelSchemaId = getHotelSchemaIdFromSchemas(schemasArray);
				
				if (!foundHotelSchemaId) {
					// More helpful error message, but keep listener active for reactive updates
					const schemaNames = schemasArray.map((s: any) => s.name).filter(Boolean);
					if (schemasArray.length === 0) {
						error = 'No schemas found. Waiting for sync...';
						loading = true; // Keep loading while waiting
					} else {
						error = `Hotel schema not found. Available schemas: ${schemaNames.join(', ') || 'none'}. Please run migration to create @hominio/hotel-v1 schema.`;
						loading = false;
					}
					// Don't destroy - keep listening for when schemas arrive
					return;
				}
				
				// Schema found! Query hotels reactively
				console.log('[Charles] Found hotel schema ID:', foundHotelSchemaId);
				
				// Destroy old hotels view if it exists
				if (hotelsView) {
					hotelsView.destroy();
				}
				
				// Now query hotels using the dynamic schema ID (reactive)
				const hotelsQuery = allDataBySchema(foundHotelSchemaId);
				hotelsView = zero.materialize(hotelsQuery);

				// Set a timeout to prevent forever-spinning loading state
				// If no data arrives within 5 seconds, assume user doesn't have access or no data
				let hasReceivedData = false;

				timeoutId = setTimeout(() => {
					if (!hasReceivedData && loading) {
						console.log('[Charles] Hotels query timeout - user may not have access or no data available');
						loading = false;
						// Don't set error - let it show empty state message
						// The listener will still fire when data arrives (even if empty)
					}
				}, 5000);

				hotelsView.addListener((data: any) => {
					hasReceivedData = true;
					if (timeoutId) {
						clearTimeout(timeoutId);
						timeoutId = null;
					}
					
					const newHotels = Array.from(data || []);
					console.log('[Charles] Hotels data received:', newHotels.length, 'hotels');
					console.log('[Charles] Hotels:', newHotels);
					hotels = newHotels;
					loading = false;
					error = null;
				});
				
				// Keep schemasView active - don't destroy, it will reactively update
			});
			} catch (err) {
				console.error('Error setting up Zero query:', err);
				error = err instanceof Error ? err.message : 'Fehler beim Laden der Hotels';
				loading = false;
			}
		})();

		return () => {
			window.removeEventListener('actionSkill', handleActionSkillEvent as EventListener);
			if (hotelsView) hotelsView.destroy();
			if (schemasView) schemasView.destroy();
			// Clear any pending timeouts
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	});

	function handleSkillClick(skillId: string) {
		console.log(`Skill clicked: ${skillId}`);
		executeSkill('charles', skillId, {});
	}

	// Use skills from config or fallback
	const skills = $derived(agentConfig?.skills || skillsFallback);
</script>

<div class="relative min-h-screen overflow-x-hidden bg-glass-gradient px-6 pt-[env(safe-area-inset-top)] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">

	<div class="relative z-10 mx-auto max-w-6xl">
		{#if showingSkillResult && skillResult && skillResultFunctionId}
			<!-- Skill Result View (replaces agent UI) -->
			<div class="pt-8 relative">
				<!-- Mobile: No GlassCard wrapper -->
				<div class="sm:hidden">
					<UIRenderer 
						functionId={skillResultFunctionId}
						resultData={skillResult}
						onClose={goBackToAgent}
					/>
				</div>
				<!-- Tablet/Desktop: With GlassCard wrapper -->
				<div class="hidden sm:block">
					<GlassCard class="p-0 sm:p-6">
						<UIRenderer 
							functionId={skillResultFunctionId}
							resultData={skillResult}
							onClose={goBackToAgent}
						/>
					</GlassCard>
				</div>
				
				<!-- Back button - bottom left, aligned with nav pill -->
				<button
					onclick={goBackToAgent}
					class="nav-action-button"
					aria-label="Back"
				>
					<svg class="nav-action-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
			</div>
		{:else}
			<!-- Main Charles View -->
			<div class="relative">
				<!-- Agent Info Card -->
				<div class="mb-8">
				<GlassCard class="overflow-hidden p-8">
					<div class="flex flex-col items-center text-center md:flex-row md:text-left md:gap-6">
						<div class="mb-4 md:mb-0">
							<svg class="w-20 h-20 text-[#2da6b4]" fill="currentColor" viewBox="0 0 24 24">
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
										<svg class="mb-3 w-10 h-10 text-[#2da6b4]" fill="currentColor" viewBox="0 0 24 24">
											{@html skill.svg}
										</svg>
									{:else}
										<div class="flex justify-center items-center mb-3 w-10 h-10 text-xl text-white bg-[#2da6b4] rounded-full">
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

			<!-- Hotels Section -->
			<div class="mb-8">
				<h2 class="mb-6 text-2xl font-bold text-center text-slate-900">Verfügbare Hotels</h2>
				
				{#if loading}
					<div class="flex relative z-10 flex-col justify-center items-center py-12">
						<LoadingSpinner />
						<p class="mt-4 text-sm font-medium text-slate-500">Hotels werden geladen...</p>
					</div>
				{:else if error}
					<div class="relative z-10 py-12 text-center">
						<Alert type="warning" class="mx-auto max-w-md">
							<p class="font-medium">Fehler</p>
							<p class="mt-1 text-sm opacity-80">{error}</p>
						</Alert>
					</div>
				{:else if hotels.length === 0}
					<div class="relative z-10 py-12 text-center">
						<GlassCard class="p-8 mx-auto max-w-md">
							<p class="text-base text-slate-500">Noch keine Hotels verfügbar. Der Administrator kann Hotels im Admin-Bereich hinzufügen.</p>
						</GlassCard>
					</div>
				{:else}
					<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{#each hotels as hotel (hotel.id)}
							{@const hotelData = hotel.data}
							<GlassCard lifted={true} class="flex relative flex-col gap-3 p-6 cursor-pointer group" role="button" tabindex="0">
								<div class="flex-1">
									<h3 class="mb-2 text-lg font-semibold tracking-tight text-slate-900">
										{hotelData.name || 'Unnamed Hotel'}
									</h3>
									{#if hotelData.address}
										<p class="mb-1 text-sm leading-relaxed text-slate-600">
											{hotelData.address}
										</p>
									{/if}
									{#if hotelData.city || hotelData.country}
										<p class="mb-3 text-sm leading-relaxed text-slate-500">
											{hotelData.city}{hotelData.city && hotelData.country ? ', ' : ''}{hotelData.country}
										</p>
									{/if}
									{#if hotelData.rating}
										<div class="mt-auto text-xs text-slate-400">
											{'⭐'.repeat(hotelData.rating)} {hotelData.rating}/5
										</div>
									{/if}
								</div>
							</GlassCard>
						{/each}
					</div>
				{/if}
			</div>
			
			<!-- Home button - bottom left, aligned with nav pill -->
			<button
				onclick={() => goto('/me')}
				class="nav-action-button"
				aria-label="Home"
			>
				<svg class="nav-action-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
			</button>
			</div>
		{/if}
	</div>
	</div>

<style>
	.nav-action-button {
		position: fixed;
		bottom: 0;
		left: 1rem;
		z-index: 1000;
		margin-bottom: max(env(safe-area-inset-bottom), 0.5rem);
		width: 48px;
		height: 48px;
		border-radius: 9999px;
		border: 1px solid var(--color-primary-800);
		background-color: var(--color-primary-800);
		backdrop-filter: blur(24px) saturate(180%);
		-webkit-backdrop-filter: blur(24px) saturate(180%);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		opacity: 0.95;
		cursor: pointer;
	}
	
	.nav-action-button:hover {
		background-color: var(--color-primary-700);
		border-color: var(--color-primary-700);
		opacity: 1;
	}
	
	.nav-action-button-icon {
		width: 1.5rem;
		height: 1.5rem;
		color: var(--color-primary-50);
	}
	
	/* Desktop only: Larger buttons to match nav pill */
	@media (min-width: 1024px) {
		.nav-action-button {
			width: 56px;
			height: 56px;
		}
		
		.nav-action-button-icon {
			width: 1.75rem;
			height: 1.75rem;
		}
	}
</style>

