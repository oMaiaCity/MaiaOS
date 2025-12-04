/**
 * Migration: Sync Google Profile Email to Contact
 * Date: 2024-12-20
 * Description: Syncs BetterAuth Google profile email to human contact.email
 * 
 * IMPORTANT: Only syncs if contact.email is empty.
 * This ensures users can overwrite values, and Google will NEVER overwrite them back.
 * Processes all humans in the account.
 */

import { loadAccountHumans } from "./migration-helpers.js";

/**
 * Syncs Google profile email to human contact.email
 * 
 * Behavior:
 * - Only updates if email is empty (preserves user edits)
 * - Processes ALL humans in the account
 * - Never overwrites existing values (users can freely edit and Google won't overwrite)
 * 
 * @param account - The Jazz account being migrated
 * @param googleEmail - The email from BetterAuth Google profile
 */
export async function migrateSyncGoogleEmailToContact(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any,
    googleEmail?: string | null
): Promise<void> {
    if (!googleEmail || !googleEmail.trim()) {
        console.log("[Migration] No Google email provided, skipping sync");
        return;
    }

    console.log(`[Migration] Starting syncGoogleEmailToContact with email: ${googleEmail}`);
    try {
        // Load humans using shared helper
        const humansArray = await loadAccountHumans(account);
        if (!humansArray || humansArray.length === 0) {
            console.log("[Migration] No humans found, skipping sync");
            return;
        }

        // FIRST: Check if any humans need email sync (before processing)
        let needsSync = false;
        for (const human of humansArray) {
            if (!human || !human.$isLoaded || !human.$jazz) {
                continue;
            }

            if (!human.$jazz.has("contact")) {
                needsSync = true;
                break;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentContact = human.contact as any;
            const currentEmail = currentContact?.email?.trim() || "";

            // If email is empty, we need to sync
            if (!currentEmail) {
                needsSync = true;
                break;
            }
        }

        // If no humans need sync, skip processing
        if (!needsSync) {
            console.log("[Migration] All humans already have email set, skipping sync");
            return;
        }

        // Process all humans - sync Google email only if email is empty
        // This allows users to overwrite values, and Google will never overwrite them back
        let syncedCount = 0;
        let skippedCount = 0;

        for (const human of humansArray) {
            if (!human || !human.$isLoaded || !human.$jazz) {
                skippedCount++;
                continue;
            }

            // Check if contact exists
            if (!human.$jazz.has("contact")) {
                // Create contact with email
                human.$jazz.set("contact", {
                    email: googleEmail.trim(),
                });
                console.log(`[Migration] Created contact and synced Google email to human ${human.$jazz.id}: email="${googleEmail}"`);
                syncedCount++;
                continue;
            }

            // Get current contact values
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentContact = human.contact as any;
            const currentEmail = currentContact?.email?.trim() || "";

            // Only sync if email is empty (don't overwrite user edits)
            if (currentEmail) {
                console.log(`[Migration] Human ${human.$jazz.id} already has email set (${currentEmail}), skipping sync`);
                skippedCount++;
                continue;
            }

            // Update contact with Google email (only if empty)
            human.$jazz.set("contact", {
                email: googleEmail.trim(),
            });

            console.log(`[Migration] Synced Google email to human ${human.$jazz.id}: email="${googleEmail}"`);
            syncedCount++;
        }

        console.log(`[Migration] Sync completed: ${syncedCount} synced, ${skippedCount} skipped`);
    } catch (error) {
        console.error("[Migration] Error in syncGoogleEmailToContact:", error);
        // Don't throw - allow migration to continue
    }
}

