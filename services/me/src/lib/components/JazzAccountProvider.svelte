<script lang="ts">
  import { JazzAccount } from "@hominio/db";
  import { AccountCoState } from "jazz-tools/svelte";
  import { setJazzAccountContext } from "$lib/contexts/jazz-account-context";

  const { children } = $props();

  // Create global Jazz account with full resolve query for all routes
  // This component is rendered inside JazzSvelteProvider, so AccountCoState can access the context
  // Create synchronously (not in effect) so it's available immediately
  const globalAccount = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        entities: { $each: true }, // Load all entities for todos
        schemata: { $each: true }, // Load all schemas for schema matching
        capabilities: true, // Load capabilities list
      },
      profile: true, // Load profile for header
    },
  });

  // Set account in context for child routes to access
  setJazzAccountContext(globalAccount);
</script>

{@render children?.()}

