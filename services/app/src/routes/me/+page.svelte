<script lang="ts">
	import { onMount, tick, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { GlassCard, LoadingSpinner } from '@hominio/brand';
	import { createAuthClient } from '@hominio/auth';
	import { nanoid } from 'nanoid';
	import ActivityStreamItem from '$lib/components/ActivityStreamItem.svelte';
	import { parseToolCallEvent, type ToolCallEvent } from '@hominio/voice';

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
		// Metadata for additional item info
		metadata?: Record<string, any>;
	};

	let activities = $state<ActivityItem[]>([]);
	let streamContainer: HTMLElement;
	let activityItems: Map<string, HTMLElement> = new Map();
	

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
		// Filter out legacy tools and unknown tools - don't show them at all
		if (toolName === 'queryVibeContext' || toolName === 'actionSkill' || toolName === 'delegateIntent' || !toolName || toolName === 'unknown') {
			// Silently ignore legacy/unknown tool calls
			return;
		}
		
		// Only handle queryTodos and createTodo
		if (toolName !== 'queryTodos' && toolName !== 'createTodo') {
			return;
		}
		
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
							result: result !== undefined ? result : item.result,
							status: result?.success === false ? 'error' : (result?.success ? 'success' : item.status)
						};
					}
					return item;
				});
				// Process the updated item to load UI component
				const updatedItem = activities.find(item => item.id === existingItem.id);
				if (updatedItem) {
					await processTodoToolCall(updatedItem);
				}
			}
			return; // Don't create duplicate item
		}
		
		const id = nanoid();
		const timestamp = Date.now();
		
		// Collapse all existing items before adding new one
		activities = activities.map(item => ({ ...item, isExpanded: false }));
		
		// Create new activity item
		const newItem: ActivityItem = {
			id,
			timestamp,
			toolName,
			args,
			status: 'pending',
			isExpanded: true, // Expand by default to show UI component
			contextString: contextString || undefined,
			result: result || undefined
		};
		
		// Add new item to bottom
		activities = [...activities, newItem];

		// Scroll to new activity
		await scrollToNewActivity(id);

		// Process the tool call to load UI component
		await processTodoToolCall(newItem);
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

	async function processTodoToolCall(item: ActivityItem) {
		try {
			const { toolName, result: toolResult } = item;
			
			// If we already have a result from the tool call, use it
			if (toolResult) {
				// Result is already processed by the tool handler
				updateActivityStatus(item.id, toolResult.success === false ? 'error' : 'success', toolResult);
				return;
			}
			
			// Otherwise, call handler directly to get fresh data from store
			const { loadFunction } = await import('@hominio/vibes');
			
			if (toolName === 'queryTodos') {
				const func = await loadFunction('query-todos');
				const result = await func.handler({});
				
				if (result.success) {
					// Even if todos array is empty, this is still success - TodoView will show empty state
					updateActivityStatus(item.id, 'success', result.data);
				} else {
					updateActivityStatus(item.id, 'error', undefined, result.error);
				}
			} else if (toolName === 'createTodo') {
				const title = item.args?.title;
				
				if (!title) {
					updateActivityStatus(item.id, 'error', undefined, 'Title parameter is required');
					return;
				}
				
				const func = await loadFunction('create-todo');
				const result = await func.handler({ title });
				
				if (result.success) {
					updateActivityStatus(item.id, 'success', result.data);
				} else {
					updateActivityStatus(item.id, 'error', undefined, result.error);
				}
			}
		} catch (err) {
			console.error('[Me] Error executing todo tool call:', err);
			updateActivityStatus(item.id, 'error', undefined, err instanceof Error ? err.message : 'Unknown error');
		}
	}


	onMount(() => {
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


		// Track Kai tasks for real-time updates



		window.addEventListener('toolCall', handleToolCallEvent);

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

<div class="relative min-h-screen bg-glass-gradient pt-[env(safe-area-inset-top)] pb-[calc(6rem+env(safe-area-inset-bottom))] flex flex-col" bind:this={streamContainer}>
	
	<!-- Activity Stream - Centered on Full Screen Width -->
	<div class="flex-1 w-full flex flex-col gap-2 min-h-[50vh] px-4 md:px-6 lg:px-8 lg:pr-[calc(300px+1rem)]">
		<div class="mx-auto w-full max-w-3xl">
		{#if activities.length === 0}
			<!-- Empty State: Instructions -->
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
							<span class="px-3 py-1.5 rounded-full border backdrop-blur-sm bg-white/60 text-slate-700 border-slate-200/50">"Zeige mir meine Todos"</span>
							<span class="px-3 py-1.5 rounded-full border backdrop-blur-sm bg-white/60 text-slate-700 border-slate-200/50">"Erstelle ein Todo 'Einkaufen gehen'"</span>
							<span class="px-3 py-1.5 rounded-full border backdrop-blur-sm bg-white/60 text-slate-700 border-slate-200/50">"Füge 'Meeting vorbereiten' zur Todo-Liste hinzu"</span>
						</div>
					</div>
				</div>
			</div>
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
					{#each (voice as any).logs as log}
						<div class="mb-1 leading-relaxed wrap-break-word text-slate-600">{log}</div>
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
