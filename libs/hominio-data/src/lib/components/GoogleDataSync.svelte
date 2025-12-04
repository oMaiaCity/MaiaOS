<script lang="ts">
  import { JazzAccount, syncGoogleDataToAvatars } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);

  // Load Jazz account for migrations (this runs inside JazzSvelteProvider)
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        o: {
          humans: true,
        },
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
      me.root.o?.humans?.$isLoaded &&
      me.root.o.humans.length > 0
    ) {
      syncGoogleDataToAvatars(me, betterAuthUser)
        .then(() => {
          googleDataSynced = true;
        })
        .catch((error) => {
          console.error("Error syncing Google data to avatar:", error);
          googleDataSynced = true; // Mark as synced even on error to prevent retries
        });
    }
  });
</script>

