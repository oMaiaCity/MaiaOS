<!--
  Recursive wrapper for ActorRenderer to avoid <svelte:self> deprecation
-->
<script lang="ts">
  import ActorRenderer from "./ActorRenderer.svelte";
  
  interface Props {
    actorId: string;
    accountCoState?: any;
    item?: any;
  }
  
  const { actorId, accountCoState, item }: Props = $props();
</script>

<ActorRenderer {actorId} {accountCoState} {item} />
