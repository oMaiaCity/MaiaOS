<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import NavPill from '$lib/components/NavPill.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
<NavPill />
