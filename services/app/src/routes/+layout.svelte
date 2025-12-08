<script lang="ts">
	import '../app.css';
	import { LoadingSpinner, Favicon, Footer } from '@hominio/brand';
	import NavPill from '$lib/components/NavPill.svelte';
	import { page } from '$app/stores';
	// TODO: @hominio/auth and @hominio/zero packages are deprecated and removed
	// Need to re-implement auth/zero functionality or remove it entirely
	// import { createAuthClient } from '@hominio/auth';
	import { Zero } from '@rocicorp/zero';
	import { nanoid } from 'nanoid';
	// import { schema, createMutators } from '@hominio/zero';
	import { onMount, setContext } from 'svelte';
	import { browser } from '$app/environment';
	import { env as publicEnv } from '$env/dynamic/public';
	import { createVoiceCallService } from '@hominio/voice';

	let { children } = $props();

	// TODO: Auth functionality disabled - @hominio/auth package removed
	// Use BetterAuth's reactive session hook (client-side only)
	// This uses nano-store and automatically updates when auth state changes
	// See: https://www.better-auth.com/docs/integrations/svelte-kit
	// const authClient = createAuthClient();
	// const session = authClient.useSession();
	const session = { isPending: $state(false), data: { user: null } };

	// Shared voice call service (used by NavPill and /me route)
	const voiceCallService = createVoiceCallService();

	// Zero client state
	let zero: any = $state(null);
	let zeroReady = $state(false);
	let zeroError: string | null = $state(null);

	// Get Zero server URL
	// In dev: http://localhost:4848
	// In production: use PUBLIC_DOMAIN_SYNC or default to sync.{root-domain}
	const zeroServerUrl = browser
		? (() => {
				// Check if we're in dev (localhost)
				if (
					window.location.hostname === 'localhost' ||
					window.location.hostname === '127.0.0.1'
				) {
					return 'http://localhost:4848';
				}
				// Production: use env var or construct from root domain
				let syncDomain = publicEnv.PUBLIC_DOMAIN_SYNC;
				if (!syncDomain) {
					// Extract root domain by removing subdomain prefixes (app., www., etc.)
					const hostname = window.location.hostname;
					const rootDomain = hostname.replace(/^(www|app|wallet|api|sync|website)\./, '');
					syncDomain = `sync.${rootDomain}`;
				}
				return `https://${syncDomain}`;
			})()
		: 'http://localhost:4848';

	// Get API URL for get-queries and push endpoints
	function getApiUrl() {
		const isProduction = browser && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
		let apiDomain = publicEnv.PUBLIC_DOMAIN_API || (isProduction ? 'api.hominio.me' : 'localhost:4204');
		apiDomain = apiDomain.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
		const protocol = apiDomain.startsWith('localhost') || apiDomain.startsWith('127.0.0.1') ? 'http' : 'https';
		return `${protocol}://${apiDomain}`;
	}

	// Initialize Zero client
	onMount(() => {
		if (!browser) return; // Only run on client

		let initZero = async () => {
			try {
				// Wait for session to load
				while ($session.isPending) {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}

				// Use logged-in user ID or anonymous
				const userId = $session.data?.user?.id || `anon-${nanoid()}`;

				// Validate server URL
				if (
					!zeroServerUrl ||
					(!zeroServerUrl.startsWith('http://') &&
						!zeroServerUrl.startsWith('https://') &&
						!zeroServerUrl.startsWith('ws://') &&
						!zeroServerUrl.startsWith('wss://'))
				) {
					const error = `Invalid Zero server URL: "${zeroServerUrl}". Must start with http://, https://, ws://, or wss://`;
					console.error('[Zero]', error);
					zeroError = error;
					zeroReady = false;
					return;
				}

				const apiUrl = getApiUrl();

				// TODO: Zero schema and mutators disabled - @hominio/zero package removed
				zero = new Zero({
					server: zeroServerUrl,
					// schema,
					userID: userId,
					// Register custom mutators for writes
					// mutators: createMutators(undefined), // AuthData passed to mutators at runtime
					// Configure synced queries endpoint (uses cookie-based auth)
					getQueriesURL: browser ? `${apiUrl}/api/v0/zero/get-queries` : undefined,
					// Configure custom mutators endpoint (uses cookie-based auth)
					mutateURL: browser ? `${apiUrl}/api/v0/zero/push` : undefined,
					// ⚠️ NO AUTH FUNCTION - we use cookie-based auth only
					// Cookies are automatically forwarded by zero-cache
				});

				zeroReady = true;
				zeroError = null;
			} catch (error) {
				console.error('[Zero] Initialization error:', error);
				zeroError = error instanceof Error ? error.message : 'Unknown error';
				zeroReady = false;
			}
		};

		initZero();
	});

	// Provide Zero context to child components
	setContext('zero', {
		getInstance: () => zero,
		isReady: () => zeroReady,
		getError: () => zeroError,
		getServerUrl: () => zeroServerUrl,
	});

	// Provide shared voice call service to child components
	setContext('voiceCallService', voiceCallService);

	// Reactive check: redirect to signin if not authenticated (except on signin page)
	$effect(() => {
		// No need to skip signin page - it's now on wallet service

		// Wait for session to load
		if ($session.isPending) {
			return;
		}

		// If not authenticated, redirect to wallet service sign-in
		if (!$session.data?.user) {
			const redirectUrl = $page.url.pathname + $page.url.search;
			
			// Get app domain - use env var or derive from current location
			const isProduction = browser && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
			let appDomain = publicEnv.PUBLIC_DOMAIN_APP;
			if (!appDomain) {
				if (isProduction) {
					// In production, use current hostname if env var not set
					appDomain = window.location.hostname;
				} else {
					// Development fallback
					appDomain = 'localhost:4202';
				}
			}
			// Remove protocol if present
			appDomain = appDomain.replace(/^https?:\/\//, '');
			const protocol = appDomain.startsWith('localhost') || appDomain.startsWith('127.0.0.1') ? 'http' : 'https';
			const appUrl = `${protocol}://${appDomain}`;
			const callbackUrl = `${appUrl}${redirectUrl}`;
			
			// Get wallet domain - use env var or derive from current location
			let walletDomain = publicEnv.PUBLIC_DOMAIN_WALLET;
			if (!walletDomain) {
				if (isProduction) {
					// In production, construct wallet domain from app domain
					// e.g., app.hominio.me -> wallet.hominio.me
					const hostname = window.location.hostname;
					if (hostname.startsWith('app.')) {
						walletDomain = hostname.replace('app.', 'wallet.');
					} else {
						// Fallback: use wallet subdomain
						walletDomain = `wallet.${hostname.replace(/^www\./, '')}`;
					}
				} else {
					// Development fallback
					walletDomain = 'localhost:4201';
				}
			}
			// Remove protocol if present
			walletDomain = walletDomain.replace(/^https?:\/\//, '');
			const walletProtocol = walletDomain.startsWith('localhost') || walletDomain.startsWith('127.0.0.1') ? 'http' : 'https';
			const walletUrl = `${walletProtocol}://${walletDomain}`;
			window.location.href = `${walletUrl}?callback=${encodeURIComponent(callbackUrl)}`;
		}
	});
</script>

<Favicon />

{#if $session.isPending}
	<div class="flex flex-col justify-center items-center pt-6 min-h-screen font-sans bg-glass-gradient text-slate-800">
		<div class="flex relative flex-col items-center">
			<LoadingSpinner />
			<p class="mt-4 text-sm font-medium text-slate-500">Checking authentication...</p>
		</div>
	</div>
{:else if !$session.data?.user}
	<!-- Redirecting... (handled by $effect above) -->
	<div class="flex flex-col justify-center items-center pt-6 min-h-screen font-sans bg-glass-gradient text-slate-800">
		<div class="flex relative flex-col items-center">
			<LoadingSpinner />
			<p class="mt-4 text-sm font-medium text-slate-500">Redirecting...</p>
		</div>
	</div>
{:else}
<div class="pt-6 min-h-screen font-sans antialiased bg-glass-gradient text-slate-800">
	{@render children()}
	<Footer />
	{#if $page.url.pathname !== '/'}
	<NavPill />
	{/if}
</div>
{/if}
