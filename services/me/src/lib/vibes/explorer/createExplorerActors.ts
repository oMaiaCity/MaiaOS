/**
 * Create Explorer Actors - Minimal root actor for actor explorer vibe
 * Simple container for the explorer UI
 */

import { Actor, ActorList, ActorMessage } from "@maia/db";
import { Group, co, z } from "jazz-tools";
import { createRootCardComposite, createHeaderComposite, createTitleLeaf } from '../design-templates';

// Global lock
const getGlobalLock = () => {
	if (typeof window === 'undefined') return { explorer: false };
	if (!(window as any).__actorCreationLocks) {
		(window as any).__actorCreationLocks = { explorer: false };
	}
	return (window as any).__actorCreationLocks;
};

export async function createExplorerActors(account: any) {
	const locks = getGlobalLock();
	
	if (locks.explorer) {
		console.log('[createExplorerActors] Already creating (global lock), waiting...');
		throw new Error('Already creating explorer actors');
	}
	locks.explorer = true;
	
	try {
		console.log('[createExplorerActors] Starting actor creation...');
	
		// Ensure root is loaded
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { 
				root: {
					actors: true,
					vibes: true
				} 
			},
		});
		if (!loadedAccount.root?.$isLoaded) {
			throw new Error('Root is not loaded');
		}
		const root = loadedAccount.root;

		// Check registry for existing explorer root actor
		let rootWithVibes = await root.$jazz.ensureLoaded({
			resolve: { vibes: true },
		});
		
		if (!rootWithVibes.vibes?.$isLoaded) {
			throw new Error('Vibes registry is not loaded');
		}
		
		const vibesRegistry = rootWithVibes.vibes;
		const existingExplorerRootId = vibesRegistry.explorer as string | undefined;
		
		if (existingExplorerRootId && typeof existingExplorerRootId === 'string' && existingExplorerRootId.startsWith('co_')) {
			console.log('[createExplorerActors] ✅ Found existing explorer root:', existingExplorerRootId);
			return existingExplorerRootId;
		}

		console.log('[createExplorerActors] Creating new actors...');

	// Ensure actors list exists (OPTIMISTIC - no blocking!)
	let actorsList;
	if (!root.$jazz.has('actors')) {
		const actorsGroup = Group.create();
		actorsGroup.addMember('everyone', 'reader');
		actorsList = ActorList.create([], actorsGroup);
		root.$jazz.set('actors', actorsList);
	} else {
		actorsList = root.actors;
		if (!actorsList) {
			throw new Error('Actors list not found');
		}
	}

	// Create group for actors (OPTIMISTIC - no blocking!)
	const group = Group.create();
	group.addMember('everyone', 'reader');

	// STEP 1: Create title actor
	const titleActor = Actor.create({
		context: { visible: true },
		view: createTitleLeaf({ text: 'Actor Explorer', tag: 'h2' }),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([]),
		role: 'explorer-title',
	}, group);

	// STEP 2: Create header actor
	const headerActor = Actor.create({
		context: { visible: true },
		view: createHeaderComposite(),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([titleActor.$jazz.id]),
		role: 'explorer-header',
	}, group);

	// STEP 3: Create root actor
	const explorerRootActor = Actor.create({
		context: { visible: true },
		view: createRootCardComposite({ 
			cardLayout: 'flex', 
			cardClasses: 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 flex-col gap-4' 
		}),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([headerActor.$jazz.id]),
		role: 'explorer-root',
	}, group);

	// Add all actors to global actors list
	actorsList.$jazz.push(titleActor);
	actorsList.$jazz.push(headerActor);
	actorsList.$jazz.push(explorerRootActor);

	console.log('[createExplorerActors] ⚡ All actors created instantly (local-first)');

	// Register root actor in vibes registry (OPTIMISTIC - no blocking!)
	root.vibes.$jazz.set('explorer', explorerRootActor.$jazz.id);
	console.log('[createExplorerActors] ✅ Registered explorer root:', explorerRootActor.$jazz.id);
	
	return explorerRootActor.$jazz.id;
	} finally {
		locks.explorer = false;
	}
}
