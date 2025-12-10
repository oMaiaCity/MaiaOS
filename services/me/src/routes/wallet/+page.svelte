<!--
  Wallet Vibe Page
  Test page for the wallet vibe
-->
<script lang="ts">
  import Vibe from "$lib/compositor/Vibe.svelte";
  import { walletVibeConfig } from "$lib/vibes/wallet/config";

  const config = walletVibeConfig;
</script>

<div class="h-screen w-full">
  <Vibe {config} />
</div>
