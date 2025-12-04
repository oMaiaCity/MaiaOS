/**
 * Migration: Sync Google Profile Name to Avatar
 * Date: 2024-12-20
 * Description: Syncs BetterAuth Google profile name to human avatar firstName and lastName
 * 
 * IMPORTANT: Only syncs if avatar firstName and lastName are BOTH empty.
 * This ensures users can overwrite values, and Google will NEVER overwrite them back.
 * Processes all humans in the account.
 */

import { loadAccountHumans } from "./migration-helpers.js";

/**
 * Syncs Google profile name to human avatar firstName and lastName
 * 
 * Behavior:
 * - Only updates if BOTH firstName and lastName are empty (preserves user edits)
 * - Processes ALL humans in the account
 * - Never overwrites existing values (users can freely edit and Google won't overwrite)
 * 
 * @param account - The Jazz account being migrated
 * @param googleName - The name from BetterAuth Google profile (e.g., "John Doe")
 */
export async function migrateSyncGoogleNameToAvatar(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any,
    googleName?: string | null
): Promise<void> {
    if (!googleName || !googleName.trim()) {
        console.log("[Migration] No Google name provided, skipping sync");
        return;
    }

    console.log(`[Migration] Starting syncGoogleNameToAvatar with name: ${googleName}`);
    try {
        // Load humans using shared helper
        const humansArray = await loadAccountHumans(account);
        if (!humansArray || humansArray.length === 0) {
            console.log("[Migration] No humans found, skipping sync");
            return;
        }

        // FIRST: Check if any humans need name sync (before parsing)
        let needsSync = false;
        for (const human of humansArray) {
            if (!human || !human.$isLoaded || !human.$jazz) {
                continue;
            }

            if (!human.$jazz.has("avatar")) {
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentAvatar = human.avatar as any;
            const currentFirstName = currentAvatar?.firstName?.trim() || "";
            const currentLastName = currentAvatar?.lastName?.trim() || "";

            // If both are empty, we need to sync
            if (!currentFirstName && !currentLastName) {
                needsSync = true;
                break;
            }
        }

        // If no humans need sync, skip expensive parsing
        if (!needsSync) {
            console.log("[Migration] All humans already have names set, skipping sync");
            return;
        }

        // Only parse Google name if we actually need to sync
        const nameParts = googleName.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        if (!firstName) {
            console.log("[Migration] Could not extract firstName from Google name");
            return;
        }

        // Process all humans - sync Google name only if firstName and lastName are empty
        // This allows users to overwrite values, and Google will never overwrite them back
        let syncedCount = 0;
        let skippedCount = 0;

        for (const human of humansArray) {
            if (!human || !human.$isLoaded || !human.$jazz) {
                skippedCount++;
                continue;
            }

            // Check if avatar exists
            if (!human.$jazz.has("avatar")) {
                console.log(`[Migration] Human ${human.$jazz.id} doesn't have avatar property yet, skipping`);
                skippedCount++;
                continue;
            }

            // Get current avatar values
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentAvatar = human.avatar as any;
            const currentFirstName = currentAvatar?.firstName?.trim() || "";
            const currentLastName = currentAvatar?.lastName?.trim() || "";

            // Only sync if both firstName and lastName are empty (don't overwrite user edits)
            if (currentFirstName || currentLastName) {
                console.log(`[Migration] Human ${human.$jazz.id} already has name set (${currentFirstName} ${currentLastName}), skipping sync`);
                skippedCount++;
                continue;
            }

            // Update avatar with parsed name (only if empty)
            // Preserve existing image if it exists (only include if actually populated)
            const avatarUpdate: any = {
                firstName: firstName,
                lastName: lastName,
            };
            // Only include image if it exists and is populated (has original file stream)
            if (currentAvatar?.image && (currentAvatar.image as any).$jazz?.has("original")) {
                avatarUpdate.image = currentAvatar.image;
            }
            human.$jazz.set("avatar", avatarUpdate);

            console.log(`[Migration] Synced Google name to human ${human.$jazz.id}: firstName="${firstName}", lastName="${lastName}"`);
            syncedCount++;
        }

        console.log(`[Migration] Sync completed: ${syncedCount} synced, ${skippedCount} skipped`);
    } catch (error) {
        console.error("[Migration] Error in syncGoogleNameToAvatar:", error);
        // Don't throw - allow migration to continue
    }
}

