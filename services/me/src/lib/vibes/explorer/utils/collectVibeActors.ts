/**
 * Utility function to collect all actors for a vibe
 * Recursively traverses the actor tree via children relationships
 */

import { Actor } from "@hominio/db";

/**
 * Collect all actors for a vibe by recursively traversing from the root actor
 * @param account - The Jazz account
 * @param vibeName - Name of the vibe (e.g., 'humans', 'todos')
 * @returns Array of all actors in the vibe's tree
 */
export async function collectVibeActors(account: any, vibeName: string): Promise<Actor[]> {
	// Ensure root and vibes registry are loaded
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: {
			root: {
				vibes: true
			}
		}
	});

	const root = loadedAccount.root;
	if (!root?.$isLoaded) {
		console.warn('[collectVibeActors] Root not loaded');
		return [];
	}

	const registry = root.vibes;
	if (!registry?.$isLoaded) {
		console.warn('[collectVibeActors] Vibes registry not loaded');
		return [];
	}

	// Access registry property directly (like in +page.svelte)
	const vibeRootId = (
		vibeName === 'vibes' ? registry.vibes :
		vibeName === 'humans' ? registry.humans :
		vibeName === 'designTemplates' ? registry.designTemplates :
		vibeName === 'todos' ? registry.todos :
		vibeName === 'explorer' ? registry.explorer :
		undefined
	) as string | undefined;
	
	if (!vibeRootId || !vibeRootId.startsWith('co_')) {
		console.warn(`[collectVibeActors] No vibe root ID found for '${vibeName}'`);
		return [];
	}
	
	const allActors: Actor[] = [];
	const visited = new Set<string>();
	
	// Recursive function to collect actors using raw Jazz node API
	async function collectFromActor(actorId: string) {
		if (visited.has(actorId)) return;
		visited.add(actorId);
		
		try {
			// Load actor using account's node (works outside component context)
			const node = account.$jazz.node;
			const rawActor = await node.load(actorId as any);
			
			if (rawActor === 'unavailable') {
				console.warn(`[collectVibeActors] Actor ${actorId} unavailable`);
				return;
			}
			
			// Convert raw CoValue to Actor type
			// We need to access it through the account's CoValue system
			// Actually, let's use ensureLoaded with a resolve path that includes the actor
			// But we need to access it through root.actors list instead
			
			// Alternative: Load through root.actors list
			const rootWithActors = await account.$jazz.ensureLoaded({
				resolve: {
					root: {
						actors: true
					}
				}
			});
			
			const actorsList = rootWithActors.root.actors;
			if (!actorsList?.$isLoaded) {
				console.warn(`[collectVibeActors] Actors list not loaded`);
				return;
			}
			
			// Find the actor in the actors list
			let actor: Actor | undefined;
			for (const a of actorsList) {
				if (a?.$isLoaded && a.$jazz.id === actorId) {
					actor = a as Actor;
					break;
				}
			}
			
			if (!actor) {
				// Actor not in list yet, try loading it directly via node and wrapping
				// For now, skip actors not in the list
				console.warn(`[collectVibeActors] Actor ${actorId} not found in actors list`);
				return;
			}
			
			allActors.push(actor);
			console.log(`[collectVibeActors] Collected actor: ${actor.role || 'unknown'} (${actorId.slice(0, 10)}...)`);
			
			// Ensure children are loaded
			if (actor.children) {
				await actor.children.$jazz.ensureLoaded();
				
				if (actor.children.$isLoaded) {
					const children = Array.from(actor.children) as string[];
					console.log(`[collectVibeActors] Actor ${actor.role} has ${children.length} children`);
					for (const childId of children) {
						await collectFromActor(childId);
					}
				} else {
					console.log(`[collectVibeActors] Actor ${actor.role} children not loaded`);
				}
			} else {
				console.log(`[collectVibeActors] Actor ${actor.role} has no children`);
			}
		} catch (error) {
			console.warn(`[collectVibeActors] Failed to load actor ${actorId}:`, error);
		}
	}
	
	console.log(`[collectVibeActors] Starting collection from root: ${vibeRootId}`);
	await collectFromActor(vibeRootId);
	console.log(`[collectVibeActors] Collected ${allActors.length} actors total`);
	return allActors;
}
