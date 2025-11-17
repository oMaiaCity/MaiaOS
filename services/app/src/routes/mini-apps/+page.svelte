<script>
	import { getAllMiniApps } from '$lib/mini-apps.js';
	import { goto } from '$app/navigation';

	const apps = getAllMiniApps();

	/**
	 * @param {string} appId
	 */
	function launchApp(appId) {
		goto(`/mini-apps/${appId}`);
	}

	/**
	 * @param {KeyboardEvent & {currentTarget: HTMLElement}} event
	 */
	function handleCardKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.currentTarget.click();
		}
	}
</script>

<div
	class="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.1)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(251,191,36,0.08)_0%,transparent_50%)] before:content-['']"
>
	<div class="relative z-10 mb-12 pt-[env(safe-area-inset-top)] text-center text-white/95">
		<h1 class="mb-2 text-4xl font-bold tracking-tight md:text-5xl">Mini Apps</h1>
		<p class="text-base font-normal opacity-70">Discover and launch mini apps</p>
	</div>

	<div class="relative z-10 mx-auto grid max-w-4xl grid-cols-2 gap-3 px-4">
		{#each apps as app (app.id)}
			<div
				class="relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-[16px] border border-white/10 bg-white/5 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-[20px] backdrop-saturate-[180%] transition-all duration-300 ease-out before:absolute before:top-0 before:right-0 before:left-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:content-[''] hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/8 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] active:translate-y-0"
				on:click={() => launchApp(app.id)}
				on:keydown={handleCardKeydown}
				role="button"
				tabindex="0"
			>
				<div class="mb-1 flex items-center justify-center text-cyan-400/90">
					{@html app.icon || ''}
				</div>
				<div class="flex-1 text-center">
					<h2 class="mb-1 text-base font-semibold tracking-tight text-white/95">
						{app.name}
					</h2>
					<p class="text-xs leading-relaxed text-white/60">{app.description}</p>
				</div>
			</div>
		{/each}
	</div>

	{#if apps.length === 0}
		<div class="py-12 text-center text-base text-white/60">No mini apps available yet.</div>
	{/if}
</div>
