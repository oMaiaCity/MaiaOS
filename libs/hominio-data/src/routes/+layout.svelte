<script lang="ts">
  import { JazzSvelteProvider } from "jazz-tools/svelte";
  import { apiKey } from "../apiKey";
  import "../app.css";
  import Header from "$lib/components/Header.svelte";
  import JazzAuthSetup from "$lib/components/JazzAuthSetup.svelte";
  import GoogleDataSync from "$lib/components/GoogleDataSync.svelte";
  import "jazz-tools/inspector/register-custom-element";
  import { JazzAccount } from "$lib/schema";
  import { page } from "$app/stores";

  let { children } = $props();

  // Route-specific title and description
  const routeInfo = $derived.by(() => {
    const pathname = $page.url.pathname;
    if (pathname === "/") {
      return { title: "Hominio", description: "Own the destiny of your life" };
    } else if (pathname === "/data") {
      return { title: "Data Explorer", description: "Travel through your data universe" };
    }
    return { title: null, description: null };
  });
</script>

<JazzSvelteProvider
  sync={{
    peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
  }}
  AccountSchema={JazzAccount}
>
  <div class="min-h-screen bg-gray-100">
    <JazzAuthSetup />
    <GoogleDataSync />
    <jazz-inspector></jazz-inspector>
    <Header title={routeInfo.title} description={routeInfo.description} />
    <main
      class="min-w-[896px] max-w-full mx-auto px-3 pt-20 flex flex-col gap-8 min-h-screen overflow-x-hidden"
    >
      <div class="w-full max-w-4xl mx-auto">
        {@render children?.()}
      </div>
    </main>
  </div>
</JazzSvelteProvider>
