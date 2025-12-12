<script lang="ts">
  import { JazzAccount, syncGoogleDataToProfile } from "@hominio/data";
  import { AccountCoState } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);

  // Load Jazz account for migrations (this runs inside JazzSvelteProvider)
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        contact: true,
      },
    },
  });
  const me = $derived(account.current);

  // Centralized migration trigger - runs once when account loads
  // All migration logic is managed in schema.ts
  let googleDataSynced = $state(false);
  $effect(() => {
    if (
      !googleDataSynced &&
      me.$isLoaded &&
      betterAuthUser &&
      me.profile?.$isLoaded &&
      me.root?.contact?.$isLoaded
    ) {
      syncGoogleDataToProfile(me, betterAuthUser)
        .then(() => {
          googleDataSynced = true;
        })
        .catch((_error) => {
          googleDataSynced = true; // Mark as synced even on error to prevent retries
        });
    }
  });
</script>
