<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
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
		// Skip redirect on signin page
		if ($page.url.pathname.startsWith('/signin')) {
			return;
		}

		// Wait for session to load
		if ($session.isPending) {
			return;
		}

		// If not authenticated, redirect to sign-in
		if (!$session.data?.user) {
			const redirectUrl = $page.url.pathname + $page.url.search;
			goto(`/signin?redirect=${encodeURIComponent(redirectUrl)}`, { replaceState: true });
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if $session.isPending}
	<div
		class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white"
	>
		<div
			class="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-cyan-400"
		></div>
		<p class="m-0 text-lg">Checking authentication...</p>
	</div>
{:else if !$session.data?.user && !$page.url.pathname.startsWith('/signin')}
	<!-- Redirecting... (handled by $effect above) -->
	<div
		class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white"
	>
		<div
			class="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-cyan-400"
		></div>
		<p class="m-0 text-lg">Redirecting...</p>
	</div>
{:else}
{@render children()}
	{#if $page.url.pathname !== '/' && !$page.url.pathname.startsWith('/signin')}
<NavPill />
	{/if}
{/if}
