<script lang="ts">
	import { onMount, tick, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { GlassCard, LoadingSpinner } from '@hominio/brand';
	import { createAuthClient } from '@hominio/auth';
	import { handleActionSkill, loadVibeConfig, listVibes } from '@hominio/vibes';
	import { nanoid } from 'nanoid';
	import ActivityStreamItem from '$lib/components/ActivityStreamItem.svelte';
	import { isQueryTool, isActionSkill, parseToolCallEvent, type ToolCallEvent } from '@hominio/voice';

	const authClient = createAuthClient();
	const session = authClient.useSession();
	
	// Get shared voice call service from layout context (same instance as NavPill uses)
	const voice = getContext('voiceCallService');

	// Activity Stream State
	type ActivityItem = {
		id: string;
		timestamp: number;
		toolName?: string;
		args?: any;
		status: 'pending' | 'success' | 'error';
		result?: any;
		error?: string;
		isExpanded: boolean;
		contextString?: string;
		// Context ingest specific fields
		type?: 'toolCall' | 'contextIngest';
		ingestType?: 'toolResponse' | 'vibeContext' | 'actionSkillResult' | 'systemMessage';
		ingestMode?: 'silent' | 'triggerAnswer';
		content?: string;
		metadata?: Record<string, any>;
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

	async function handleToolCall(toolName: string, args: any, contextString?: string, result?: any) {
		// Check if we already have a pending item for this tool call (by matching toolName + args + timestamp)
		// This prevents duplicate UI items from the same tool call
		const now = Date.now();
		const existingItem = activities.find(item => 
			item.toolName === toolName && 
			JSON.stringify(item.args) === JSON.stringify(args) &&
			Math.abs(now - item.timestamp) < 2000 // Within 2 seconds (tighter window)
		);
		
		if (existingItem) {
			// Update existing item with contextString and/or result if provided
			if (contextString !== undefined || result !== undefined) {
				activities = activities.map(item => {
					if (item.id === existingItem.id) {
						return { 
							...item, 
							contextString: contextString !== undefined ? contextString : item.contextString,
							result: result !== undefined ? result : item.result
						};
					}
					return item;
				});
			}
			return; // Don't create duplicate item
		}
		
		const id = nanoid();
		const timestamp = Date.now();
		
		
		// Create new activity item
		const newItem: ActivityItem = {
			id,
			timestamp,
			type: 'toolCall',
			toolName,
			args,
			status: 'pending',
			isExpanded: isActionSkill(toolName), // Expand skills by default, queries closed
			contextString: contextString || undefined, // Set directly - can be undefined
			result: result || undefined // Set result if available
		};
		

		// Collapse previous items ONLY if the new one is a UI item (actionSkill)
		// This prevents background queries (context/data) from closing the active UI
		if (isActionSkill(toolName)) {
			activities = activities.map(item => ({
				...item,
				isExpanded: false
			}));
		}

		// Add new item to bottom
		activities = [...activities, newItem];

		// Scroll to position new activity properly ONLY if it's a UI item
		// Background queries (context/data) should not trigger scroll/push animations
		if (isActionSkill(toolName)) {
			await scrollToNewActivity(id);
		}

		// Process the tool call
		if (isActionSkill(toolName)) {
			await processActionSkill(newItem);
		} else if (isQueryTool(toolName)) {
			// Background query - mark as success
			// contextString is already set on the item, just update status
			updateActivityStatus(id, 'success');
		}
	}

	// Handle log messages from voice service
	function handleVoiceLog(message: string, context?: string) {
		// Log messages are for context injection display
		// They can be shown in the activity stream if needed
		console.log('[Me] Voice log:', message, context ? `(context: ${context.substring(0, 100)}...)` : '');
	}

	function updateActivityStatus(id: string, status: 'success' | 'error', result?: any, error?: string) {
		activities = activities.map(item => {
			if (item.id === id) {
				// Extract contextString from result if present, otherwise keep existing
				const contextString = result?.contextString || item.contextString;
				// Remove contextString from result if it exists, to avoid duplication
				const cleanResult = result && result.contextString ? { ...result, contextString: undefined } : result;
				
				const updated = { 
					...item, 
					status, 
					result: cleanResult || item.result, 
					error,
					// Preserve contextString - prefer new one from result, otherwise keep existing
					contextString: contextString !== undefined ? contextString : item.contextString
				};
				
				return updated;
			}
			return item;
		});
	}

	async function processActionSkill(item: ActivityItem) {
		try {
			const { vibeId, skillId, ...restArgs } = item.args;
			
			if (!vibeId || !skillId) {
				throw new Error('Missing vibeId or skillId');
			}

			const userId = $session.data?.user?.id;
			
			// Execute skill
			const result = await handleActionSkill(
				{ vibeId, skillId, args: restArgs },
				{
					userId,
					activeVibeIds: [vibeId] 
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

		// Listen for unified toolCall events from voice service
		const handleToolCallEvent = (event: Event) => {
			const customEvent = event as CustomEvent;
			const toolCall = parseToolCallEvent(customEvent);
			
			if (!toolCall) {
				console.warn('[Me] Invalid tool call event');
				return;
			}
			
			const { toolName, args, contextString, result } = toolCall;
			handleToolCall(toolName, args, contextString, result);
		};

		// Listen for context ingest events from voice service
		const handleContextIngestEvent = (event: Event) => {
			const customEvent = event as CustomEvent;
			const ingestEvent = customEvent.detail;
			
			// Create activity item for context ingest
			const id = nanoid();
			const newItem: ActivityItem = {
				id,
				timestamp: ingestEvent.timestamp || Date.now(),
				type: 'contextIngest',
				ingestType: ingestEvent.type,
				ingestMode: ingestEvent.ingestMode || 'silent',
				content: ingestEvent.content,
				metadata: ingestEvent.metadata,
				toolName: ingestEvent.toolName,
				status: 'success',
				isExpanded: false // Context ingests default to collapsed
			};

			// Add to activities
			activities = [...activities, newItem];
		};

		// Listen for log events from voice service
		const handleVoiceLogEvent = (event: Event) => {
			const customEvent = event as CustomEvent;
			const { message, context } = customEvent.detail;
			handleVoiceLog(message, context);
		};

		window.addEventListener('toolCall', handleToolCallEvent);
		window.addEventListener('contextIngest', handleContextIngestEvent);
		window.addEventListener('voiceLog', handleVoiceLogEvent);

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
			window.removeEventListener('contextIngest', handleContextIngestEvent);
			window.removeEventListener('voiceLog', handleVoiceLogEvent);
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

<div class="relative min-h-screen bg-glass-gradient pt-[env(safe-area-inset-top)] pb-[calc(6rem+env(safe-area-inset-bottom))] flex flex-col" bind:this={streamContainer}>
	
	<!-- Activity Stream - Centered on Full Screen Width -->
	<div class="flex-1 w-full flex flex-col gap-2 min-h-[50vh] px-4 md:px-6 lg:px-8 lg:pr-[calc(300px+1rem)]">
		<div class="mx-auto w-full max-w-3xl">
		{#if activities.length === 0}
			{#if vibesLoading}
				<div class="flex flex-col justify-center items-center py-20 text-slate-400/50">
					<LoadingSpinner />
					<p class="mt-4 text-sm">Loading available vibes...</p>
				</div>
			{:else if availableVibes.length > 0}
				<!-- Empty State: Instructions & Available Vibes -->
				<div class="flex flex-col gap-6 md:gap-8">
					<!-- Instructions Header -->
					<div class="space-y-3 text-center md:space-y-4">
						<h1 class="text-2xl font-bold tracking-tight md:text-3xl text-slate-900/80">Willkommen bei Hominio</h1>
						<p class="mx-auto max-w-2xl text-sm md:text-base text-slate-600">
							Starte einfach zu sprechen, um Hominio zu nutzen. Du kannst natürlich fragen oder direkt Aufgaben stellen.
						</p>
						
						<!-- Examples -->
						<div class="mt-6 space-y-2">
							<p class="text-xs font-semibold tracking-wide uppercase text-slate-500">Beispiele:</p>
							<div class="flex flex-wrap gap-2 justify-center text-xs md:text-sm">
								<span class="px-3 py-1.5 rounded-full border backdrop-blur-sm bg-white/60 text-slate-700 border-slate-200/50">"Zeig mir das Menü"</span>
								<span class="px-3 py-1.5 rounded-full border backdrop-blur-sm bg-white/60 text-slate-700 border-slate-200/50">"Erstelle einen Termin morgen um 14 Uhr"</span>
								<span class="px-3 py-1.5 rounded-full border backdrop-blur-sm bg-white/60 text-slate-700 border-slate-200/50">"Welche Wellness-Angebote gibt es?"</span>
							</div>
						</div>
					</div>

					<!-- Available Vibes Grid - Compact -->
					<div class="space-y-3 md:space-y-4">
						<p class="text-xs font-semibold tracking-wide text-center uppercase text-slate-500">Active Vibes</p>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
						{#each availableVibes as vibe (vibe.id)}
							<GlassCard lifted={true} class="overflow-hidden relative p-3 md:p-4">
								<!-- Gradient Background -->
								<div class="absolute inset-0 bg-gradient-to-br opacity-5 from-secondary-400 to-secondary-500"></div>
								
								<!-- Compact Layout -->
								<div class="flex relative gap-3 items-center">
									<!-- Avatar -->
									<img 
										src={vibe.avatar} 
										alt={vibe.name}
										class="object-cover flex-shrink-0 w-10 h-10 rounded-full md:w-12 md:h-12"
									/>
									
									<!-- Content -->
									<div class="flex-1 min-w-0">
										<div class="flex gap-2 items-center mb-1">
											<h3 class="text-sm font-bold md:text-base text-slate-900">
												{vibe.name}
											</h3>
											<span class="text-[10px] md:text-xs px-1.5 py-0.5 rounded-full bg-gradient-to-r from-secondary-400 to-secondary-500 text-slate-900 font-semibold">
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
				<div class="flex flex-col justify-center items-center py-20 text-slate-400/50">
					<div class="p-4 mb-4 rounded-full backdrop-blur-sm bg-white/20">
						<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					</div>
					<p class="text-sm">Waiting for activity...</p>
					<p class="mt-2 text-xs">Ask Hominio to do something</p>
				</div>
			{/if}
		{:else}
			<!-- Header (only shown when activities exist) -->
			<div class="pt-4 pb-4 text-center">
				<h1 class="text-2xl font-bold tracking-tight text-slate-900/80">Activity Stream</h1>
				<p class="mt-1 text-xs font-medium tracking-widest uppercase text-slate-500">Live Stream</p>
			</div>
			
            <!-- Render items in chronological order (newest at bottom) -->
			{#each activities as item, index (item.id)}
				<div 
					bind:this={elementRefs[item.id]}
					class="mb-4 transition-all duration-500 ease-in-out"
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
	</div>
	
	<!-- Call Logs Sidebar - Fixed Right Aligned -->
	<aside class="hidden lg:block fixed right-0 top-[env(safe-area-inset-top)] bottom-[calc(6rem+env(safe-area-inset-bottom))] w-[300px] pr-4 pt-4 z-10">
		<GlassCard class="flex flex-col p-4 h-full">
			<div class="mb-3">
				<h2 class="mb-0.5 text-sm font-bold tracking-tight text-slate-900">Call Logs</h2>
				<p class="text-xs text-slate-600">Real-time debugging</p>
			</div>

			<!-- Logs Display - Light Theme Glass Style -->
			<div class="overflow-hidden flex-1 rounded-lg border backdrop-blur-sm border-slate-200/50 bg-white/40">
				<div class="overflow-y-auto p-3 h-full font-mono text-xs text-slate-700">
					{#each voice.logs as log}
						<div class="mb-1 leading-relaxed break-words text-slate-600">{log}</div>
					{:else}
						<div class="text-xs italic text-slate-400">No logs yet. Start a call to see logs.</div>
					{/each}
				</div>
			</div>
		</GlassCard>
	</aside>
    
    <!-- Spacer for bottom nav -->
    <div class="h-12"></div>
</div>
