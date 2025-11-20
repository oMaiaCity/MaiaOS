<script>
	import { createAuthClient } from '@hominio/auth';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';

	const authClient = createAuthClient();
	const session = authClient.useSession();
	let signingIn = $state(false);

	// Get callback URL from query parameter
	// Format: ?callback=https://app.hominio.me/me
	function getCallbackUrl() {
		if (!browser) return null;
		const callback = $page.url.searchParams.get('callback');
		if (!callback) return null;
		
		// Validate callback URL is from a trusted origin
		try {
			const callbackUrl = new URL(callback);
			const callbackOrigin = `${callbackUrl.protocol}//${callbackUrl.host}`;
			
			// Get trusted origins from environment (matches server-side trusted origins)
			const env = import.meta.env;
			const isProduction = browser && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
			
			// Build trusted origins array - use env vars or derive from current location
			const domains = [];
			
			// Add domains from env vars if set, otherwise derive from current location in production
			if (env.PUBLIC_DOMAIN_ROOT) {
				domains.push(env.PUBLIC_DOMAIN_ROOT);
			} else if (isProduction) {
				const hostname = window.location.hostname;
				if (hostname.startsWith('www.')) {
					domains.push(hostname.replace('www.', ''));
				} else {
					domains.push(hostname);
				}
			} else {
				domains.push('localhost:4200');
			}
			
			if (env.PUBLIC_DOMAIN_APP) {
				domains.push(env.PUBLIC_DOMAIN_APP);
			} else if (isProduction) {
				const hostname = window.location.hostname;
				domains.push(hostname.startsWith('app.') ? hostname : `app.${hostname.replace(/^www\./, '')}`);
			} else {
				domains.push('localhost:4202');
			}
			
			if (env.PUBLIC_DOMAIN_WALLET) {
				domains.push(env.PUBLIC_DOMAIN_WALLET);
			} else if (isProduction) {
				const hostname = window.location.hostname;
				domains.push(hostname.startsWith('wallet.') ? hostname : `wallet.${hostname.replace(/^www\./, '')}`);
			} else {
				domains.push('localhost:4201');
			}
			
			if (env.PUBLIC_DOMAIN_SYNC) {
				domains.push(env.PUBLIC_DOMAIN_SYNC);
			} else if (isProduction) {
				const hostname = window.location.hostname;
				domains.push(hostname.startsWith('sync.') ? hostname : `sync.${hostname.replace(/^www\./, '')}`);
			} else {
				domains.push('localhost:4203');
			}
			
			if (env.PUBLIC_DOMAIN_API) {
				domains.push(env.PUBLIC_DOMAIN_API);
			} else if (isProduction) {
				const hostname = window.location.hostname;
				domains.push(hostname.startsWith('api.') ? hostname : `api.${hostname.replace(/^www\./, '')}`);
			} else {
				domains.push('localhost:4204');
			}
			
			const trustedOrigins = domains.map(domain => {
				// Remove protocol if present
				const cleanDomain = domain.replace(/^https?:\/\//, '');
				if (cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://')) {
					return cleanDomain;
				}
				const protocol = cleanDomain.startsWith('localhost') || cleanDomain.startsWith('127.0.0.1') ? 'http' : 'https';
				return `${protocol}://${cleanDomain}`;
			});
			
			const isTrusted = trustedOrigins.some(origin => {
				try {
					const originUrl = new URL(origin);
					return originUrl.origin === callbackUrl.origin;
				} catch {
					return false;
				}
			});
			
			if (!isTrusted) {
				console.warn('[signin] Untrusted callback URL:', callbackOrigin);
				return null;
			}
			
			return callback;
		} catch (e) {
			console.error('[signin] Invalid callback URL:', callback);
			return null;
		}
	}

	// Reactive check: if already signed in, redirect to profile or callback
	$effect(() => {
		if ($session.data?.user) {
			const callback = getCallbackUrl();
			if (callback) {
				// Redirect to the callback URL (e.g., app.hominio.me/me)
				window.location.href = callback;
			} else {
				// If no callback, redirect to profile page
				goto('/profile');
			}
		}
	});

	async function signInWithGoogle() {
		signingIn = true;
		try {
			const callback = getCallbackUrl();
			// Use callback URL if provided, otherwise redirect to wallet root after sign-in
			const callbackURL = callback || (browser ? window.location.origin : '');
			await authClient.signIn.social({
				provider: 'google',
				callbackURL,
			});
		} catch (error) {
			console.error('Sign in error:', error);
			signingIn = false;
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-[#f8f9fa] via-[#f2f4f6] to-[#e9ecef] p-6 font-sans text-slate-800 antialiased selection:bg-blue-100">
	<!-- Decorative background blobs for liquid effect -->
	<div class="fixed -top-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-blue-200/20 blur-3xl filter pointer-events-none"></div>
	<div class="fixed top-[20%] -right-[10%] h-[600px] w-[600px] rounded-full bg-purple-200/20 blur-3xl filter pointer-events-none"></div>
	<div class="fixed -bottom-[20%] left-[20%] h-[500px] w-[500px] rounded-full bg-emerald-200/20 blur-3xl filter pointer-events-none"></div>

	<div class="relative flex min-h-screen items-center justify-center">
		<div class="w-full max-w-md">
			{#if $session.isPending}
				<div class="flex flex-col items-center justify-center py-24">
					<div class="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
					<p class="mt-4 text-sm font-medium text-slate-500">Loading...</p>
				</div>
			{:else if $session.data?.user}
				<!-- Redirecting... (handled by $effect above) -->
				<div class="flex flex-col items-center justify-center py-24">
					<div class="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
					<p class="mt-4 text-sm font-medium text-slate-500">Redirecting...</p>
				</div>
			{:else}
				<!-- Liquid Glass Card -->
				<div class="overflow-hidden rounded-3xl border border-white/60 bg-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
					<!-- Gradient Accent Header -->
					<div class="h-24 w-full bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 opacity-50"></div>
					
					<div class="px-8 pb-10 pt-8">
						<!-- Header -->
						<div class="mb-8 text-center">
							<h1 class="text-4xl font-bold tracking-tight text-slate-900">Sign In</h1>
							<p class="mt-2 text-slate-500">Sign in to continue to your account</p>
						</div>

						<!-- Sign In Form -->
						<div class="space-y-6">
							<button
								onclick={signInWithGoogle}
								disabled={signingIn}
								class="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm"
							>
								{#if signingIn}
									<div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
									<span>Signing in...</span>
								{:else}
									<!-- Google Icon with dark blue branding -->
									<svg class="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
										<path
											fill="#4285F4"
											d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
										/>
										<path
											fill="#34A853"
											d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										/>
										<path
											fill="#FBBC05"
											d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										/>
										<path
											fill="#EA4335"
											d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										/>
									</svg>
									<span>Continue with Google</span>
								{/if}
							</button>

							<p class="text-center text-xs text-slate-500">
								By continuing, you agree to our{' '}
								<a href="/privacy-policy" class="font-medium text-slate-600 underline transition-colors hover:text-slate-900">
									Privacy Policy
								</a>
							</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
