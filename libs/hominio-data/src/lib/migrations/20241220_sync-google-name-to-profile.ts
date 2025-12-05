/**
 * Migration: Sync Google Profile Name to Profile
 * Date: 2024-12-20
 * Description: Syncs BetterAuth Google profile name to profile firstName and lastName
 * 
 * IMPORTANT: Only syncs if profile firstName and lastName are BOTH empty.
 * This ensures users can overwrite values, and Google will NEVER overwrite them back.
 */

/**
 * Syncs Google profile name to profile firstName and lastName
 * 
 * Behavior:
 * - Only updates if BOTH firstName and lastName are empty (preserves user edits)
 * - Never overwrites existing values (users can freely edit and Google won't overwrite)
 * 
 * @param account - The Jazz account being migrated
 * @param googleName - The name from BetterAuth Google profile (e.g., "John Doe")
 */
export async function migrateSyncGoogleNameToProfile(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any,
    googleName?: string | null
): Promise<void> {
    if (!googleName || !googleName.trim()) {
        console.log("[Migration] No Google name provided, skipping sync");
        return;
    }

    console.log(`[Migration] Starting syncGoogleNameToProfile with name: ${googleName}`);
    try {
        // Ensure account profile is loaded
        const loadedAccount = await account.$jazz.ensureLoaded({
            resolve: { profile: true },
        });

        if (!loadedAccount.profile || !loadedAccount.profile.$isLoaded) {
            console.log("[Migration] No profile found, skipping sync");
            return;
        }

        const profile = loadedAccount.profile;
        const profileAny = profile as any;

        // Check if profile has firstName and lastName fields
        if (!profileAny.$jazz.has("firstName") || !profileAny.$jazz.has("lastName")) {
            console.log("[Migration] Profile doesn't have firstName/lastName fields yet, skipping sync");
            return;
        }

        // Get current profile values
        const currentFirstName = profileAny.firstName?.trim() || "";
        const currentLastName = profileAny.lastName?.trim() || "";

        // Only sync if both firstName and lastName are empty (don't overwrite user edits)
        if (currentFirstName || currentLastName) {
            console.log(`[Migration] Profile already has name set (${currentFirstName} ${currentLastName}), skipping sync`);
            return;
        }

        // Parse Google name
        const nameParts = googleName.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        if (!firstName) {
            console.log("[Migration] Could not extract firstName from Google name");
            return;
        }

        // Update profile with parsed name (only if empty)
        profileAny.$jazz.set("firstName", firstName);
        profileAny.$jazz.set("lastName", lastName);

        console.log(`[Migration] Synced Google name to profile: firstName="${firstName}", lastName="${lastName}"`);
    } catch (error) {
        console.error("[Migration] Error in syncGoogleNameToProfile:", error);
        // Don't throw - allow migration to continue
    }
}

