<script lang="ts">
	import { goto } from '$app/navigation';
	import { GlassCard, BackgroundBlobs } from '@hominio/brand';

	// Hardcoded agents list - can be expanded later
	const agents = [
		{
			id: 'charles',
			name: 'Charles',
			role: 'Hotel Concierge',
			description: 'Your personal AI hotel concierge assistant. Charles helps you with bookings, recommendations, and all your hotel needs.',
			color: 'from-blue-400 to-cyan-400'
		}
		// Add more agents here later
	];

	function openAgent(agentId: string) {
		goto(`/me/${agentId}`);
	}
</script>

<div class="relative min-h-screen overflow-x-hidden bg-glass-gradient px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
	<BackgroundBlobs />

	<div class="relative z-10 mb-12 pt-[env(safe-area-inset-top)] text-center">
		<h1 class="mb-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">My Agents</h1>
		<p class="text-base font-normal text-slate-600">Choose an AI assistant to help you</p>
	</div>

	<!-- Agents Grid -->
	<div class="relative z-10 mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
		{#each agents as agent (agent.id)}
			<GlassCard 
				lifted={true} 
				class="group relative cursor-pointer overflow-hidden p-8 transition-all duration-300 hover:scale-105" 
				role="button" 
				tabindex="0"
				onclick={() => openAgent(agent.id)}
				onkeydown={(e) => e.key === 'Enter' && openAgent(agent.id)}
			>
				<!-- Gradient Background -->
				<div class="absolute inset-0 bg-gradient-to-br {agent.color} opacity-5 transition-opacity group-hover:opacity-10"></div>
				
				<!-- Content -->
				<div class="relative flex flex-col items-center text-center">
					<!-- Icon -->
					<div class="mb-4">
						<svg class="h-16 w-16 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.83l6 6V19h-2v-6H8v6H6v-7.17l6-6z"/>
						</svg>
					</div>
					
					<!-- Name -->
					<h2 class="mb-2 text-2xl font-bold text-slate-900">
						{agent.name}
					</h2>
					
					<!-- Role -->
					<div class="mb-4 inline-block rounded-full bg-gradient-to-r {agent.color} px-4 py-1 text-sm font-semibold text-white">
						{agent.role}
					</div>
					
					<!-- Description -->
					<p class="text-sm leading-relaxed text-slate-600">
						{agent.description}
					</p>
					
					<!-- Arrow indicator -->
					<div class="mt-6 flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors group-hover:text-slate-600">
						<span>Open Agent</span>
						<svg class="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</div>
				</div>
			</GlassCard>
		{/each}
	</div>
</div>
