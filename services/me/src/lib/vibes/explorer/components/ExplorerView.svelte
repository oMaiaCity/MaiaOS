<script lang="ts">
	import { browser } from "$app/environment";
	import { getJazzAccountContext } from "$lib/contexts/jazz-account-context";
	import ActorList from "./ActorList.svelte";
	import type { Actor } from "@hominio/db";

	// Get global Jazz account from context
	const accountCoState = getJazzAccountContext();
	const account = $derived(accountCoState?.current);

	// Access root.actors reactively (like useQuery does with root.entities)
	const root = $derived(account?.root);
	const actorsList = $derived(root?.actors);

	// Get all actors from the list reactively
	// Filter to only include loaded actors
	const actors = $derived.by(() => {
		if (!browser || !actorsList?.$isLoaded) {
			return [];
		}

		const loadedActors: Actor[] = [];
		for (const actor of actorsList) {
			if (actor?.$isLoaded) {
				loadedActors.push(actor as Actor);
			}
		}
		return loadedActors;
	});

	function handleActorSelect(actor: Actor) {
		console.log('[ExplorerView] Actor selected:', actor.role, actor.$jazz.id);
		// Phase 2: Will navigate to centered view
	}
</script>

<div class="h-full w-full flex flex-col p-4 @xs:p-6 @sm:p-8">
	<div class="mb-4">
		<h2 class="text-xl font-semibold text-slate-900">All Actors</h2>
	</div>

	{#if !actorsList?.$isLoaded}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-slate-600">Loading actors...</div>
		</div>
	{:else}
		<div class="flex-1 overflow-auto">
			<ActorList {actors} onActorSelect={handleActorSelect} />
		</div>
	{/if}
</div>
