/**
 * Learn about schemas here:
 * https://jazz.tools/docs/svelte/schemas/covalues
 */

import { co, z } from "jazz-tools";
import { migrateAddAvatarToHumans } from "./migrations/20241220_add-avatar-to-humans.js";

// WeakMap to track which CoValues have had their label subscription set up
// This avoids storing metadata directly on Proxy objects, which can cause errors during cleanup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const labelSubscriptionMap = new WeakMap<any, { unsubscribe: () => void }>();

/** Helper function to set up reactive @label computation for any CoValue with name field */
export function setupReactiveLabel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coValue: any
) {
  if (!coValue || !coValue.$isLoaded) {
    return;
  }

  // Check if subscription is already set up to avoid duplicate subscriptions
  if (labelSubscriptionMap.has(coValue)) {
    // Still update initial label in case it's missing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentName = coValue.$jazz.has("name") ? (coValue as any).name.trim() : "";
    const computedLabel = currentName || coValue.$jazz.id;
    if (!coValue.$jazz.has("@label") || coValue["@label"] !== computedLabel) {
      coValue.$jazz.set("@label", computedLabel);
    }
    return;
  }

  // Compute initial @label
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialName = coValue.$jazz.has("name") ? (coValue as any).name.trim() : "";
  coValue.$jazz.set("@label", initialName || coValue.$jazz.id);

  // Set up subscription to update @label when name changes
  // Subscribe to the CoValue to watch for any changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unsubscribe = (coValue.$jazz as any).subscribe({}, (updated: any) => {
    if (updated && updated.$isLoaded) {
      // Check if name field changed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = updated.$jazz.has("name") ? (updated as any).name.trim() : "";
      const computedLabel = name || updated.$jazz.id;
      // Always update @label to keep it in sync with name
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
  image: z.string(), // URL or path to avatar image
});

/** Human schema - CoValue with @schema, name, @label, and avatar properties */
export const Human = co.map({
  "@schema": z.literal("human"),
  name: z.string(), // User-editable name (single source of truth)
  "@label": z.string(), // Reactively computed from name (or falls back to ID)
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
        name: "",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
          image: "",
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
        name: "",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
          image: "",
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
        name: "",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
          image: "",
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
        name: "",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
          image: "",
        },
      });
      await human.$jazz.waitForSync();

      setupReactiveLabel(human);

      rootWithO.o.$jazz.set("humans", [human]);
    } else {
      // Run data migrations for existing humans
      console.log("[Schema Migration] Running data migrations for existing humans");
      await migrateAddAvatarToHumans(account);

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
