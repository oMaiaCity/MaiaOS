<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { GlassCard, LoadingSpinner } from '@hominio/brand';
	import { createAuthClient } from '@hominio/auth';
	import { handleActionSkill, loadVibeConfig, listVibes } from '@hominio/vibes';
	import { nanoid } from 'nanoid';
	import ActivityStreamItem from '$lib/components/ActivityStreamItem.svelte';

	const authClient = createAuthClient();
	const session = authClient.useSession();

	// Activity Stream State
	type ActivityItem = {
		id: string;
		timestamp: number;
		toolName: string;
		args: any;
		status: 'pending' | 'success' | 'error';
		result?: any;
		error?: string;
		isExpanded: boolean;
	};

	let activities = $state<ActivityItem[]>([]);
	let streamContainer: HTMLElement;
	let activityItems: Map<string, HTMLElement> = new Map();
	
	// Available vibes for empty state
	let availableVibes = $state<Array<{id: string, name: string, role: string, description: string, avatar: string, skills: any[]}>>([]);
	let vibesLoading = $state(true);

	// Track items being pushed out of view
	let itemsPushingOut = $state<Set<string>>(new Set());

	// Store element references by item ID
	let elementRefs: Record<string, HTMLElement> = $state({});

	// Sync elementRefs to activityItems Map
	$effect(() => {
		// Update activityItems whenever elementRefs changes
		for (const [id, el] of Object.entries(elementRefs)) {
			if (el) {
				activityItems.set(id, el);
			}
		}
		// Remove items that are no longer in elementRefs
		for (const id of activityItems.keys()) {
			if (!elementRefs[id]) {
				activityItems.delete(id);
			}
		}
	});

	// Smart scrolling when new activity is added
	async function scrollToNewActivity(newItemId: string) {
		await tick(); // Wait for DOM update
		await tick(); // Extra tick for collapse animation
		
		if (!streamContainer) return;
		
		const newItemEl = activityItems.get(newItemId);
		if (!newItemEl) return;
		
		if (activities.length < 2) {
			// First item - just scroll to it
			const newRect = newItemEl.getBoundingClientRect();
			const targetScroll = newRect.top + window.scrollY - 100; // 100px from top
			window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
			return;
		}
		
		const previousItemId = activities[activities.length - 2]?.id;
		const previousItemEl = previousItemId ? activityItems.get(previousItemId) : null;
		const secondLastItemId = activities.length >= 3 ? activities[activities.length - 3]?.id : null;
		const secondLastItemEl = secondLastItemId ? activityItems.get(secondLastItemId) : null;
		
		if (!previousItemEl) return;
		
		// Step 1: Mark 2nd-to-last item as pushing out and scroll it above viewport
		if (secondLastItemId && secondLastItemEl) {
			itemsPushingOut.add(secondLastItemId);
			const secondLastRect = secondLastItemEl.getBoundingClientRect();
			const scrollOffset = secondLastRect.top + window.scrollY - window.innerHeight - 50; // Push completely above viewport
			window.scrollTo({ top: Math.max(0, scrollOffset), behavior: 'smooth' });
			
			// Remove from pushing out set after animation
			setTimeout(() => {
				itemsPushingOut.delete(secondLastItemId);
			}, 600);
		}
		
		// Step 2: Wait for collapse animation (previous item is already collapsed)
		await new Promise(resolve => setTimeout(resolve, 300));
		
		// Step 3: Scroll previous (collapsed) item to top edge of viewport
		const previousRect = previousItemEl.getBoundingClientRect();
		const currentScroll = window.scrollY;
		const previousTop = previousRect.top + currentScroll;
		const targetScroll = previousTop - 100; // 100px padding from top
		
		await new Promise(resolve => {
			window.scrollTo({ 
				top: Math.max(0, targetScroll), 
				behavior: 'smooth' 
			});
			setTimeout(resolve, 400);
		});
		
		// Step 4: Ensure new item is strictly aligned to top
		await tick();
		// Wait a bit more for any internal layout changes/animations
		await new Promise(resolve => setTimeout(resolve, 100));
		
		const newRect = newItemEl.getBoundingClientRect();
		const newItemTop = newRect.top + window.scrollY;
		
		// Calculate target scroll position (top of item with padding)
		// We use a fixed padding (e.g. 100px) to leave room for header/context
		const targetScrollPosition = newItemTop - 100;
		
		window.scrollTo({ 
			top: Math.max(0, targetScrollPosition), 
			behavior: 'smooth' 
		});
	}

	async function handleToolCall(toolName: string, args: any) {
		const id = nanoid();
		const timestamp = Date.now();
		
		// Create new activity item
		const newItem: ActivityItem = {
			id,
			timestamp,
			toolName,
			args,
			status: 'pending',
			isExpanded: true // Expand new item by default
		};

		// Collapse previous items
		activities = activities.map(item => ({
			...item,
			isExpanded: false
		}));

		// Add new item to bottom
		activities = [...activities, newItem];

		// Scroll to position new activity properly
		await scrollToNewActivity(id);

		// Process the tool call
		if (toolName === 'actionSkill') {
			await processActionSkill(newItem);
		} else if (toolName === 'queryVibeContext') {
			// Just a log, mark as success immediately
			updateActivityStatus(id, 'success');
            // Auto-collapse context queries after a short delay so they don't take up space?
            // The user said "keep the 2nd last view as 'history collapsed'". 
            // Query items are small anyway.
		}
	}

	function updateActivityStatus(id: string, status: 'success' | 'error', result?: any, error?: string) {
		activities = activities.map(item => {
			if (item.id === id) {
				return { ...item, status, result, error };
			}
			return item;
		});
	}

	async function processActionSkill(item: ActivityItem) {
		try {
			const { vibeId, skillId, agentId, ...restArgs } = item.args;
			const effectiveVibeId = vibeId || agentId;
			
			if (!effectiveVibeId || !skillId) {
				throw new Error('Missing vibeId or skillId');
			}

			const userId = $session.data?.user?.id;
			
			// Execute skill
			const result = await handleActionSkill(
				{ vibeId: effectiveVibeId, skillId, args: restArgs },
				{
					userId,
					activeVibeIds: [effectiveVibeId] 
				}
			);

			if (result.success) {
				updateActivityStatus(item.id, 'success', result.data);
				
				// Send updated context back to voice session if available
				if (result.data?.calendarContext || result.data?.menuContext || result.data?.wellnessContext) {
					const contextText = result.data.calendarContext || result.data.menuContext || result.data.wellnessContext;
					const updateEvent = new CustomEvent('updateVoiceContext', {
						detail: { text: contextText }
					});
					window.dispatchEvent(updateEvent);
				}
			} else {
				console.error('[Me] Skill execution failed:', result.error);
				updateActivityStatus(item.id, 'error', undefined, result.error);
			}
		} catch (err) {
			console.error('[Me] Error executing skill:', err);
			updateActivityStatus(item.id, 'error', undefined, err instanceof Error ? err.message : 'Unknown error');
		}
	}

	// Load available vibes for empty state
	async function loadAvailableVibes() {
		try {
			const vibeIds = await listVibes();
			const vibes = await Promise.all(
				vibeIds.map(async (id) => {
					try {
						const config = await loadVibeConfig(id);
						// Create short description from skills
						let shortDesc = config.role;
						if (config.skills && config.skills.length > 0) {
							// Map skill IDs to short German descriptions
							const skillNames: Record<string, string> = {
								'show-menu': 'Menü',
								'show-wellness': 'Wellness',
								'view-calendar': 'Kalender anzeigen',
								'create-calendar-entry': 'Termine erstellen',
								'edit-calendar-entry': 'Termine bearbeiten',
								'delete-calendar-entry': 'Termine löschen'
							};
							const descs = config.skills.map(s => skillNames[s.id] || s.name).filter(Boolean);
							if (descs.length > 0) {
								shortDesc = descs.join(', ');
							}
						}
						return {
							id: config.id,
							name: config.name,
							role: config.role,
							description: shortDesc,
							avatar: config.avatar || '',
							skills: config.skills || []
						};
					} catch (err) {
						console.warn(`[Me] Failed to load vibe config for ${id}:`, err);
						return null;
					}
				})
			);
			availableVibes = vibes.filter(v => v !== null) as Array<{id: string, name: string, role: string, description: string, avatar: string, skills: any[]}>;
			vibesLoading = false;
		} catch (err) {
			console.error('[Me] Failed to load available vibes:', err);
			vibesLoading = false;
		}
	}

	onMount(() => {
		// Load available vibes
		loadAvailableVibes();

		// Listen for unified toolCall events
		const handleToolCallEvent = (event: Event) => {
			const customEvent = event as CustomEvent;
			const { toolName, args } = customEvent.detail;
			handleToolCall(toolName, args);
		};

		window.addEventListener('toolCall', handleToolCallEvent);

		// Check for pending actionSkill from sessionStorage (legacy support for navigation)
		const checkPendingActionSkill = async () => {
			try {
				const pendingStr = sessionStorage.getItem('pendingActionSkill');
				if (pendingStr) {
					const pending = JSON.parse(pendingStr);
					sessionStorage.removeItem('pendingActionSkill');
					console.log('[Me] Found pending actionSkill:', pending);
					handleToolCall('actionSkill', pending);
				}
			} catch (err) {
				console.warn('[Me] Failed to check pending actionSkill:', err);
			}
		};
		
		checkPendingActionSkill();

		return () => {
			window.removeEventListener('toolCall', handleToolCallEvent);
		};
	});

    function toggleItem(id: string) {
        activities = activities.map(item => {
            if (item.id === id) {
                return { ...item, isExpanded: !item.isExpanded };
            }
            return item;
        });
    }
</script>

<div class="relative min-h-screen bg-glass-gradient px-4 pt-[env(safe-area-inset-top)] pb-[calc(6rem+env(safe-area-inset-bottom))] flex flex-col" bind:this={streamContainer}>
	
	<!-- Activity Stream -->
	<div class="flex-1 w-full max-w-3xl mx-auto flex flex-col gap-2 min-h-[50vh] md:px-6 lg:px-8 justify-start">
		{#if activities.length === 0}
			{#if vibesLoading}
				<div class="flex flex-col items-center justify-center py-20 text-slate-400/50">
					<LoadingSpinner />
					<p class="text-sm mt-4">Loading available vibes...</p>
				</div>
			{:else if availableVibes.length > 0}
				<!-- Empty State: Instructions & Available Vibes -->
				<div class="flex flex-col gap-6 md:gap-8">
					<!-- Instructions Header -->
					<div class="text-center space-y-3 md:space-y-4">
						<h1 class="text-2xl md:text-3xl font-bold tracking-tight text-slate-900/80">Willkommen bei Hominio</h1>
						<p class="text-sm md:text-base text-slate-600 max-w-2xl mx-auto">
							Starte einfach zu sprechen, um Hominio zu nutzen. Du kannst natürlich fragen oder direkt Aufgaben stellen.
						</p>
						
						<!-- Examples -->
						<div class="mt-6 space-y-2">
							<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Beispiele:</p>
							<div class="flex flex-wrap justify-center gap-2 text-xs md:text-sm">
								<span class="px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-slate-700 border border-slate-200/50">"Zeig mir das Menü"</span>
								<span class="px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-slate-700 border border-slate-200/50">"Erstelle einen Termin morgen um 14 Uhr"</span>
								<span class="px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-slate-700 border border-slate-200/50">"Welche Wellness-Angebote gibt es?"</span>
							</div>
						</div>
					</div>

					<!-- Available Vibes Grid - Compact -->
					<div class="space-y-3 md:space-y-4">
						<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Active Vibes</p>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
						{#each availableVibes as vibe (vibe.id)}
							<GlassCard lifted={true} class="overflow-hidden relative p-3 md:p-4">
								<!-- Gradient Background -->
								<div class="absolute inset-0 bg-gradient-to-br from-secondary-400 to-secondary-500 opacity-5"></div>
								
								<!-- Compact Layout -->
								<div class="flex relative items-center gap-3">
									<!-- Avatar -->
									<img 
										src={vibe.avatar} 
										alt={vibe.name}
										class="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0"
									/>
									
									<!-- Content -->
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-1">
											<h3 class="text-sm md:text-base font-bold text-slate-900">
												{vibe.name}
											</h3>
											<span class="text-[10px] md:text-xs px-1.5 py-0.5 rounded-full bg-gradient-to-r from-secondary-400 to-secondary-500 text-white font-semibold">
												{vibe.role}
											</span>
										</div>
										<p class="text-xs text-slate-600 line-clamp-2">
											{vibe.description}
										</p>
									</div>
								</div>
							</GlassCard>
						{/each}
						</div>
					</div>
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center py-20 text-slate-400/50">
					<div class="mb-4 p-4 rounded-full bg-white/20 backdrop-blur-sm">
						<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					</div>
					<p class="text-sm">Waiting for activity...</p>
					<p class="text-xs mt-2">Ask Hominio to do something</p>
				</div>
			{/if}
		{:else}
			<!-- Header (only shown when activities exist) -->
			<div class="pt-4 pb-4 text-center">
				<h1 class="text-2xl font-bold tracking-tight text-slate-900/80">Activity Stream</h1>
				<p class="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Live Stream</p>
			</div>
			
            <!-- Render items in chronological order (newest at bottom) -->
			{#each activities as item, index (item.id)}
				<div 
					bind:this={elementRefs[item.id]}
					class="transition-all duration-500 ease-in-out"
					class:opacity-0={itemsPushingOut.has(item.id)}
					class:-translate-y-8={itemsPushingOut.has(item.id)}
					class:pointer-events-none={itemsPushingOut.has(item.id)}
				>
					<ActivityStreamItem 
						item={item} 
						isExpanded={item.isExpanded}
						onToggle={() => toggleItem(item.id)}
					/>
				</div>
			{/each}
		{/if}
	</div>
    
    <!-- Spacer for bottom nav -->
    <div class="h-12"></div>
</div>
