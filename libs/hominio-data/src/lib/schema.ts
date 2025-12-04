/**
 * Learn about schemas here:
 * https://jazz.tools/docs/svelte/schemas/covalues
 */

import { co, z } from "jazz-tools";
import { migrateSyncGoogleNameToAvatar } from "./migrations/20241220_sync-google-name-to-avatar.js";
import { migrateSyncGoogleImageToAvatar } from "./migrations/20241220_sync-google-image-to-avatar.js";
import { migrateSyncGoogleEmailToContact } from "./migrations/20241220_sync-google-email-to-contact.js";

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

/** Avatar schema - reusable CoMap for avatar information */
export const Avatar = co.map({
  firstName: z.string(),
  lastName: z.string(),
  image: co.image().optional(), // ImageDefinition for avatar image (optional)
});

/** Contact schema - reusable CoMap for contact information */
export const Contact = co.map({
  email: z.string(),
});

/** Human schema - CoValue with @schema, @label, avatar, and contact properties */
export const Human = co.map({
  "@schema": z.literal("human"),
  "@label": z.string(), // Reactively computed from avatar.firstName + avatar.lastName (or falls back to ID)
  avatar: Avatar, // Avatar sub-object with firstName, lastName, and image
  contact: Contact, // Contact sub-object with email
});

/** Custom profile schema (no custom fields, using default) */
export const AccountProfile = co.profile();

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AppRoot = co.map({
  humans: co.list(Human), // List of Human CoValues (each auto-creates a Group via $jazz.owner)
});

export const JazzAccount = co
  .account({
    root: AppRoot,
    profile: AccountProfile,
  })
  .withMigration(async (account) => {
    /** The account migration is run on account creation and on every log-in.
     *  Sets up the account root with initial structure: root.humans
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
        contact: {
          email: "",
        },
      });
      await human.$jazz.waitForSync();

      setupReactiveLabel(human);

      account.$jazz.set("root", {
        humans: [human],
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
        contact: {
          email: "",
        },
      });
      await human.$jazz.waitForSync();

      setupReactiveLabel(human);

      account.$jazz.set("root", {
        humans: [human],
      });
      return;
    }

    const root = loadedAccount.root;

    // Try to load humans list
    // If the reference is broken (points to non-existent CoValue), recreate it
    let rootWithHumans;
    try {
      rootWithHumans = await root.$jazz.ensureLoaded({
        resolve: { humans: true },
      });

      // Verify that root was actually loaded (not just a broken reference)
      if (!rootWithHumans || !rootWithHumans.$isLoaded) {
        throw new Error("root failed to load - broken reference");
      }
    } catch (error) {
      // If loading failed (broken reference), recreate root
      console.warn("[Schema Migration] root reference is broken, recreating:", error);

      const human = Human.create({
        "@schema": "human",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
        },
        contact: {
          email: "",
        },
      });
      await human.$jazz.waitForSync();

      setupReactiveLabel(human);

      account.$jazz.set("root", {
        humans: [human],
      });
      return;
    }

    // Ensure humans list exists and has at least one human
    if (!rootWithHumans.$jazz.has("humans")) {
      const human = Human.create({
        "@schema": "human",
        "@label": "",
        avatar: {
          firstName: "",
          lastName: "",
        },
        contact: {
          email: "",
        },
      });
      await human.$jazz.waitForSync();

      setupReactiveLabel(human);

      rootWithHumans.$jazz.set("humans", [human]);
    } else {
      // Ensure all existing humans have reactive labels set up and contact field
      const humans = rootWithHumans.humans;
      if (humans && humans.$isLoaded) {
        for (const human of Array.from(humans)) {
          if (human.$isLoaded) {
            setupReactiveLabel(human);

            // Ensure contact field exists (for existing humans created before contact was added)
            if (!human.$jazz.has("contact")) {
              human.$jazz.set("contact", {
                email: "",
              });
            }
          }
        }
      }
    }
  });

/**
 * Centralized function to sync Google profile data to human avatars and contact
 * Called from client-side layout when BetterAuth user data is available
 * 
 * @param account - The Jazz account to sync data for
 * @param betterAuthUser - BetterAuth user object with name, image, and email properties
 */
export async function syncGoogleDataToAvatars(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any,
  betterAuthUser?: { name?: string | null; image?: string | null; email?: string | null } | null
): Promise<void> {
  if (!betterAuthUser) {
    return;
  }

  // Sync name, image, and email in parallel
  await Promise.all([
    betterAuthUser.name ? migrateSyncGoogleNameToAvatar(account, betterAuthUser.name) : Promise.resolve(),
    betterAuthUser.image ? migrateSyncGoogleImageToAvatar(account, betterAuthUser.image) : Promise.resolve(),
    betterAuthUser.email ? migrateSyncGoogleEmailToContact(account, betterAuthUser.email) : Promise.resolve(),
  ]);
}
