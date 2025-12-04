/**
 * Learn about schemas here:
 * https://jazz.tools/docs/svelte/schemas/covalues
 */

import { Group, co, z } from "jazz-tools";

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

/** Human schema - simple CoValue with @schema, name, and @label properties */
export const Human = co.map({
  "@schema": z.literal("human"),
  name: z.string(), // User-editable name (single source of truth)
  "@label": z.string(), // Reactively computed from name (or falls back to ID)
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
     *  You can use it to set up the account root and any other initial CoValues you need.
     */
    if (!account.$jazz.has("root")) {
      // Create Human CoValue - Jazz automatically creates a Group as owner
      const human = Human.create({
        "@schema": "human",
        name: "",
        "@label": "",
      });
      await human.$jazz.waitForSync();

      // Get the auto-created group and ensure account is admin
      const humanGroup = human.$jazz.owner as Group;
      if (humanGroup && "addMember" in humanGroup) {
        try {
          humanGroup.addMember(account, "admin");
          await humanGroup.$jazz.waitForSync();
        } catch {
          // Account might already be a member, ignore
        }
      }

      // Set up reactive @label computation for human
      setupReactiveLabel(human);

      account.$jazz.set("root", {
        o: {
          humans: [human],
          coops: [], // Initialize empty list for coops
        },
      });
    } else {
      // Migration for existing accounts
      // First, load root without resolving nested fields to avoid errors
      const loadedAccount = await account.$jazz.ensureLoaded({
        resolve: { root: true },
      });

      // Ensure root exists
      if (!loadedAccount.root) {
        // Root doesn't exist - create it with human
        // Create Human CoValue - Jazz automatically creates a Group as owner
        const human = Human.create({
          "@schema": "human",
          name: "",
          "@label": "",
        });
        await human.$jazz.waitForSync();

        // Get the auto-created group and ensure account is admin
        const humanGroup = human.$jazz.owner as Group;
        if (humanGroup && "addMember" in humanGroup) {
          try {
            humanGroup.addMember(account, "admin");
            await humanGroup.$jazz.waitForSync();
          } catch {
            // Account might already be a member, ignore
          }
        }

        setupReactiveLabel(human);

        account.$jazz.set("root", {
          o: {
            humans: [human],
            coops: [],
          },
        });
        return; // Exit early since we just created everything
      }

      const rootCoMap = loadedAccount.root;

      // Check if root has old structure (root.human) or new structure (root.o)
      // Use type assertion to check for old structure since it's not in the type system
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rootAny = rootCoMap as any;
      const hasOldStructure = rootAny.$jazz && rootAny.$jazz.has && rootAny.$jazz.has("human");
      const hasNewStructure = rootCoMap.$jazz.has("o");

      // Migrate from old structure to new structure
      if (hasOldStructure && !hasNewStructure) {
        // Try to get the old human if it exists
        let humanToMigrate = null;
        try {
          // Load the old human
          const oldRootLoaded = await rootCoMap.$jazz.ensureLoaded({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            resolve: { human: true } as any,
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const oldHuman = (oldRootLoaded as any).human;
          if (oldHuman && oldHuman.$isLoaded) {
            // Ensure fields are set correctly
            if (!oldHuman.$jazz.has("@schema")) {
              oldHuman.$jazz.set("@schema", "human");
            }
            if (!oldHuman.$jazz.has("name")) {
              oldHuman.$jazz.set("name", "");
            }
            const currentName = oldHuman.$jazz.has("name") ? oldHuman.name.trim() : "";
            const computedLabel = currentName || oldHuman.$jazz.id;
            if (!oldHuman.$jazz.has("@label") || oldHuman["@label"] !== computedLabel) {
              oldHuman.$jazz.set("@label", computedLabel);
            }
            // Set up reactive label AFTER ensuring fields exist
            setupReactiveLabel(oldHuman);
            humanToMigrate = oldHuman;
          }
        } catch {
          // Old human doesn't exist or can't be loaded, will create new one
        }

        if (!humanToMigrate) {
          // Create new human if old one doesn't exist
          const newHuman = Human.create({
            "@schema": "human",
            name: "",
            "@label": "",
          });
          await newHuman.$jazz.waitForSync();

          const humanGroup = newHuman.$jazz.owner as Group;
          if (humanGroup && "addMember" in humanGroup) {
            try {
              humanGroup.addMember(account, "admin");
              await humanGroup.$jazz.waitForSync();
            } catch {
              // Account might already be a member, ignore
            }
          }

          setupReactiveLabel(newHuman);
          humanToMigrate = newHuman;
        }

        // Create new structure with migrated human
        rootCoMap.$jazz.set("o", {
          humans: [humanToMigrate],
          coops: [],
        });
      }

      // Ensure o exists (in case it was never created)
      if (!rootCoMap.$jazz.has("o")) {
        // Create new human if none exists
        const human = Human.create({
          "@schema": "human",
          name: "",
          "@label": "",
        });
        await human.$jazz.waitForSync();

        const humanGroup = human.$jazz.owner as Group;
        if (humanGroup && "addMember" in humanGroup) {
          try {
            humanGroup.addMember(account, "admin");
            await humanGroup.$jazz.waitForSync();
          } catch {
            // Account might already be a member, ignore
          }
        }

        setupReactiveLabel(human);

        rootCoMap.$jazz.set("o", {
          humans: [human],
          coops: [],
        });
      }

      // Ensure o is loaded
      const rootWithO = await rootCoMap.$jazz.ensureLoaded({
        resolve: { o: { humans: true, coops: true } },
      });

      const root = rootWithO;

      // Ensure coops field exists
      if (root.o && root.o.$isLoaded && !root.o.$jazz.has("coops")) {
        root.o.$jazz.set("coops", []);
      }

      // Handle humans list creation/migration
      if (root.o && root.o.$isLoaded && !root.o.$jazz.has("humans")) {
        // Create Human CoValue - Jazz automatically creates a Group as owner
        const human = Human.create({
          "@schema": "human",
          name: "",
          "@label": "",
        });
        await human.$jazz.waitForSync();

        // Get the auto-created group and ensure account is admin
        const humanGroup = human.$jazz.owner as Group;
        if (humanGroup && "addMember" in humanGroup) {
          try {
            humanGroup.addMember(account, "admin");
            await humanGroup.$jazz.waitForSync();
          } catch {
            // Account might already be a member, ignore
          }
        }

        // Set up reactive @label computation for human
        setupReactiveLabel(human);

        root.o.$jazz.set("humans", [human]);
      } else if (root.o && root.o.$isLoaded) {
        // Ensure all humans in the list have correct setup
        const humans = root.o.humans;
        if (humans && humans.$isLoaded) {
          for (const human of Array.from(humans)) {
            if (human.$isLoaded) {
              if (!human.$jazz.has("@schema")) {
                human.$jazz.set("@schema", "human");
              }
              if (!human.$jazz.has("name")) {
                human.$jazz.set("name", "");
              }
              const currentName = human.$jazz.has("name") ? human.name.trim() : "";
              const computedLabel = currentName || human.$jazz.id;
              if (!human.$jazz.has("@label") || human["@label"] !== computedLabel) {
                human.$jazz.set("@label", computedLabel);
              }
              setupReactiveLabel(human);
            }
          }
        }
      }
    }
  });
