<script>
	import '../app.css';
	import NavPill from '$lib/components/NavPill.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { createAuthClient } from '@hominio/auth';

	let { children } = $props();

	// Use BetterAuth's reactive session hook (client-side only)
	// This uses nano-store and automatically updates when auth state changes
	// See: https://www.better-auth.com/docs/integrations/svelte-kit
	const authClient = createAuthClient();
	const session = authClient.useSession();

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
			const appDomain = import.meta.env.PUBLIC_DOMAIN_APP || 'localhost:4202';
			const protocol = appDomain.startsWith('localhost') || appDomain.startsWith('127.0.0.1') ? 'http' : 'https';
			const appUrl = `${protocol}://${appDomain}`;
			const callbackUrl = `${appUrl}${redirectUrl}`;
			
			// Redirect to wallet service with callback parameter
			const walletDomain = import.meta.env.PUBLIC_DOMAIN_WALLET || 'localhost:4201';
			const walletProtocol = walletDomain.startsWith('localhost') || walletDomain.startsWith('127.0.0.1') ? 'http' : 'https';
			const walletUrl = `${walletProtocol}://${walletDomain}`;
			window.location.href = `${walletUrl}?callback=${encodeURIComponent(callbackUrl)}`;
		}
	});
</script>

{#if $session.isPending}
	<div
		class="flex flex-col justify-center items-center min-h-screen text-white bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
	>
		<div
			class="mb-4 w-10 h-10 rounded-full border-4 animate-spin border-white/30 border-t-cyan-400"
		></div>
		<p class="m-0 text-lg">Checking authentication...</p>
	</div>
{:else if !$session.data?.user}
	<!-- Redirecting... (handled by $effect above) -->
	<div
		class="flex flex-col justify-center items-center min-h-screen text-white bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
	>
		<div
			class="mb-4 w-10 h-10 rounded-full border-4 animate-spin border-white/30 border-t-cyan-400"
		></div>
		<p class="m-0 text-lg">Redirecting...</p>
	</div>
{:else}
{@render children()}
	{#if $page.url.pathname !== '/'}
<NavPill />
	{/if}
{/if}
