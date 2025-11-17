<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	function goHome() {
		goto('/mini-apps');
	}

	function goBack() {
		window.history.length > 1 ? window.history.back() : goto('/mini-apps');
	}

	$: isHome = $page.url.pathname === '/mini-apps';
	$: isViewer = $page.url.pathname.startsWith('/mini-apps/') && $page.url.pathname !== '/mini-apps';
</script>

<nav
	class="fixed bottom-0 left-1/2 z-[1000] mb-[env(safe-area-inset-bottom)] flex -translate-x-1/2 gap-2 rounded-full border border-white/10 bg-slate-900/80 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-[20px] backdrop-saturate-[180%]"
	style="margin-bottom: max(env(safe-area-inset-bottom), 0px);"
>
	<button
		class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white/90 active:scale-95"
		on:click={goHome}
		aria-label="Home"
	>
		<img src="/logo_clean.png" alt="Home" class="h-7 w-7 object-contain" />
	</button>
	{#if isViewer}
		<button
			class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white/90 active:scale-95"
			on:click={goBack}
			aria-label="Back"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="15 18 9 12 15 6" />
			</svg>
		</button>
	{/if}
</nav>
