/**
 * Learn about schemas here:
 * https://jazz.tools/docs/svelte/schemas/covalues
 */

import { co, z, Group } from "jazz-tools";
import { migrateAddAvatarToHumans } from "./migrations/20241220_add-avatar-to-humans.js";
import { migrateRemoveNameFromHumans } from "./migrations/20241220_remove-name-from-humans.js";
import { migrateSyncGoogleNameToAvatar } from "./migrations/20241220_sync-google-name-to-avatar.js";
import { migrateSyncGoogleImageToAvatar } from "./migrations/20241220_sync-google-image-to-avatar.js";
import { migrateAddPublicReadCapability } from "./migrations/20241220_add-public-read-capability.js";

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

/**
 * Ensures a PublicRead capability exists for a human's avatar
 * Creates a public capability group and adds it as a readonly member to the avatar's owner group
 * 
 * Note: Jazz automatically creates a separate owner group for nested CoMaps (like avatar),
 * so human.avatar.$jazz.owner is different from human.$jazz.owner
 * 
 * @param human - The Human CoValue
 * @param account - The Jazz account (for accessing root.o.capabilities)
 * @returns The created Capability CoMap, or existing one if already present
 */
export async function ensurePublicReadCapability(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  human: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any
): Promise<any> {
  // Ensure human and avatar are loaded
  if (!human || !human.$isLoaded || !human.$jazz.has("avatar")) {
    console.log("[Capability] Human or avatar not loaded, skipping capability creation");
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatar = human.avatar as any;
  if (!avatar || !avatar.$isLoaded) {
    console.log("[Capability] Avatar not loaded, skipping capability creation");
    return null;
  }

  // Get avatar's owner group (Jazz automatically created this separately)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatarOwnerGroup = avatar.$jazz.owner as any;
  if (!avatarOwnerGroup) {
    console.log("[Capability] Avatar doesn't have an owner group, skipping capability creation");
    return null;
  }

  const avatarOwnerGroupId = avatarOwnerGroup.$jazz.id;

  // Load account root with capabilities
  const loadedAccount = await account.$jazz.ensureLoaded({
    resolve: { root: { o: { capabilities: true } } },
  });

  if (!loadedAccount.root || !loadedAccount.root.o) {
    console.log("[Capability] Account root.o not available, skipping capability creation");
    return null;
  }

  // Ensure capabilities list exists
  if (!loadedAccount.root.o.$jazz.has("capabilities")) {
    loadedAccount.root.o.$jazz.set("capabilities", []);
    await loadedAccount.root.o.$jazz.waitForSync();
  }

  const capabilities = loadedAccount.root.o.capabilities;

  // Ensure capabilities list is fully loaded and synced
  if (capabilities && !capabilities.$isLoaded) {
    await capabilities.$jazz.waitForSync();
  }
  // Wait a bit more to ensure all items are loaded
  if (capabilities && capabilities.$isLoaded) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Check if PublicRead capability already exists for this avatar's owner group
  // We check if any capability group is already a member of the avatar's owner group
  if (capabilities && capabilities.$isLoaded) {
    try {
      // Get parent groups (members) of the avatar's owner group
      const parentGroups = avatarOwnerGroup.getParentGroups ? avatarOwnerGroup.getParentGroups() : [];
      const capabilityGroupIds = parentGroups.map((g: any) => g.$jazz?.id).filter(Boolean);
      
      console.log(`[Capability] Checking capabilities for avatar group ${avatarOwnerGroupId}, parent groups:`, capabilityGroupIds);
      
      // Get all capabilities and ensure they're loaded
      const allCapabilities = Array.from(capabilities).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cap: any) => cap && cap.$jazz
      );
      
      // Wait for all capabilities to be loaded
      for (const cap of allCapabilities) {
        if (!cap.$isLoaded) {
          await cap.$jazz.waitForSync();
        }
      }
      
      // Filter to PublicRead capabilities
      const publicReadCapabilities = allCapabilities.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cap: any) => cap.$isLoaded && cap["@label"] === "PublicRead"
      );
      
      console.log(`[Capability] Found ${publicReadCapabilities.length} PublicRead capabilities, checking against ${capabilityGroupIds.length} parent groups`);
      
      const existingCapability = publicReadCapabilities.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cap: any) => {
          const capGroupId = cap.capabilityGroup;
          const exists = capabilityGroupIds.includes(capGroupId);
          if (exists) {
            console.log(`[Capability] Found existing capability with group ${capGroupId} already a member of avatar group`);
          }
          return exists;
        }
      );

      if (existingCapability) {
        console.log(
          `[Capability] PublicRead capability already exists for avatar group ${avatarOwnerGroupId}`
        );
        return existingCapability;
      }
    } catch (error) {
      console.warn(`[Capability] Error checking existing capabilities:`, error);
    }
  }

  // Create public capability group
  const capabilityGroup = Group.create();
  capabilityGroup.makePublic(); // Makes it publicly readable (defaults to "reader" role)

  // Create capability CoMap
  const capability = Capability.create({
    "@schema": "capability",
    "@label": "PublicRead",
    capabilityGroup: capabilityGroup.$jazz.id,
  });
  await capability.$jazz.waitForSync();

  // Add capability to capabilities list
  const currentCapabilities = capabilities && capabilities.$isLoaded
    ? Array.from(capabilities)
    : [];
  loadedAccount.root.o.$jazz.set("capabilities", [...currentCapabilities, capability]);
  await loadedAccount.root.o.$jazz.waitForSync();

  // Add capability group as readonly member to AVATAR's owner group (NOT human's)
  avatarOwnerGroup.addMember(capabilityGroup, "reader");
  await avatarOwnerGroup.$jazz.waitForSync();

  console.log(
    `[Capability] Created PublicRead capability for avatar group ${avatarOwnerGroupId}, capability group: ${capabilityGroup.$jazz.id}`
  );

  return capability;
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

/** Capability schema - tracks permission capabilities */
export const Capability = co.map({
  "@schema": z.literal("capability"),
  "@label": z.string(), // e.g., "PublicRead"
  capabilityGroup: z.string(), // Group CoValue ID (stored as string - best practice per Jazz docs)
});

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AppRoot = co.map({
  o: co.map({
    humans: co.list(Human), // List of Human CoValues (each auto-creates a Group via $jazz.owner)
    coops: co.list(Coop), // List of Coop CoValues (each auto-creates a Group via $jazz.owner)
    capabilities: co.list(Capability), // List of Capability CoValues for tracking permissions
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

      // Ensure PublicRead capability for avatar
      await ensurePublicReadCapability(human, account);

      account.$jazz.set("root", {
        o: {
          humans: [human],
          coops: [],
          capabilities: [],
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

      // Ensure PublicRead capability for avatar
      await ensurePublicReadCapability(human, account);

      root.$jazz.set("o", {
        humans: [human],
        coops: [],
        capabilities: [],
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

    // Ensure capabilities list exists
    if (!rootWithO.o.$jazz.has("capabilities")) {
      rootWithO.o.$jazz.set("capabilities", []);
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

      // Ensure PublicRead capability for avatar
      await ensurePublicReadCapability(human, account);

      rootWithO.o.$jazz.set("humans", [human]);
    } else {
      // Ensure capabilities list exists
      if (!rootWithO.o.$jazz.has("capabilities")) {
        rootWithO.o.$jazz.set("capabilities", []);
      }

      // Run data migrations for existing humans
      console.log("[Schema Migration] Running data migrations for existing humans");

      // Add avatar property if missing
      await migrateAddAvatarToHumans(account);

      // Add PublicRead capability for avatars
      await migrateAddPublicReadCapability(account);

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
