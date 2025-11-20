<script lang="ts">
	import { createAuthClient } from '@hominio/auth';
	import { goto } from '$app/navigation';

	const authClient = createAuthClient();
	const session = authClient.useSession();

	let { children } = $props();

	$effect(() => {
		// Protect profile routes - redirect to sign-in if not authenticated
		if (!$session.isPending && !$session.data?.user) {
			goto('/?callback=' + encodeURIComponent(window.location.href));
		}
	});
</script>

{@render children()}

