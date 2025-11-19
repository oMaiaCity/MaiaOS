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
			const trustedOrigins = [
				env.PUBLIC_DOMAIN_ROOT || 'localhost:4200',
				env.PUBLIC_DOMAIN_APP || 'localhost:4202',
				env.PUBLIC_DOMAIN_WALLET || 'localhost:4201',
				env.PUBLIC_DOMAIN_SYNC || 'localhost:4203',
				env.PUBLIC_DOMAIN_API || 'localhost:4204',
			].map(domain => {
				if (domain.startsWith('http://') || domain.startsWith('https://')) {
					return domain;
				}
				const protocol = domain.startsWith('localhost') || domain.startsWith('127.0.0.1') ? 'http' : 'https';
				return `${protocol}://${domain}`;
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

	// Reactive check: if already signed in, redirect to callback or stay on wallet
	$effect(() => {
		if ($session.data?.user) {
			const callback = getCallbackUrl();
			if (callback) {
				// Redirect to the callback URL (e.g., app.hominio.me/me)
				window.location.href = callback;
			}
			// If no callback, stay on wallet service (could show account page later)
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

<div class="signin-container">
	<div class="signin-card">
		<div class="signin-header">
			<h1 class="signin-title">Sign In</h1>
			<p class="signin-subtitle">
				Sign in to continue to your account.
			</p>
		</div>

		{#if $session.isPending}
			<div class="loading-state">
				<div class="spinner"></div>
			</div>
		{:else if $session.data?.user}
			<!-- Redirecting... (handled by $effect above) -->
			<div class="loading-state">
				<div class="spinner"></div>
			</div>
		{:else}
			<div class="signin-state">
				<button
					onclick={signInWithGoogle}
					disabled={signingIn}
					class="google-btn"
				>
					{#if signingIn}
						<div class="btn-spinner"></div>
						<span>Signing in...</span>
					{:else}
						<svg class="google-icon" viewBox="0 0 24 24">
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

				<p class="terms-text">
					By continuing, you agree to our{' '}
					<a href="/privacy-policy" class="terms-link">Privacy Policy</a>.
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.signin-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: #040f1c;
		position: relative;
	}

	.signin-card {
		width: 100%;
		max-width: 420px;
		background: #051529;
		border-radius: 16px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		padding: 2.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.signin-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.signin-title {
		font-size: 2rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0 0 0.5rem 0;
		letter-spacing: -0.02em;
	}

	.signin-subtitle {
		font-size: 0.9375rem;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.6);
		margin: 0;
	}

	.loading-state {
		text-align: center;
		padding: 3rem 0;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid rgba(255, 255, 255, 0.1);
		border-top-color: rgba(255, 255, 255, 0.8);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.signin-state {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.google-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		width: 100%;
		padding: 0.875rem 1.5rem;
		background: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 9999px;
		font-size: 0.9375rem;
		font-weight: 500;
		color: #030a14;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.google-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.95);
		transform: translateY(-1px);
	}

	.google-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.google-icon {
		width: 24px;
		height: 24px;
		flex-shrink: 0;
	}

	.btn-spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(3, 10, 20, 0.2);
		border-top-color: #030a14;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.terms-text {
		font-size: 0.8125rem;
		line-height: 1.4;
		color: rgba(255, 255, 255, 0.5);
		text-align: center;
		margin: 0;
	}

	.terms-link {
		color: rgba(255, 255, 255, 0.7);
		text-decoration: underline;
		transition: color 0.2s ease;
	}

	.terms-link:hover {
		color: rgba(255, 255, 255, 0.9);
	}

	@media (max-width: 640px) {
		.signin-container {
			padding: 1rem;
		}

		.signin-card {
			padding: 2rem 1.5rem;
		}

		.signin-title {
			font-size: 1.75rem;
		}

		.signin-subtitle {
			font-size: 0.875rem;
		}
	}
</style>
