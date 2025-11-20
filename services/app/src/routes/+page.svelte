<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { BackgroundBlobs, LoadingSpinner } from '@hominio/brand';

	onMount(() => {
		// Redirect to /me (projects page)
		goto('/me');
	});
</script>

<div class="min-h-screen bg-glass-gradient flex flex-col items-center justify-center font-sans text-slate-800">
	<BackgroundBlobs />
	<div class="relative flex flex-col items-center">
		<LoadingSpinner />
		<p class="mt-4 text-sm font-medium text-slate-500">Loading...</p>
	</div>
</div>
