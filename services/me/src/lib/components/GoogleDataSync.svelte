<script lang="ts">
  import { syncGoogleDataToProfile } from "@maia/db";
  import { authClient } from "$lib/auth-client";
  import { getJazzAccountContext } from "$lib/contexts/jazz-account-context";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);

  // Get global Jazz account from context
  const account = getJazzAccountContext();
  const me = $derived(account ? account.current : null);

  // Centralized migration trigger - runs once when account loads
  // All migration logic is managed in schema.ts
  let googleDataSynced = $state(false);
  $effect(() => {
    if (
      !googleDataSynced &&
      me &&
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
