<!--
	Show Menu UI Component
	Displays menu items sorted by categories
-->
<script>
	import { GlassCard, GlassInfoCard } from '@hominio/brand';
	
	let { data, onClose } = $props();
	
	const menu = $derived(data?.menu || {});
	const category = $derived(data?.category || 'all');
	
	const categories = [
		{ 
			id: 'appetizers', 
			name: 'Vorspeisen', 
			icon: '<path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.83l6 6V19h-2v-6H8v6H6v-7.17l6-6z"/>'
		},
		{ 
			id: 'mains', 
			name: 'Hauptgerichte', 
			icon: '<path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.20-1.10-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/>'
		},
		{ 
			id: 'desserts', 
			name: 'Nachspeisen', 
			icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.72-2.81-.01-1.65-1.38-2.35-3.65-2.85z"/>'
		},
		{ 
			id: 'drinks', 
			name: 'Getränke', 
			icon: '<path d="M6 3v6c0 2.97 2.16 5.43 5 5.91V19H8v2h8v-2h-3v-4.09c2.84-.48 5-2.94 5-5.91V3H6zm6 10c-1.86 0-3.41-1.28-3.86-3h7.72c-.45 1.72-2 3-3.86 3zm4-5H8V5h8v3z"/>'
		}
	];
	
	function formatPrice(price) {
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(price);
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold text-slate-900">Speisekarte</h2>
		{#if onClose}
			<button
				onclick={onClose}
				class="text-slate-400 hover:text-slate-600 transition-colors"
				aria-label="Close"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>
	
	{#if category === 'all'}
		<!-- Show all categories -->
		{#each categories as cat}
			{#if menu[cat.id] && menu[cat.id].length > 0}
				<div class="mb-8">
					<h3 class="mb-4 text-xl font-bold text-slate-800 flex items-center gap-2">
						<svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
							{@html cat.icon}
						</svg>
						{cat.name}
					</h3>
					<div class="grid grid-cols-1 gap-4">
						{#each menu[cat.id] as item}
							<GlassCard lifted={true} class="p-0 overflow-hidden flex">
								<div class="flex-1 p-4">
									<h4 class="font-semibold text-slate-900 mb-2">{item.name}</h4>
									<p class="text-sm text-slate-600">{item.description}</p>
								</div>
								<div class="bg-blue-500 text-white px-6 py-4 flex flex-col items-center justify-center min-w-[120px]">
									<div class="text-2xl font-bold">{formatPrice(item.price)}</div>
									{#if item.type}
										<div class="text-xs uppercase tracking-wide mt-1 opacity-90">{item.type}</div>
									{/if}
								</div>
							</GlassCard>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{:else}
		<!-- Show single category -->
		{#if menu[category] && menu[category].length > 0}
			<div>
				<h3 class="mb-4 text-xl font-bold text-slate-800 flex items-center gap-2">
					{#if categories.find(c => c.id === category)}
						<svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
							{@html categories.find(c => c.id === category).icon}
						</svg>
					{/if}
					{categories.find(c => c.id === category)?.name || category}
				</h3>
				<div class="grid grid-cols-1 gap-4">
					{#each menu[category] as item}
						<GlassCard lifted={true} class="p-0 overflow-hidden flex">
							<div class="flex-1 p-4">
								<h4 class="font-semibold text-slate-900 mb-2">{item.name}</h4>
								<p class="text-sm text-slate-600">{item.description}</p>
							</div>
							<div class="bg-blue-500 text-white px-6 py-4 flex flex-col items-center justify-center w-[140px] flex-shrink-0">
								<div class="text-2xl font-bold whitespace-nowrap">{formatPrice(item.price)}</div>
								{#if item.type}
									<div class="text-xs uppercase tracking-wide mt-1 opacity-90">{item.type}</div>
								{/if}
							</div>
						</GlassCard>
					{/each}
				</div>
			</div>
		{:else}
			<div class="text-center py-8 text-slate-500">
				Keine Artikel in dieser Kategorie gefunden.
			</div>
		{/if}
	{/if}
</div>

