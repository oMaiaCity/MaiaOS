<script lang="ts">
  import { JazzAccount } from "@hominio/db";
  import { AccountCoState } from "jazz-tools/svelte";
  import { setJazzAccountContext } from "$lib/contexts/jazz-account-context";

  const { children } = $props();

  // Create global Jazz account with minimal resolve query for fast initial load
  // This component is rendered inside JazzSvelteProvider, so AccountCoState can access the context
  // Create synchronously (not in effect) so it's available immediately
  // 
  // PERFORMANCE: Only load what's needed for initial render (profile for header)
  // Entities and schemata are loaded lazily when routes that need them are accessed
  // The useQuery hook and other components handle lazy loading gracefully
  const globalAccount = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        // Only load root structure, not nested lists (entities/schemata loaded on-demand)
      },
      profile: true, // Load profile for header (required for initial render)
    },
  });

  // Set account in context for child routes to access
  setJazzAccountContext(globalAccount);
</script>

{@render children?.()}

