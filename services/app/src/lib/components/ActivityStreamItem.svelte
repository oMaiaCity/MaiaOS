<script lang="ts">
	import { onMount } from 'svelte';
	import { UIRenderer, loadVibeConfig } from '@hominio/vibes';
	import { GlassCard, LoadingSpinner } from '@hominio/brand';
	import { slide } from 'svelte/transition';

	let { item, isExpanded = false, onToggle } = $props();

	// Derived state
	const isSkill = $derived(item.toolName === 'actionSkill');
	const isQuery = $derived(item.toolName === 'queryVibeContext');
    
    // Extract skill info
    // args structure might vary slightly based on how it was passed, handling both flat and nested
    const args = $derived(item.args || {});
    const vibeId = $derived(args.vibeId || args.agentId);
    const skillId = $derived(args.skillId);
    
    // State for collapsing
    let expanded = $state(isExpanded);
    
    // Profile image state
    let avatarUrl = $state<string | null>(null);
    let avatarLoading = $state(true);
    
    $effect(() => {
        expanded = isExpanded;
    });

	// Load vibe avatar
	$effect(() => {
		if (vibeId && isSkill) {
			avatarLoading = true;
			loadVibeConfig(vibeId)
				.then(config => {
					avatarUrl = config.avatar || null;
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
        if (onToggle) {
            onToggle();
        } else {
            expanded = !expanded;
        }
    }
</script>

<div class="transition-all duration-300 w-full" class:flex={!isSkill} class:justify-center={!isSkill}>
    {#if isSkill && skillId}
        <GlassCard class="overflow-hidden border-l-4 border-l-emerald-400" lifted={true}>
            <!-- Header / Collapsed View -->
            <button 
                class="w-full flex items-center justify-between p-4 cursor-pointer border-b border-slate-100/10 hover:bg-slate-50/30 transition-colors text-left"
                onclick={handleToggle}
            >
                <div class="flex items-center gap-3">
                    {#if avatarUrl && !avatarLoading}
                        <img 
                            src={avatarUrl} 
                            alt="{vibeId} avatar"
                            class="w-8 h-8 rounded-full object-cover shadow-sm"
                        />
                    {:else}
                        <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
                        </div>
                    {/if}
                    <div>
                        <div class="font-semibold text-slate-800 text-sm uppercase tracking-wide">{skillId}</div>
                        <div class="text-xs text-slate-500 capitalize">{vibeId} Vibe</div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-xs text-slate-400 tabular-nums">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div class="text-slate-400 transition-transform duration-300" class:rotate-180={expanded}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
            </button>

            <!-- Expanded Content -->
            {#if expanded}
                <div transition:slide={{ duration: 300 }} class="p-0 md:p-6 lg:p-8 bg-slate-50/30">
                    {#if item.status === 'pending'}
                        <div class="p-8 flex justify-center items-center">
                            <LoadingSpinner />
                        </div>
                    {:else if item.status === 'error'}
                        <div class="p-6 text-red-500 bg-red-50/50">
                            <p class="font-bold">Error executing skill</p>
                            <p class="text-sm opacity-80">{item.error}</p>
                        </div>
                    {:else if item.result}
                        <UIRenderer 
                            functionId={skillId} 
                            resultData={item.result} 
                            onClose={() => { expanded = false; }} 
                        />
                    {:else}
                        <div class="p-6 text-slate-500 text-sm text-center italic">
                            No output data available
                        </div>
                    {/if}
                </div>
            {/if}
        </GlassCard>
    {:else if isQuery}
        <!-- Compact System Log for Context Loading -->
        <div class="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/40 border border-white/50 backdrop-blur-md shadow-sm mx-auto">
            <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"></div>
                <span class="text-[11px] font-medium text-slate-600">Context: <span class="text-slate-800 font-bold capitalize">{vibeId}</span></span>
            </div>
            <div class="w-px h-3 bg-slate-300/50"></div>
            <div class="text-[10px] text-slate-400 tabular-nums font-medium">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    {:else}
        <!-- Fallback for unknown tools -->
        <div class="inline-block px-3 py-1 text-[10px] text-slate-500 bg-slate-100/50 rounded-full border border-slate-200/50 mx-auto">
            Unknown tool: {item.toolName}
        </div>
    {/if}
</div>

