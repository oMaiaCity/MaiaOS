<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { createAuthClient } from '@hominio/auth';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	
	let { children } = $props();
	
	const authClient = createAuthClient();
	const session = authClient.useSession();

	$effect(() => {
		// Skip protection for root route (/)
		if ($page.url.pathname === '/') {
			return;
		}

		// Protect all other routes - redirect to sign-in if not authenticated
		if (!$session.isPending && !$session.data?.user) {
			goto('/?callback=' + encodeURIComponent(window.location.href));
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
