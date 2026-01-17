<script lang="ts">
  import { MaiaprenuerSandbox } from '$lib/components/maiaprenuer-sandbox';
  import { getJazzAccountContext } from '$lib/utils/jazz-account-context';

  // Get global Jazz account CoState from context
  const accountCoState = getJazzAccountContext();
</script>

<div class="h-full w-full">
  <MaiaprenuerSandbox {accountCoState} />
</div>
