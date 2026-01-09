<script lang="ts">
	import type { Actor } from "@maia/db";
	import ActorListItem from "./ActorListItem.svelte";

	interface Props {
		actors: Actor[];
		onActorSelect?: (actor: Actor) => void;
	}

	const { actors, onActorSelect }: Props = $props();
</script>

<div class="flex flex-col gap-2">
	{#if actors.length === 0}
		<div class="text-center text-slate-500 py-8">
			No actors found.
		</div>
	{:else}
		<div class="text-sm text-slate-600 mb-2">
			Found {actors.length} actor{actors.length === 1 ? '' : 's'}
		</div>
		<div class="flex flex-col gap-2">
			{#each actors as actor (actor.$jazz.id)}
				<ActorListItem {actor} {actors} onSelect={onActorSelect} />
			{/each}
		</div>
	{/if}
</div>
