/**
 * Learn about schemas here:
 * https://jazz.tools/docs/svelte/schemas/covalues
 */

import { co, z } from "jazz-tools";
import { migrateSyncGoogleNameToAvatar } from "./migrations/20241220_sync-google-name-to-avatar.js";
import { migrateSyncGoogleImageToAvatar } from "./migrations/20241220_sync-google-image-to-avatar.js";
import { migrateSyncGoogleEmailToContact } from "./migrations/20241220_sync-google-email-to-contact.js";
import { registerComputedField, setupComputedFieldsForCoValue } from "./computed-fields.js";

// Register computed field definitions
// @label is computed from avatar.firstName + avatar.lastName, falls back to ID
registerComputedField({
  targetField: "@label",
  sourceFields: ["avatar.firstName", "avatar.lastName"],
  computeFn: (human) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const humanAny = human as any;
    if (!humanAny.$jazz.has("avatar")) {
      return humanAny.$jazz.id;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avatar = humanAny.avatar as any;
    const firstName = avatar?.firstName?.trim() || "";
    const lastName = avatar?.lastName?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || humanAny.$jazz.id;
  },
  schemaType: "human",
});

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

      // Ensure avatar is loaded before setting up computed fields
      await human.$jazz.ensureLoaded({
        resolve: { avatar: true },
      });
      setupComputedFieldsForCoValue(human);

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

      // Ensure avatar is loaded before setting up computed fields
      await human.$jazz.ensureLoaded({
        resolve: { avatar: true },
      });
      setupComputedFieldsForCoValue(human);

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

      // Ensure avatar is loaded before setting up computed fields
      await human.$jazz.ensureLoaded({
        resolve: { avatar: true },
      });
      setupComputedFieldsForCoValue(human);

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

      // Ensure avatar is loaded before setting up computed fields
      await human.$jazz.ensureLoaded({
        resolve: { avatar: true },
      });
      setupComputedFieldsForCoValue(human);

      rootWithHumans.$jazz.set("humans", [human]);
    } else {
      // Ensure all existing humans have computed fields set up and contact field
      const humans = rootWithHumans.humans;
      if (humans && humans.$isLoaded) {
        for (const human of Array.from(humans)) {
          if (human.$isLoaded) {
            // Ensure avatar is loaded before setting up computed fields
            try {
              await human.$jazz.ensureLoaded({
                resolve: { avatar: true },
              });
              setupComputedFieldsForCoValue(human);
            } catch (error) {
              console.warn("[Schema Migration] Failed to load human avatar for computed fields setup:", error);
              // Still try to set up computed fields even if avatar loading fails
              if (human.$isLoaded) {
                setupComputedFieldsForCoValue(human);
              }
            }

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
