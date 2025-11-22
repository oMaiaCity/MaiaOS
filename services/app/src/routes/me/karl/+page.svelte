<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { GlassCard, LoadingSpinner, Alert } from '@hominio/brand';
	import { loadAgentConfig, handleActionSkill, UIRenderer } from '@hominio/agents';
	import { createAuthClient } from '@hominio/auth';

	// Load agent config
	let agentConfig = $state(null);
	let agentLoading = $state(true);
	let agentError = $state(null);

	// Agent info (fallback if config fails)
	const agent = {
		name: 'Karl',
		role: 'Calendar Assistant',
		description: 'Dein persönlicher Kalender-Assistent. Ich kann Dir helfen, Termine zu erstellen, zu bearbeiten und zu löschen.',
		color: 'from-[#45b8c8] to-[#2da6b4]' // Secondary brand color gradient (same as Charles)
	};

	// Agent skills/capabilities (fallback)
	const skillsFallback = [
		{ 
			id: 'view-calendar', 
			name: 'Kalender anzeigen', 
			description: 'Zeige die aktuelle Woche mit allen Terminen an', 
			svg: '<path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>'
		},
		{ 
			id: 'create-calendar-entry', 
			name: 'Termin erstellen', 
			description: 'Erstelle einen neuen Kalendereintrag', 
			svg: '<path d="M12 5v14m7-7H5"/>'
		},
		{ 
			id: 'edit-calendar-entry', 
			name: 'Termin bearbeiten', 
			description: 'Bearbeite einen bestehenden Kalendereintrag', 
			svg: '<path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>'
		},
		{ 
			id: 'delete-calendar-entry', 
			name: 'Termin löschen', 
			description: 'Lösche einen Kalendereintrag', 
			svg: '<path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>'
		}
	];

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
				
				// Send updated context back to voice session
				if (result.data?.calendarContext) {
					const updateEvent = new CustomEvent('updateVoiceContext', {
						detail: {
							text: result.data.calendarContext
						}
					});
					window.dispatchEvent(updateEvent);
				}
			} else {
				console.error('[Karl] Skill execution failed:', result.error);
				alert(`Fehler: ${result.error}`);
			}
		} catch (err) {
			console.error('[Karl] Error executing skill:', err);
			alert(`Fehler beim Ausführen der Funktion: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
		}
	}

	onMount(() => {
		// Load agent config
		(async () => {
			try {
				const config = await loadAgentConfig('karl');
				agentConfig = config;
				agentLoading = false;
			} catch (err) {
				console.error('[Karl] Failed to load agent config:', err);
				agentError = err instanceof Error ? err.message : 'Fehler beim Laden der Agent-Konfiguration';
				agentLoading = false;
			}
		})();

		// Listen for actionSkill events from NavPill
		const handleActionSkillEvent = async (event: Event) => {
			const customEvent = event as CustomEvent;
			const { agentId, skillId, args } = customEvent.detail;
			
			if (agentId === 'karl') {
				// Ensure agent config is loaded before executing
				if (!agentConfig) {
					// Wait for config to load
					while (!agentConfig && !agentError) {
						await new Promise((resolve) => setTimeout(resolve, 100));
					}
					if (agentError) {
						console.error('[Karl] Failed to load agent config:', agentError);
						return;
					}
				}
				executeSkill(agentId, skillId, args);
			}
		};

		window.addEventListener('actionSkill', handleActionSkillEvent);

		return () => {
			window.removeEventListener('actionSkill', handleActionSkillEvent as EventListener);
		};
	});


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
					class="nav-back-button"
					aria-label="Back"
				>
					<svg class="nav-back-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
			</div>
		{:else}
			<!-- Main Karl View -->
			<div class="relative">
				<!-- Agent Info Card -->
				<div class="mb-8">
				<GlassCard class="overflow-hidden p-8">
					<div class="flex flex-col items-center text-center md:flex-row md:text-left md:gap-6">
						<div class="mb-4 md:mb-0">
							<img 
								src="/brand/agents/karl.png" 
								alt={agentConfig?.name || agent.name}
								class="w-20 h-20 rounded-full object-cover"
							/>
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
								class="relative p-6"
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
			
			<!-- Home button - bottom left, aligned with nav pill -->
			<button
				onclick={() => goto('/me')}
				class="nav-action-button"
				aria-label="Home"
			>
				<img 
					src="/brand/logo_clean.png" 
					alt="Home"
					class="nav-action-button-icon"
				/>
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
		width: 2rem;
		height: 2rem;
		object-fit: contain;
	}
	
	/* Back button - smaller than home button */
	.nav-back-button {
		position: fixed;
		bottom: 0;
		left: 1rem;
		z-index: 1000;
		margin-bottom: max(env(safe-area-inset-bottom), 0.5rem);
		width: 40px;
		height: 40px;
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
	
	.nav-back-button:hover {
		background-color: var(--color-primary-700);
		border-color: var(--color-primary-700);
		opacity: 1;
	}
	
	.nav-back-button-icon {
		width: 1rem;
		height: 1rem;
		color: var(--color-primary-50);
	}
	
	/* Tablet and Desktop: Larger buttons to match nav pill */
	@media (min-width: 769px) {
		.nav-action-button {
			width: 56px;
			height: 56px;
		}
		
		.nav-action-button-icon {
			width: 2.5rem;
			height: 2.5rem;
		}
		
		.nav-back-button {
			width: 56px;
			height: 56px;
		}
		
		.nav-back-button-icon {
			width: 1.25rem;
			height: 1.25rem;
		}
	}
</style>

