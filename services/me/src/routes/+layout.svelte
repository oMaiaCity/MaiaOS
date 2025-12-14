<script lang="ts">
  import "../app.css";
  import "jazz-tools/inspector/register-custom-element";
  import { Favicon, Footer } from "@hominio/brand";
  import { JazzAccount } from "@hominio/db";
  import { JazzSvelteProvider } from "jazz-tools/svelte";
  import { page } from "$app/stores";
  import { env } from "$env/dynamic/public";
  import GoogleDataSync from "$lib/components/GoogleDataSync.svelte";
  import Header from "$lib/components/Header.svelte";
  import JazzAuthSetup from "$lib/components/JazzAuthSetup.svelte";

  const { children } = $props();

  // Get API key from dynamic public env (available at runtime)
  const apiKey = env.PUBLIC_JAZZ_API_KEY;

  // Route-specific title and description
  const routeInfo = $derived.by(() => {
    const pathname = $page.url.pathname;
    if (pathname === "/") {
      return { title: "Hominio", description: "Own the destiny of your life" };
    } else if (pathname.startsWith("/vibes")) {
      return { title: "Vibes", description: "Explore and manage your vibes" };
    } else if (pathname === "/db") {
      return {
        title: "DB",
        description: "Database explorer and management",
      };
    }
    return { title: null, description: null };
  });
</script>

<Favicon />

<JazzSvelteProvider
  sync={{
    peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
  }}
  AccountSchema={JazzAccount}
>
  <div class="h-screen bg-gray-100 flex flex-col">
    <JazzAuthSetup />
    <GoogleDataSync />
    <jazz-inspector></jazz-inspector>
    <Header title={routeInfo.title} description={routeInfo.description} />
    <main class="flex-1 w-full h-full overflow-hidden">
      {@render children?.()}
    </main>
    <Footer />
  </div>
</JazzSvelteProvider>
