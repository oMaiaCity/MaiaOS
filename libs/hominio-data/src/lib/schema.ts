/**
 * Learn about schemas here:
 * https://jazz.tools/docs/svelte/schemas/covalues
 */

import { co, z } from "jazz-tools";
import { migrateAddAvatarToHumans } from "./migrations/20241220_add-avatar-to-humans.js";
import { migrateRemoveNameFromHumans } from "./migrations/20241220_remove-name-from-humans.js";
import { migrateSyncGoogleNameToAvatar } from "./migrations/20241220_sync-google-name-to-avatar.js";
import { migrateSyncGoogleImageToAvatar } from "./migrations/20241220_sync-google-image-to-avatar.js";

// WeakMap to track which CoValues have had their label subscription set up
// This avoids storing metadata directly on Proxy objects, which can cause errors during cleanup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const labelSubscriptionMap = new WeakMap<any, { unsubscribe: () => void }>();

/** Helper function to set up reactive @label computation for Human CoValues
 * Computes label from avatar.firstName + avatar.lastName, falls back to ID
 */
export function setupReactiveLabel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coValue: any
) {
  if (!coValue || !coValue.$isLoaded) {
    return;
  }

  // Only set up for Human CoValues (check for avatar property)
  if (!coValue.$jazz.has("avatar")) {
    return;
  }

  // Helper to compute label from avatar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const computeLabelFromAvatar = (human: any): string => {
    if (!human.$jazz.has("avatar")) {
      return human.$jazz.id;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avatar = human.avatar as any;
    const firstName = avatar?.firstName?.trim() || "";
    const lastName = avatar?.lastName?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || human.$jazz.id;
  };

  // Check if subscription is already set up to avoid duplicate subscriptions
  if (labelSubscriptionMap.has(coValue)) {
    // Still update initial label in case it's missing
    const computedLabel = computeLabelFromAvatar(coValue);
    if (!coValue.$jazz.has("@label") || coValue["@label"] !== computedLabel) {
      coValue.$jazz.set("@label", computedLabel);
    }
    return;
  }

  // Compute initial @label from avatar
  const initialLabel = computeLabelFromAvatar(coValue);
  coValue.$jazz.set("@label", initialLabel);

  // Set up subscription to update @label when avatar changes
  // Subscribe to the CoValue to watch for any changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unsubscribe = (coValue.$jazz as any).subscribe({}, (updated: any) => {
    if (updated && updated.$isLoaded && updated.$jazz.has("avatar")) {
      const computedLabel = computeLabelFromAvatar(updated);
      // Always update @label to keep it in sync with avatar
      if (!updated.$jazz.has("@label") || updated["@label"] !== computedLabel) {
        updated.$jazz.set("@label", computedLabel);
      }
    }
  });

  // Mark that subscription is set up to avoid duplicate subscriptions
  // Store unsubscribe function in WeakMap instead of on the Proxy object
  labelSubscriptionMap.set(coValue, { unsubscribe });
}


/** Custom profile schema (no custom fields, using default) */
export const AccountProfile = co.profile();

/** Avatar schema - reusable CoMap for avatar information */
export const Avatar = co.map({
  firstName: z.string(),
  lastName: z.string(),
  image: co.image().optional(), // ImageDefinition for avatar image (optional)
});

/** Human schema - CoValue with @schema, @label, and avatar properties */
export const Human = co.map({
  "@schema": z.literal("human"),
  "@label": z.string(), // Reactively computed from avatar.firstName + avatar.lastName (or falls back to ID)
  avatar: Avatar, // Avatar sub-object with firstName, lastName, and image
});

/** Coop schema - CoValue with @schema, name, and @label properties */
export const Coop = co.map({
  "@schema": z.literal("coop"),
  name: z.string(), // User-editable name (single source of truth)
  "@label": z.string(), // Reactively computed from name (or falls back to ID)
});

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AppRoot = co.map({
  o: co.map({
    humans: co.list(Human), // List of Human CoValues (each auto-creates a Group via $jazz.owner)
    coops: co.list(Coop), // List of Coop CoValues (each auto-creates a Group via $jazz.owner)
  }),
});

export const JazzAccount = co
  .account({
    root: AppRoot,
    profile: AccountProfile,
  })
  .withMigration(async (account) => {
    /** The account migration is run on account creation and on every log-in.
     *  Sets up the account root with initial structure: root.o.humans and root.o.coops
     */
    // Check if root exists (without loading nested structures)
    if (!account.$jazz.has("root")) {
      const human = Human.create({
        "@schema": "human",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
        },
      });
      await human.$jazz.waitForSync();

      setupReactiveLabel(human);

      account.$jazz.set("root", {
        o: {
          humans: [human],
          coops: [],
        },
      });
      return;
    }

    // Load root (without nested structures first)
    const loadedAccount = await account.$jazz.ensureLoaded({
      resolve: { root: true },
    });

    if (!loadedAccount.root) {
      const human = Human.create({
        "@schema": "human",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
        },
      });
      await human.$jazz.waitForSync();

      setupReactiveLabel(human);

      account.$jazz.set("root", {
        o: {
          humans: [human],
          coops: [],
        },
      });
      return;
    }

    const root = loadedAccount.root;

    // Ensure o exists (check without loading nested structures)
    if (!root.$jazz.has("o")) {
      const human = Human.create({
        "@schema": "human",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
        },
      });
      await human.$jazz.waitForSync();

      setupReactiveLabel(human);

      root.$jazz.set("o", {
        humans: [human],
        coops: [],
      });
      return;
    }

    // Now load o and its nested structures
    const rootWithO = await root.$jazz.ensureLoaded({
      resolve: { o: { humans: true, coops: true } },
    });

    // Ensure coops list exists
    if (!rootWithO.o.$jazz.has("coops")) {
      rootWithO.o.$jazz.set("coops", []);
    }

    // Ensure humans list exists and has at least one human
    if (!rootWithO.o.$jazz.has("humans")) {
      const human = Human.create({
        "@schema": "human",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
        },
      });
      await human.$jazz.waitForSync();

      setupReactiveLabel(human);

      rootWithO.o.$jazz.set("humans", [human]);
    } else {
      // Run data migrations for existing humans
      console.log("[Schema Migration] Running data migrations for existing humans");

      // Add avatar property if missing
      await migrateAddAvatarToHumans(account);

      // Remove name property (it will be ignored since not in schema, but document it)
      await migrateRemoveNameFromHumans(account);

      // Ensure all existing humans have reactive labels set up
      const humans = rootWithO.o.humans;
      if (humans && humans.$isLoaded) {
        for (const human of Array.from(humans)) {
          if (human.$isLoaded) {
            setupReactiveLabel(human);
          }
        }
      }
    }
  });

/**
 * Centralized function to sync Google profile data to human avatars
 * Called from client-side layout when BetterAuth user data is available
 * 
 * @param account - The Jazz account to sync data for
 * @param betterAuthUser - BetterAuth user object with name and image properties
 */
export async function syncGoogleDataToAvatars(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any,
  betterAuthUser?: { name?: string | null; image?: string | null } | null
): Promise<void> {
  if (!betterAuthUser) {
    return;
  }

  // Sync name and image in parallel
  await Promise.all([
    betterAuthUser.name ? migrateSyncGoogleNameToAvatar(account, betterAuthUser.name) : Promise.resolve(),
    betterAuthUser.image ? migrateSyncGoogleImageToAvatar(account, betterAuthUser.image) : Promise.resolve(),
  ]);
}
