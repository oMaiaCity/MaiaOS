/**
 * Migration: Sync Google Profile Image to Avatar
 * Date: 2024-12-20
 * Description: Downloads Google profile image and stores it as ImageDefinition in human avatar.image
 * 
 * IMPORTANT: Only syncs if avatar.image is empty.
 * This ensures users can overwrite values, and Google will NEVER overwrite them back.
 * Processes all humans in the account.
 */

import { loadAccountHumans } from "./migration-helpers.js";
import { createImage } from "jazz-tools/media";

/**
 * Syncs Google profile image to human avatar.image
 * 
 * Behavior:
 * - Downloads image from Google at original resolution (=s1048-c)
 * - Converts to ImageDefinition using createImage()
 * - Only updates if image is empty (preserves user edits)
 * - Processes ALL humans in the account
 * - Never overwrites existing images (users can freely edit and Google won't overwrite)
 * 
 * @param account - The Jazz account being migrated
 * @param googleImageUrl - The image URL from BetterAuth Google profile
 */
export async function migrateSyncGoogleImageToAvatar(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any,
    googleImageUrl?: string | null
): Promise<void> {
    if (!googleImageUrl || !googleImageUrl.trim()) {
        console.log("[Migration] No Google image URL provided, skipping sync");
        return;
    }

    console.log(`[Migration] Starting syncGoogleImageToAvatar with URL: ${googleImageUrl}`);
    try {
        // Load humans using shared helper FIRST
        const humansArray = await loadAccountHumans(account);
        if (!humansArray || humansArray.length === 0) {
            console.log("[Migration] No humans found, skipping sync");
            return;
        }

        // FIRST: Check if any humans need image sync (before downloading)
        let needsSync = false;
        for (const human of humansArray) {
            if (!human || !human.$isLoaded || !human.$jazz) {
                continue;
            }

            if (!human.$jazz.has("avatar")) {
                // No avatar property - will be created by migrateAddAvatarToHumans first
                needsSync = true;
                break;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentAvatar = human.avatar as any;
            
            // Check if avatar CoMap has 'image' property using $jazz.has()
            // This is the most reliable way to check property existence in Jazz CoMaps
            const avatarHasImageProperty = currentAvatar && 
                typeof currentAvatar === 'object' && 
                '$jazz' in currentAvatar &&
                typeof (currentAvatar.$jazz as any).has === 'function' &&
                (currentAvatar.$jazz as any).has('image');
            
            // Also check the actual value (ImageDefinition objects are truthy)
            const currentImageValue = currentAvatar?.image;

            // If avatar doesn't have image property OR image value is null/undefined, we need to sync
            if (!avatarHasImageProperty || !currentImageValue) {
                needsSync = true;
                break;
            }
        }

        // If no humans need sync, skip expensive download
        if (!needsSync) {
            console.log("[Migration] All humans already have images, skipping sync");
            return;
        }

        // Only download image if we actually need to sync
        // Remove any size parameters to get the original full-size image
        // Google image URLs typically end with =s{size}-c or =s{size}
        let originalImageUrl = googleImageUrl.trim();
        
        // Remove size parameters to get original resolution
        originalImageUrl = originalImageUrl.replace(/=s\d+(-c)?$/, "");
        originalImageUrl = originalImageUrl.replace(/=s\d+(-c)?/, "");
        
        console.log(`[Migration] Using original resolution URL (no size params): ${originalImageUrl}`);

        // Download the image via server-side proxy to bypass CORS
        // The browser fetch() API is blocked by CORS, so we use our server proxy
        let imageBlob: Blob | null = null;
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[Migration] Downloading image via proxy... (attempt ${attempt}/${maxRetries})`);
                
                // Use server-side proxy to bypass CORS
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(originalImageUrl)}`;
                const response = await fetch(proxyUrl);
                
                if (response.status === 429) {
                    // Rate limited - wait and retry
                    if (attempt < maxRetries) {
                        const waitTime = retryDelay * attempt; // Exponential backoff
                        console.log(`[Migration] Rate limited (429), waiting ${waitTime}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    } else {
                        throw new Error(`Rate limited after ${maxRetries} attempts`);
                    }
                }
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: response.statusText }));
                    throw new Error(`Failed to fetch image: ${response.status} ${errorData.error || response.statusText}`);
                }
                
                // Parse the JSON response with base64 image data
                const imageData = await response.json();
                if (!imageData.data || !imageData.mimeType) {
                    throw new Error("Invalid response from proxy");
                }
                
                // Convert base64 back to blob
                const binaryString = atob(imageData.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                imageBlob = new Blob([bytes], { type: imageData.mimeType });
                
                console.log(`[Migration] Image downloaded successfully (${imageBlob.size} bytes, ${imageData.mimeType})`);
                break; // Success, exit retry loop
            } catch (fetchError) {
                if (attempt === maxRetries) {
                    console.error("[Migration] Error downloading image after all retries:", fetchError);
                    return; // Can't proceed without the image
                }
                // Wait before retry
                console.log(`[Migration] Retrying in ${retryDelay * attempt}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
        
        if (!imageBlob) {
            console.error("[Migration] Failed to download image after all retries");
            return;
        }

        // Process all humans - sync Google image only if image is empty
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
            
            // Check if avatar CoMap has 'image' property using $jazz.has()
            const avatarHasImageProperty = currentAvatar && 
                typeof currentAvatar === 'object' && 
                '$jazz' in currentAvatar &&
                typeof (currentAvatar.$jazz as any).has === 'function' &&
                (currentAvatar.$jazz as any).has('image');
            
            // Also check the actual value
            const currentImage = currentAvatar?.image;

            // Only sync if image is empty (don't overwrite user edits)
            // Check both property existence and value truthiness
            if (avatarHasImageProperty && currentImage) {
                console.log(`[Migration] Human ${human.$jazz.id} already has image, skipping sync`);
                skippedCount++;
                continue;
            }

            // Get the human's owner group (Jazz auto-creates a Group when Human is created)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ownerGroup = (human.$jazz as any).owner;
            if (!ownerGroup) {
                console.error(`[Migration] Human ${human.$jazz.id} doesn't have an owner group, cannot create image`);
                skippedCount++;
                continue;
            }

            // Create ImageDefinition from the downloaded blob using the human's owner group
            let imageDefinition: any = null;
            try {
                console.log(`[Migration] Creating ImageDefinition for human ${human.$jazz.id}...`);
                imageDefinition = await createImage(imageBlob, {
                    owner: ownerGroup,
                    maxSize: 1024, // Limit to 1024px on longest side
                    placeholder: "blur", // Generate blurry placeholder
                    progressive: true, // Enable progressive loading
                });
                console.log(`[Migration] ImageDefinition created successfully: ${imageDefinition.$jazz.id}`);
            } catch (createError) {
                console.error(`[Migration] Error creating ImageDefinition for human ${human.$jazz.id}:`, createError);
                skippedCount++;
                continue; // Skip this human but continue with others
            }

            // Update avatar with ImageDefinition (only if empty)
            // Preserve existing firstName and lastName
            const avatarUpdate: any = {
                firstName: currentAvatar?.firstName || "",
                lastName: currentAvatar?.lastName || "",
                image: imageDefinition,
            };
            human.$jazz.set("avatar", avatarUpdate);

            console.log(`[Migration] Synced Google image to human ${human.$jazz.id}`);
            syncedCount++;
        }

        console.log(`[Migration] Sync completed: ${syncedCount} synced, ${skippedCount} skipped`);
    } catch (error) {
        console.error("[Migration] Error in syncGoogleImageToAvatar:", error);
        // Don't throw - allow migration to continue
    }
}

