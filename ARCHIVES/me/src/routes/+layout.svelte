<script lang="ts">
  import "../app.css";
  import "jazz-tools/inspector/register-custom-element";
  import { Favicon, Footer } from "@maia/brand";
  import { JazzAccount } from "@maia/db";
  import { JazzSvelteProvider } from "jazz-tools/svelte";
  import { page } from "$app/stores";
  import { env } from "$env/dynamic/public";
  import GoogleDataSync from "$lib/components/GoogleDataSync.svelte";
  import Header from "$lib/components/Header.svelte";
  import JazzAuthSetup from "$lib/components/JazzAuthSetup.svelte";
  import JazzAccountProvider from "$lib/components/JazzAccountProvider.svelte";

  // Phase 5: Import builtin MaiaScript module (auto-registers)
  import '@maia/script/modules/builtin.module';
  
  // Phase 6-7: Import drag-drop and security modules (auto-register)
  import '@maia/script/modules/dragdrop.module';
  import '@maia/script/modules/security.module';
  
  // Query module: Import query operations (auto-registers)
  import '@maia/script/modules/query.module';

  const { children } = $props();

  // Get API key from dynamic public env (available at runtime)
  const apiKey = env.PUBLIC_JAZZ_API_KEY;

  // Route-specific title and description
  const routeInfo = $derived.by(() => {
    const pathname = $page.url.pathname;
    if (pathname === "/") {
      return { title: "Maia City", description: "where vision becomes reality" };
    } else if (pathname.startsWith("/vibes")) {
      return { title: "Vibes", description: "Explore and manage your vibes" };
    } else if (pathname === "/db") {
      return {
        title: "DB",
        description: "Database explorer and management",
      };
    } else if (pathname === "/sandbox") {
      return {
        title: "Sandbox",
        description: "Actor inspector and runtime IDE",
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
  <JazzAccountProvider>
    <div class="h-screen bg-white flex flex-col">
      <JazzAuthSetup />
      <GoogleDataSync />
      <jazz-inspector></jazz-inspector>
      <Header title={routeInfo.title} description={routeInfo.description} />
      <main class="flex-1 w-full min-h-0 overflow-hidden {$page.url.pathname === '/' ? '' : 'pt-20'}">
        {@render children?.()}
      </main>
      <Footer />
    </div>
  </JazzAccountProvider>
</JazzSvelteProvider>
