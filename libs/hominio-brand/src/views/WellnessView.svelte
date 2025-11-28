<!--
	Show Wellness UI Component
	Displays wellness/spa services sorted by categories
-->
<script>
	import GlassCard from '../components/GlassCard.svelte';
	
	let { data, onClose } = $props();
	
	const wellness = $derived(data?.wellness || {});
	const category = $derived(data?.category || 'all');
	
	const categories = [
		{ 
			id: 'massages', 
			name: 'Massagen', 
			icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>'
		},
		{ 
			id: 'treatments', 
			name: 'Behandlungen', 
			icon: '<path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.20-1.10-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/>'
		},
		{ 
			id: 'packages', 
			name: 'Pakete', 
			icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>'
		},
		{ 
			id: 'facilities', 
			name: 'Einrichtungen', 
			icon: '<path d="M6 3v6c0 2.97 2.16 5.43 5 5.91V19H8v2h8v-2h-3v-4.09c2.84-.48 5-2.94 5-5.91V3H6zm6 10c-1.86 0-3.41-1.28-3.86-3h7.72c-.45 1.72-2 3-3.86 3zm4-5H8V5h8v3z"/>'
		}
	];
	
	function formatPrice(price) {
		return new Intl.NumberFormat('de-DE', {
			style: 'currency',
			currency: 'EUR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(price).replace(/\s€/, '€');
	}
</script>


<div>
	<div class="flex justify-center items-center mb-8">
		<h2 class="text-2xl font-extrabold tracking-tight text-center text-transparent bg-clip-text bg-gradient-to-br sm:text-3xl from-[var(--color-secondary-400)] to-[var(--color-secondary-500)]">Wellness & Spa</h2>
	</div>
	
	{#if category === 'all'}
		<!-- Show all categories -->
		{#each categories as cat}
			{#if wellness[cat.id] && wellness[cat.id].length > 0}
				<div class="mb-8">
					<h3 class="mb-4 text-lg font-bold text-center sm:text-xl text-[var(--color-secondary-500)]">
						{cat.name}
					</h3>
					<div class="grid grid-cols-1 gap-3 sm:gap-4">
						{#each wellness[cat.id] as item}
							<GlassCard lifted={true} class="flex overflow-hidden items-stretch p-0 rounded-2xl border-0 shadow-lg backdrop-blur-md bg-white/70">
								<div class="flex flex-col flex-1 flex-shrink justify-center p-4 min-w-0 sm:p-5">
									<h4 class="mb-1.5 text-base font-bold leading-tight sm:text-lg text-slate-800 sm:mb-2">{item.name}</h4>
									{#if item.description}
										<p class="text-xs leading-relaxed sm:text-sm text-slate-600 mb-1">{item.description}</p>
									{/if}
									{#if item.duration}
										<p class="text-xs italic sm:text-sm text-slate-500">{item.duration}</p>
									{/if}
								</div>
								<div class="w-[120px] sm:w-[160px] min-w-[120px] sm:min-w-[160px] max-w-[120px] sm:max-w-[160px] bg-secondary-500 border-l-2 border-secondary-400/40 px-4 sm:px-6 py-4 sm:py-5 flex flex-col items-end justify-center flex-shrink-0">
									<div class="mb-1 text-lg font-extrabold text-right text-white whitespace-nowrap sm:text-2xl">{formatPrice(item.price)}</div>
									{#if item.type}
										<div class="text-[0.7rem] sm:text-xs uppercase tracking-wider text-white/90 text-right font-semibold">{item.type}</div>
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
		{#if wellness[category] && wellness[category].length > 0}
			<div>
				<h3 class="mb-4 text-lg font-bold text-center sm:text-xl text-secondary-500">
					{categories.find(c => c.id === category)?.name || category}
				</h3>
				<div class="grid grid-cols-1 gap-3 sm:gap-4">
					{#each wellness[category] as item}
						<GlassCard lifted={true} class="flex overflow-hidden items-stretch p-0 rounded-2xl border-0 shadow-lg backdrop-blur-md bg-white/70">
							<div class="flex flex-col flex-1 flex-shrink justify-center p-4 min-w-0 sm:p-5">
								<h4 class="mb-1.5 text-base font-bold leading-tight sm:text-lg text-slate-800 sm:mb-2">{item.name}</h4>
								{#if item.description}
									<p class="text-xs leading-relaxed sm:text-sm text-slate-600 mb-1">{item.description}</p>
								{/if}
								{#if item.duration}
									<p class="text-xs italic sm:text-sm text-slate-500">{item.duration}</p>
								{/if}
							</div>
							<div class="w-[120px] sm:w-[160px] min-w-[120px] sm:min-w-[160px] max-w-[120px] sm:max-w-[160px] bg-[var(--color-secondary-500)] px-4 sm:px-6 py-4 sm:py-5 flex flex-col items-end justify-center flex-shrink-0">
								<div class="mb-1 text-lg font-extrabold text-right text-white whitespace-nowrap sm:text-2xl">{formatPrice(item.price)}</div>
								{#if item.type}
									<div class="text-[0.7rem] sm:text-xs uppercase tracking-wider text-white/90 text-right font-semibold">{item.type}</div>
								{/if}
							</div>
						</GlassCard>
					{/each}
				</div>
			</div>
		{:else}
			<div class="py-8 text-center text-slate-500">
				Keine Dienstleistungen in dieser Kategorie gefunden.
			</div>
		{/if}
	{/if}
</div>

