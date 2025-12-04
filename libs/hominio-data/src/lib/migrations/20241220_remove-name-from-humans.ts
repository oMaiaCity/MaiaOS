/**
 * Migration: Remove Name Property from Humans
 * Date: 2024-12-20
 * Description: Removes the `name` property from Human CoValues, as we now use avatar.firstName + avatar.lastName for @label
 */

import { loadAccountHumans } from "./migration-helpers.js";

/**
 * Removes the `name` property from all Human CoValues
 * @param account - The Jazz account being migrated
 */
export async function migrateRemoveNameFromHumans(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any
): Promise<void> {
    console.log("[Migration] Starting migrateRemoveNameFromHumans");
    try {
        // Load humans using shared helper
        const humansArray = await loadAccountHumans(account);
        if (!humansArray || humansArray.length === 0) {
            console.log("[Migration] No humans found, skipping migration");
            return;
        }

        console.log(`[Migration] Found ${humansArray.length} humans to check`);

        let removedCount = 0;
        let skippedCount = 0;
        let alreadyNoNameCount = 0;

        for (const human of humansArray) {
            if (!human) continue;

            try {
                // Skip if still not loaded after waiting
                if (!human.$isLoaded) {
                    console.log(`[Migration] Skipping unloaded human: ${human?.$jazz?.id || "unknown"}`);
                    skippedCount++;
                    continue;
                }

                // Check if human has jazz API and name property
                if (human.$jazz && typeof human.$jazz.has === "function" && typeof human.$jazz.delete === "function") {
                    // Check if name property exists
                    if (human.$jazz.has("name")) {
                        console.log(`[Migration] Deleting name property from human: ${human.$jazz.id}`);
                        // Delete the name property using $jazz.delete
                        human.$jazz.delete("name");
                        removedCount++;
                    } else {
                        console.log(`[Migration] Human ${human.$jazz.id} already doesn't have name property`);
                        alreadyNoNameCount++;
                    }
                } else {
                    console.warn(`[Migration] Human ${human?.$jazz?.id || "unknown"} doesn't have valid $jazz API or delete method`);
                    skippedCount++;
                }
            } catch (humanError) {
                console.warn(`[Migration] Error migrating human ${human?.$jazz?.id || "unknown"}:`, humanError);
                skippedCount++;
            }
        }

        console.log(`[Migration] Completed: ${removedCount} had name deleted, ${alreadyNoNameCount} already had no name, ${skippedCount} skipped`);
    } catch (error) {
        console.error("[Migration] Error in migrateRemoveNameFromHumans:", error);
        // Don't throw - allow migration to continue even if it fails
    }
}

