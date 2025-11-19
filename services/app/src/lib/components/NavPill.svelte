<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createAuthClient } from '@hominio/auth';

	const authClient = createAuthClient();
	const session = authClient.useSession();

	function goHome() {
		goto('/me');
	}

	function goBack() {
		window.history.length > 1 ? window.history.back() : goto('/me');
	}

	let signingOut = $state(false);

	async function handleSignOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			// Redirect to wallet service sign-in page
			const walletDomain = import.meta.env.PUBLIC_DOMAIN_WALLET || 'localhost:4201';
			const protocol = walletDomain.startsWith('localhost') || walletDomain.startsWith('127.0.0.1') ? 'http' : 'https';
			const walletUrl = `${protocol}://${walletDomain}`;
			const appDomain = import.meta.env.PUBLIC_DOMAIN_APP || 'localhost:4202';
			const appProtocol = appDomain.startsWith('localhost') || appDomain.startsWith('127.0.0.1') ? 'http' : 'https';
			const appUrl = `${appProtocol}://${appDomain}`;
			const callbackUrl = `${appUrl}/me`;
			window.location.href = `${walletUrl}?callback=${encodeURIComponent(callbackUrl)}`;
		} catch (error) {
			console.error('Sign out error:', error);
			signingOut = false;
		}
	}

	const isHome = $derived($page.url.pathname === '/me');
	const isViewer = $derived(false); // No viewer pages anymore
	const isAuthenticated = $derived($session.data?.user);
</script>

<nav
	class="fixed bottom-0 left-1/2 z-[1000] mb-[env(safe-area-inset-bottom)] flex -translate-x-1/2 gap-2 rounded-full border border-white/10 bg-slate-900/80 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-[20px] backdrop-saturate-[180%] nav-pill"
	style="margin-bottom: max(env(safe-area-inset-bottom), 1rem);"
>
	<button
		class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white/90 active:scale-95"
		onclick={goHome}
		aria-label="Home"
	>
		<img src="/logo_clean.png" alt="Home" class="h-7 w-7 object-contain" />
	</button>
	{#if isAuthenticated}
		<button
			class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white/90 active:scale-95"
			onclick={handleSignOut}
			disabled={signingOut}
			aria-label="Sign Out"
		>
			{#if signingOut}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></div>
			{:else}
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
					<polyline points="16 17 21 12 16 7" />
					<line x1="21" y1="12" x2="9" y2="12" />
				</svg>
			{/if}
		</button>
	{/if}
</nav>

<style>
	.nav-pill {
		/* On desktop, add bottom padding (iOS uses safe-area-inset-bottom) */
	}

	@media (min-width: 768px) {
		.nav-pill {
			margin-bottom: max(env(safe-area-inset-bottom), 1rem) !important;
		}
	}
</style>
