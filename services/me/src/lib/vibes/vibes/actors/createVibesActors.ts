/**
 * Create Vibes Actors - ID-Based Architecture
 * Uses template factories that return CompositeConfig/LeafNode
 * ID-based parent-child relationships (no role queries)
 * Bottom-up creation: leafs → composites → root
 */

import { Actor, ActorList, ActorMessage, VibesRegistry } from "@hominio/db";
import { Group, co, z } from "jazz-tools";
import { createRootCardComposite, createHeaderComposite, createTitleLeaf, createButtonLeaf } from '../../design-templates';

// Global lock that persists across hot reloads
const getGlobalLock = () => {
	if (typeof window === 'undefined') return { vibes: false, humans: false };
	if (!(window as any).__actorCreationLocks) {
		(window as any).__actorCreationLocks = { vibes: false, humans: false };
	}
	return (window as any).__actorCreationLocks;
};

export async function createVibesActors(account: any) {
	const locks = getGlobalLock();
	
	if (locks.vibes) {
		console.log('[createVibesActors] Already creating (global lock), waiting...');
		throw new Error('Already creating vibes actors');
	}
	locks.vibes = true;
	
	try {
		console.log('[createVibesActors] Starting ID-based actor creation...');
	
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

		// Check registry for existing vibes root actor
		let rootWithVibes = await root.$jazz.ensureLoaded({
			resolve: { vibes: true },
		});
		
		if (!rootWithVibes.vibes?.$isLoaded) {
			throw new Error('Vibes registry is not loaded');
		}
		
		const vibesRegistry = rootWithVibes.vibes;
		const existingVibesRootId = vibesRegistry.vibes as string | undefined;
		
		if (existingVibesRootId && typeof existingVibesRootId === 'string' && existingVibesRootId.startsWith('co_')) {
			console.log('[createVibesActors] ✅ Found existing vibes root:', existingVibesRootId);
			return existingVibesRootId;
		}

		console.log('[createVibesActors] Creating new actors...');

		// Ensure actors list exists
		let actorsList;
		if (!root.$jazz.has('actors')) {
			const actorsGroup = Group.create();
			actorsGroup.addMember('everyone', 'reader');
			await actorsGroup.$jazz.waitForSync();
			actorsList = ActorList.create([], actorsGroup);
			await actorsList.$jazz.waitForSync();
			root.$jazz.set('actors', actorsList);
			await root.$jazz.waitForSync();
		} else {
			const rootWithActors = await root.$jazz.ensureLoaded({
				resolve: { actors: true },
			});
			actorsList = rootWithActors.actors;
			if (!actorsList?.$isLoaded) {
				throw new Error('Actors list found but failed to load');
			}
		}

		const group = Group.create();
		group.addMember('everyone', 'reader');
		await group.$jazz.waitForSync();

		// ============================================
		// BOTTOM-UP CREATION: LEAFS → COMPOSITES → ROOT
		// ============================================

		// STEP 1: Create leaf actors (titles, descriptions)
		const headerTitleActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: createTitleLeaf({ text: 'Vibes', tag: 'h2' }),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'vibes-header-title', // For debugging only
		}, group);

		const humansTitleActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: createTitleLeaf({ text: 'Humans', tag: 'h3', classes: 'text-base font-semibold text-slate-700' }),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'humans-card-title',
		}, group);

		const humansDescActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: {
				tag: 'p',
				classes: 'text-xs text-slate-600',
				elements: ['Human contact management vibe']
			},
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'humans-card-desc',
		}, group);

		const designTemplatesTitleActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: createTitleLeaf({ text: 'Design Templates', tag: 'h3', classes: 'text-base font-semibold text-slate-700' }),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'design-templates-card-title',
		}, group);

		const designTemplatesDescActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: {
				tag: 'p',
				classes: 'text-xs text-slate-600',
				elements: ['Reusable UI component templates']
			},
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'design-templates-card-desc',
		}, group);

		// Wait for leaf actors to sync
		await Promise.all([
			headerTitleActor.$jazz.waitForSync(),
			humansTitleActor.$jazz.waitForSync(),
			humansDescActor.$jazz.waitForSync(),
			designTemplatesTitleActor.$jazz.waitForSync(),
			designTemplatesDescActor.$jazz.waitForSync(),
		]);

		// STEP 2: Create composite actors (cards, header)
		// NOTE: rootActorId will be set after root is created
		let rootActorId: string = '';

		const humansCardActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: {
				container: {
					layout: 'flex',
					class: 'card p-4 flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow'
				},
				events: {
					click: {
						event: 'SELECT_VIBE',
						payload: { vibeId: 'humans' }
					}
				}
			},
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [], // Will be set after root is created
			children: co.list(z.string()).create([humansTitleActor.$jazz.id, humansDescActor.$jazz.id]),
			role: 'humans-card',
		}, group);

		const designTemplatesCardActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: {
				container: {
					layout: 'flex',
					class: 'card p-4 flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow'
				},
				events: {
					click: {
						event: 'SELECT_VIBE',
						payload: { vibeId: 'designTemplates' }
					}
				}
			},
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [], // Will be set after root is created
			children: co.list(z.string()).create([designTemplatesTitleActor.$jazz.id, designTemplatesDescActor.$jazz.id]),
			role: 'design-templates-card',
		}, group);

		const headerActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: createHeaderComposite(),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([headerTitleActor.$jazz.id]),
			role: 'vibes-header',
		}, group);

		const gridActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: {
				container: {
					layout: 'flex',
					class: 'p-6 flex-col gap-4'
				}
			},
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([humansCardActor.$jazz.id, designTemplatesCardActor.$jazz.id]),
			role: 'vibes-grid',
		}, group);

		// Wait for composite actors to sync
		await Promise.all([
			humansCardActor.$jazz.waitForSync(),
			designTemplatesCardActor.$jazz.waitForSync(),
			headerActor.$jazz.waitForSync(),
			gridActor.$jazz.waitForSync(),
		]);

		// STEP 3: Create root actor with child IDs
		const vibesRootActor = Actor.create({
			currentState: 'idle',
			states: {
				idle: {
					on: { SELECT_VIBE: { target: 'idle', actions: [] } },
				},
			},
			context: {},
			view: createRootCardComposite({ cardLayout: 'flex', cardClasses: 'card p-4 flex-col gap-4' }),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([headerActor.$jazz.id, gridActor.$jazz.id]),
			role: 'vibes-root',
		}, group);

		await vibesRootActor.$jazz.waitForSync();
		rootActorId = vibesRootActor.$jazz.id;

		// STEP 4: Update card actors' subscriptions to point to root
		const humansSubscriptions = humansCardActor.subscriptions;
		if (humansSubscriptions?.$isLoaded) {
			humansSubscriptions.$jazz.push(rootActorId);
		}
		const designTemplatesSubscriptions = designTemplatesCardActor.subscriptions;
		if (designTemplatesSubscriptions?.$isLoaded) {
			designTemplatesSubscriptions.$jazz.push(rootActorId);
		}
		await Promise.all([
			humansCardActor.$jazz.waitForSync(),
			designTemplatesCardActor.$jazz.waitForSync(),
		]);

		// Add all actors to global actors list
		actorsList.$jazz.push(headerTitleActor);
		actorsList.$jazz.push(humansTitleActor);
		actorsList.$jazz.push(humansDescActor);
		actorsList.$jazz.push(designTemplatesTitleActor);
		actorsList.$jazz.push(designTemplatesDescActor);
		actorsList.$jazz.push(humansCardActor);
		actorsList.$jazz.push(designTemplatesCardActor);
		actorsList.$jazz.push(headerActor);
		actorsList.$jazz.push(gridActor);
		actorsList.$jazz.push(vibesRootActor);

		await actorsList.$jazz.waitForSync();
		console.log('[createVibesActors] All actors created and synced');

		// Register root actor in vibes registry
		const loadedRootWithVibes = await root.$jazz.ensureLoaded({
			resolve: { vibes: true },
		});
		loadedRootWithVibes.vibes.$jazz.set('vibes', rootActorId);
		await loadedRootWithVibes.vibes.$jazz.waitForSync();
		console.log('[createVibesActors] ✅ Registered vibes root:', rootActorId);
		
		return rootActorId;
	} finally {
		locks.vibes = false;
	}
}
