<script lang="ts">
  import { JazzSvelteProvider } from "jazz-tools/svelte";
  import { apiKey } from "../apiKey";
  import "../app.css";
  import Header from "$lib/components/Header.svelte";
  import JazzAuthSetup from "$lib/components/JazzAuthSetup.svelte";
  import "jazz-tools/inspector/register-custom-element";
  import { JazzAccount } from "$lib/schema";

  let { children } = $props();
  let appName = "Hominio";
</script>

<JazzSvelteProvider
  sync={{
    peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
  }}
  AccountSchema={JazzAccount}
>
  <div class="min-h-screen bg-gray-100">
    <JazzAuthSetup />
    <jazz-inspector></jazz-inspector>
    <Header {appName} />
    <main
      class="min-w-[896px] max-w-full mx-auto px-3 mt-16 flex flex-col gap-8 min-h-screen overflow-x-hidden"
    >
      <div class="w-full max-w-4xl mx-auto">
        {@render children?.()}
      </div>
    </main>
  </div>
</JazzSvelteProvider>
