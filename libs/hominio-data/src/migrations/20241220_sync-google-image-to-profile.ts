/**
 * Migration: Sync Google Profile Image to Profile
 * Date: 2024-12-20
 * Description: Downloads Google profile image and stores it as ImageDefinition in profile.image
 * 
 * IMPORTANT: Only syncs if profile.image is empty.
 * This ensures users can overwrite values, and Google will NEVER overwrite them back.
 */

import { createImage } from "jazz-tools/media";

/**
 * Syncs Google profile image to profile.image
 * 
 * Behavior:
 * - Downloads image from Google at original resolution (=s1048-c)
 * - Converts to ImageDefinition using createImage()
 * - Only updates if image is empty (preserves user edits)
 * - Never overwrites existing images (users can freely edit and Google won't overwrite)
 * 
 * @param account - The Jazz account being migrated
 * @param googleImageUrl - The image URL from BetterAuth Google profile
 */
export async function migrateSyncGoogleImageToProfile(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any,
    googleImageUrl?: string | null
): Promise<void> {
    if (!googleImageUrl || !googleImageUrl.trim()) {
        console.log("[Migration] No Google image URL provided, skipping sync");
        return;
    }

    console.log(`[Migration] Starting syncGoogleImageToProfile with URL: ${googleImageUrl}`);
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

        // Check if profile already has an image
        if (profileAny.$jazz.has("image")) {
            const currentImage = profileAny.image;
            // Check if image value exists and is populated
            if (currentImage && (currentImage as any).$jazz?.has("original")) {
                console.log("[Migration] Profile already has image, skipping sync");
                return;
            }
        }

        // Download image only if we need to sync
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

        // Get the profile's owner group (Jazz auto-creates a Group for profiles)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ownerGroup = (profile.$jazz as any).owner;
        if (!ownerGroup) {
            console.error("[Migration] Profile doesn't have an owner group, cannot create image");
            return;
        }

        // Create ImageDefinition from the downloaded blob using the profile's owner group
        let imageDefinition: any = null;
        try {
            console.log(`[Migration] Creating ImageDefinition for profile...`);
            imageDefinition = await createImage(imageBlob, {
                owner: ownerGroup,
                maxSize: 1024, // Limit to 1024px on longest side
                placeholder: "blur", // Generate blurry placeholder
                progressive: true, // Enable progressive loading
            });
            console.log(`[Migration] ImageDefinition created successfully: ${imageDefinition.$jazz.id}`);
        } catch (createError) {
            console.error(`[Migration] Error creating ImageDefinition for profile:`, createError);
            return; // Can't proceed without the image
        }

        // Update profile with ImageDefinition (only if empty)
        profileAny.$jazz.set("image", imageDefinition);

        console.log(`[Migration] Synced Google image to profile`);
    } catch (error) {
        console.error("[Migration] Error in syncGoogleImageToProfile:", error);
        // Don't throw - allow migration to continue
    }
}


