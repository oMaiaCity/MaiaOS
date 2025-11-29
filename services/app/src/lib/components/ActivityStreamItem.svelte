<script lang="ts">
	import { UIRenderer, loadVibeConfig } from '@hominio/vibes';
	import { GlassCard, LoadingSpinner } from '@hominio/brand';
	import { slide } from 'svelte/transition';
	import { isQueryTool, isActionSkill } from '@hominio/voice';

	let { item, isExpanded = false, onToggle } = $props();

    // Derived state
	const isSkill = $derived(item.toolName ? isActionSkill(item.toolName) : false);
	const isQuery = $derived(item.toolName ? isQueryTool(item.toolName) : false);
	const isContextIngest = $derived(item.type === 'contextIngest');
    
    // Extract skill info
    // args structure might vary slightly based on how it was passed, handling both flat and nested
    const args = $derived(item.args || {});
    const vibeId = $derived(args.vibeId);
    const skillId = $derived(args.skillId);
    
    
    // State for collapsing - queries default to closed, skills default to expanded
    // Component manages its own state independently after initialization
    // Initialize based on tool type: queries default to closed, skills default to expanded
    const initialExpanded = isQuery ? false : isExpanded;
    let expanded = $state(initialExpanded);
    let lastPropValue = $state(isExpanded);
    let hasUserToggled = $state(false);
    
    // Profile image state
    let avatarUrl = $state<string | null>(null);
    let avatarLoading = $state(true);
    
    // Sync expanded state with props only when prop changes externally (not from our toggle)
    // This handles cases like collapsing all items when a new skill is added
    $effect(() => {
        // Only sync if prop changed externally AND user hasn't manually toggled this item
        if (!hasUserToggled && isExpanded !== lastPropValue) {
            lastPropValue = isExpanded;
            // For queries, only sync if explicitly set to false (collapsing all)
            // For skills, always sync with prop
            if (isQuery) {
                // Only collapse queries if prop is explicitly false (external collapse)
                if (!isExpanded) {
                    expanded = false;
                }
            } else {
                expanded = isExpanded;
            }
        }
    });

	// Load vibe avatar
	$effect(() => {
		if (vibeId && isSkill) {
			avatarLoading = true;
			loadVibeConfig(vibeId)
				.then(config => {
					// Avatar exists in config but not in TypeScript type definition
					const configWithAvatar = config as any;
					avatarUrl = configWithAvatar.avatar || null;
					avatarLoading = false;
				})
				.catch(err => {
					console.warn('[ActivityStreamItem] Failed to load vibe config:', err);
					avatarUrl = null;
					avatarLoading = false;
				});
		} else {
			avatarUrl = null;
			avatarLoading = false;
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

<div class="w-full transition-all duration-300" class:flex={!isSkill} class:justify-center={!isSkill}>
    {#if isSkill && skillId}
        <GlassCard class="overflow-hidden border-l-4 border-l-emerald-400" lifted={true}>
            <!-- Header / Collapsed View -->
            <button 
                class="flex justify-between items-center p-4 w-full text-left border-b transition-colors cursor-pointer border-slate-100/10 hover:bg-slate-50/30"
                onclick={handleToggle}
            >
                <div class="flex gap-3 items-center">
                    {#if avatarUrl && !avatarLoading}
                        <img 
                            src={avatarUrl} 
                            alt="{vibeId} avatar"
                            class="object-cover w-8 h-8 rounded-full shadow-sm"
                        />
                    {:else}
                        <div class="flex justify-center items-center w-8 h-8 text-emerald-600 bg-emerald-100 rounded-full shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
                        </div>
                    {/if}
                    <div>
                        <div class="text-sm font-semibold tracking-wide uppercase text-slate-800">{skillId}</div>
                        <div class="text-xs capitalize text-slate-500">{vibeId} Vibe</div>
                    </div>
                </div>
                <div class="flex gap-3 items-center">
                    <div class="text-xs tabular-nums text-slate-400">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div class="transition-transform duration-300 text-slate-400" class:rotate-180={expanded}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
            </button>

            <!-- Expanded Content -->
            {#if expanded}
                <div transition:slide={{ duration: 300 }} class="p-4 md:p-6 lg:p-8 bg-slate-50/30">
                    {#if item.status === 'pending'}
                        <div class="flex justify-center items-center p-8">
                            <LoadingSpinner />
                        </div>
                    {:else if item.status === 'error'}
                        <div class="p-6 text-red-500 bg-red-50/50">
                            <p class="font-bold">Error executing skill</p>
                            <p class="text-sm opacity-80">{item.error}</p>
                        </div>
                    {:else if item.result}
                        <div class="pt-4 pb-2">
                            <UIRenderer 
                                functionId={skillId} 
                                resultData={item.result} 
                                onClose={() => { expanded = false; }} 
                            />
                        </div>
                    {:else}
                        <div class="p-6 text-sm italic text-center text-slate-500">
                            No output data available
                        </div>
                    {/if}
                </div>
            {/if}
        </GlassCard>
    {:else if isQuery}
        <!-- Expandable Context Query Item -->
        <GlassCard class="overflow-hidden border-l-4 border-l-blue-400" lifted={true}>
            <!-- Header / Collapsed View -->
            <button 
                class="flex justify-between items-center px-4 py-2 w-full text-left border-b transition-colors cursor-pointer border-slate-100/10 hover:bg-slate-50/30"
                onclick={handleToggle}
            >
                <div class="flex gap-3 items-center">
                    <div class="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"></div>
                    {#if isQuery}
                        <span class="text-[11px] font-medium text-slate-600">Context: <span class="font-bold capitalize text-slate-800">{vibeId}</span></span>
                    {/if}
                </div>
                <div class="flex gap-3 items-center">
                    <div class="text-[10px] text-slate-400 tabular-nums font-medium">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div class="transition-transform duration-300 text-slate-400" class:rotate-180={expanded}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
            </button>

            <!-- Expanded Content - Show Ingested Context -->
            {#if expanded}
                <div transition:slide={{ duration: 300 }} class="p-4 bg-slate-50/30">
                    <div class="space-y-4">
                        <div>
                            <h4 class="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-700">Tool Call Args</h4>
                            <pre class="overflow-x-auto p-3 text-xs rounded border bg-slate-50 border-slate-200">{JSON.stringify(args, null, 2)}</pre>
                        </div>
                        {#if item.contextString}
                            <div>
                                <h4 class="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-700">Ingested Context String</h4>
                                <pre class="overflow-x-auto overflow-y-auto p-3 max-h-96 text-xs whitespace-pre-wrap rounded border bg-slate-50 border-slate-200">{item.contextString}</pre>
                            </div>
                        {/if}
                        {#if isQuery && item.result?.contextConfig}
                            <div>
                                <h4 class="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-700">Vibe Config (JSON)</h4>
                                <pre class="overflow-x-auto overflow-y-auto p-3 max-h-96 text-xs rounded border bg-slate-50 border-slate-200">{JSON.stringify(item.result.contextConfig, null, 2)}</pre>
                            </div>
                        {/if}
                        {#if item.result && Object.keys(item.result).length > 0}
                            <div>
                                <h4 class="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-700">Result (JSON)</h4>
                                <pre class="overflow-x-auto overflow-y-auto p-3 max-h-96 text-xs rounded border bg-slate-50 border-slate-200">{JSON.stringify(item.result, null, 2)}</pre>
                            </div>
                        {/if}
                        {#if !item.contextString && (!item.result || Object.keys(item.result || {}).length === 0)}
                            <div class="py-2 text-xs italic text-center text-slate-400">
                                No context or result data available
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </GlassCard>
    {:else if isContextIngest}
        <!-- Context Ingest Item -->
        <GlassCard class="overflow-hidden border-l-4 border-l-purple-400" lifted={true}>
            <!-- Header / Collapsed View -->
            <button 
                class="flex justify-between items-center px-4 py-2 w-full text-left border-b transition-colors cursor-pointer border-slate-100/10 hover:bg-slate-50/30"
                onclick={handleToggle}
            >
                <div class="flex gap-3 items-center">
                    <div class="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[11px] font-medium text-slate-600">
                            {item.ingestType === 'toolResponse' && 'Tool Response'}
                            {item.ingestType === 'vibeContext' && 'Vibe Context'}
                            {item.ingestType === 'actionSkillResult' && 'Action Skill Result'}
                            {item.ingestType === 'systemMessage' && 'System Message'}
                            {!item.ingestType && 'Context Ingest'}
                        </span>
                        {#if item.toolName}
                            <span class="text-[10px] text-slate-500">{item.toolName}</span>
                        {/if}
                    </div>
                    {#if item.ingestMode}
                        <span class="text-[9px] px-1.5 py-0.5 rounded-full {item.ingestMode === 'silent' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}">
                            {item.ingestMode === 'silent' ? 'Silent' : 'Trigger Answer'}
                        </span>
                    {/if}
                </div>
                <div class="flex gap-3 items-center">
                    <div class="text-[10px] text-slate-400 tabular-nums font-medium">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div class="transition-transform duration-300 text-slate-400" class:rotate-180={expanded}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
            </button>

            <!-- Expanded Content -->
            {#if expanded}
                <div transition:slide={{ duration: 300 }} class="p-4 bg-slate-50/30">
                    <div class="space-y-4">
                        {#if item.metadata}
                            <div>
                                <h4 class="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-700">Metadata</h4>
                                <pre class="overflow-x-auto p-3 text-xs rounded border bg-slate-50 border-slate-200">{JSON.stringify(item.metadata, null, 2)}</pre>
                            </div>
                        {/if}
                        {#if item.content}
                            <div>
                                <h4 class="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-700">Content</h4>
                                <pre class="overflow-x-auto overflow-y-auto p-3 max-h-96 text-xs whitespace-pre-wrap rounded border bg-slate-50 border-slate-200">{item.content}</pre>
                            </div>
                        {/if}
                        {#if !item.content && !item.metadata}
                            <div class="py-2 text-xs italic text-center text-slate-400">
                                No content available
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </GlassCard>
    {:else}
        <!-- Fallback for unknown tools -->
        <div class="inline-block px-3 py-1 text-[10px] text-slate-500 bg-slate-100/50 rounded-full border border-slate-200/50 mx-auto">
            Unknown tool: {item.toolName || 'unknown'}
        </div>
    {/if}
</div>

