/**
 * Reset Data Utility
 * Provides functions to clear specific vibes from the registry to force recreation
 */

export async function resetAllVibes(account: any) {
	console.log('[resetAllVibes] Deleting all vibes from registry...');
	
	const root = await account.$jazz.ensureLoaded({
		resolve: { vibes: true }
	});
	
	if (!root?.vibes?.$isLoaded) {
		throw new Error('Vibes registry not loaded');
	}
	
	// Dynamically DELETE ALL vibe entries (use delete instead of set to undefined)
	const vibeKeys = Object.keys(root.vibes).filter(key => !key.startsWith('$'));
	console.log(`[resetAllVibes] Deleting ${vibeKeys.length} vibe entries:`, vibeKeys);
	
	for (const key of vibeKeys) {
		root.vibes.$jazz.delete(key);
	}
	
	console.log('[resetAllVibes] ✅ Deleted all vibes from registry. Refresh to recreate.');
}
