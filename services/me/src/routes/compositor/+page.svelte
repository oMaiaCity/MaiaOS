<script lang="ts">
  import Compositor from "$lib/compositor/Compositor.svelte";
  import { todoCompositorConfig } from "$lib/compositor/todo-config";
</script>

<Compositor config={todoCompositorConfig} />
