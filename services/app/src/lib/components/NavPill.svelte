<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createAuthClient } from '@hominio/auth';
	import { GlassPill, GlassIconButton, LoadingSpinner } from '@hominio/brand';

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
			// Clear Zero sync cache before signing out (privacy/security)
			// This removes all synced data from the device
			try {
				const { dropAllDatabases } = await import('@rocicorp/zero');
				const { dropped, errors } = await dropAllDatabases();
				if (errors && errors.length > 0) {
					console.warn('[NavPill] Some Zero databases could not be dropped:', errors);
				} else {
					console.log('[NavPill] ✅ Cleared Zero sync cache on logout');
				}
			} catch (zeroError) {
				console.error('[NavPill] Failed to clear Zero cache on logout:', zeroError);
				// Continue with logout even if cache clearing fails
			}
			
			await authClient.signOut();
			// Redirect to wallet service sign-in page
			const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
			
			// Get wallet domain - use env var or derive from current location
			let walletDomain = import.meta.env.PUBLIC_DOMAIN_WALLET;
			if (!walletDomain) {
				if (isProduction) {
					// In production, construct wallet domain from app domain
					const hostname = window.location.hostname;
					if (hostname.startsWith('app.')) {
						walletDomain = hostname.replace('app.', 'wallet.');
					} else {
						walletDomain = `wallet.${hostname.replace(/^www\./, '')}`;
					}
				} else {
					walletDomain = 'localhost:4201';
				}
			}
			walletDomain = walletDomain.replace(/^https?:\/\//, '');
			const protocol = walletDomain.startsWith('localhost') || walletDomain.startsWith('127.0.0.1') ? 'http' : 'https';
			const walletUrl = `${protocol}://${walletDomain}`;
			
			// Get app domain - use env var or derive from current location
			let appDomain = import.meta.env.PUBLIC_DOMAIN_APP;
			if (!appDomain) {
				if (isProduction) {
					appDomain = window.location.hostname;
				} else {
					appDomain = 'localhost:4202';
				}
			}
			appDomain = appDomain.replace(/^https?:\/\//, '');
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

<GlassPill class="glass-pill">
	<GlassIconButton onclick={goHome} aria-label="Home">
		<img src="/logo_clean.png" alt="Home" class="h-7 w-7 object-contain" />
	</GlassIconButton>
	{#if isAuthenticated}
		<GlassIconButton variant="danger" onclick={handleSignOut} disabled={signingOut} aria-label="Sign Out">
			{#if signingOut}
				<LoadingSpinner size="h-4 w-4" />
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
		</GlassIconButton>
	{/if}
</GlassPill>
