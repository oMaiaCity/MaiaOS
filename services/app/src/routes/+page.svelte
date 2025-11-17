<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		// Redirect to mini apps manager
		goto('/mini-apps');
	});
</script>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white"
>
	<div
		class="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-cyan-400"
	></div>
	<p class="m-0 text-lg">Loading...</p>
</div>
