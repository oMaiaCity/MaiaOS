/**
 * Create Vibes Actors - ID-Based Architecture
 * Uses template factories that return CompositeConfig/LeafNode
 * ID-based parent-child relationships (no role queries)
 * Bottom-up creation: leafs → composites → root
 */

import { Actor, ActorList, ActorMessage, VibesRegistry } from "@maia/db";
import { Group, co, z } from "jazz-tools";
import { createRootCardComposite, createHeaderComposite, createTitleLeaf, createButtonLeaf } from '../design-templates';

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

	// Ensure actors list exists (OPTIMISTIC - no blocking!)
	let actorsList;
	if (!root.$jazz.has('actors')) {
		const actorsGroup = Group.create();
		actorsGroup.addMember('everyone', 'reader');
		// NO WAIT! Jazz syncs in background
		actorsList = ActorList.create([], actorsGroup);
		// NO WAIT! Use immediately
		root.$jazz.set('actors', actorsList);
		// NO WAIT! Local-first = instant
	} else {
		// Direct access - no ensureLoaded needed
		actorsList = root.actors;
		if (!actorsList) {
			throw new Error('Actors list not found');
		}
	}

	// Create group for actors (OPTIMISTIC - no blocking!)
	const group = Group.create();
	group.addMember('everyone', 'reader');
	// NO WAIT! Jazz syncs in background

		// ============================================
		// BOTTOM-UP CREATION: LEAFS → COMPOSITES → ROOT
		// ============================================

	// STEP 1: Create leaf actors (titles, descriptions)
	const headerTitleActor = Actor.create({
		context: { visible: true },
		view: createTitleLeaf({ text: 'Vibes', tag: 'h2' }),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([]),
		role: 'vibes-header-title', // For debugging only
	}, group);

	const humansTitleActor = Actor.create({
		context: { visible: true },
		view: createTitleLeaf({ text: 'Humans', tag: 'h3', classes: 'text-base font-semibold text-slate-700' }),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([]),
		role: 'humans-card-title',
	}, group);

	const humansDescActor = Actor.create({
		context: { visible: true },
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

	const todosTitleActor = Actor.create({
		context: { visible: true },
		view: {
			tag: 'h3',
			classes: 'text-base font-semibold text-slate-900',
			elements: ['Todos']
		},
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([]),
		role: 'todos-card-title',
	}, group);

	const todosDescActor = Actor.create({
		context: { visible: true },
		view: {
			tag: 'p',
			classes: 'text-xs text-slate-600',
			elements: ['Task management and todo lists']
		},
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([]),
		role: 'todos-card-desc',
	}, group);

	// NO WAIT! All leaf actors created locally, use immediately
	
	// STEP 2: Create composite actors (cards, header)
		// NOTE: rootActorId will be set after root is created
		let rootActorId: string = '';

	// NAVIGATION CARDS: Use @ui/navigate skill for true colocation
	const humansCardActor = Actor.create({
		context: { visible: true },
		view: {
			container: {
				layout: 'flex',
				class: 'card p-4 flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow'
			},
			events: {
				click: {
					event: '@ui/navigate',
					payload: { vibeName: 'humans' }
				}
			}
		},
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [], // Subscribe to ROOT actor (set later) for any root-level state updates
		children: co.list(z.string()).create([humansTitleActor.$jazz.id, humansDescActor.$jazz.id]),
		role: 'humans-card',
	}, group);

	const todosCardActor = Actor.create({
		context: { visible: true },
		view: {
			container: {
				layout: 'flex',
				class: 'card p-4 flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow'
			},
			events: {
				click: {
					event: '@ui/navigate',
					payload: { vibeName: 'todos' }
				}
			}
		},
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [], // Subscribe to ROOT actor (set later) for any root-level state updates
		children: co.list(z.string()).create([todosTitleActor.$jazz.id, todosDescActor.$jazz.id]),
		role: 'todos-card',
	}, group);

	const headerActor = Actor.create({
		context: { visible: true },
		view: createHeaderComposite(),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([headerTitleActor.$jazz.id]),
		role: 'vibes-header',
	}, group);

	const gridActor = Actor.create({
		context: { visible: true },
		view: {
			container: {
				layout: 'grid',
				class: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
			}
		},
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([
			humansCardActor.$jazz.id,
			todosCardActor.$jazz.id
		]),
		role: 'vibes-grid',
	}, group);

	// NO WAIT! All composite actors created locally, use immediately

	// STEP 3: Create root actor - MINIMAL (no actions)
	const vibesRootActor = Actor.create({
		context: { visible: true },
		view: createRootCardComposite({ cardLayout: 'flex', cardClasses: 'card p-4 flex-col gap-4' }),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [], // No subscriptions needed
		children: co.list(z.string()).create([headerActor.$jazz.id, gridActor.$jazz.id]),
		role: 'vibes-root',
	}, group);

	// NO WAIT! Root actor created locally, use immediately

	// STEP 4: Update card actors' subscriptions - Subscribe to ROOT for root-level state updates
	// Cards use @ui/navigate skill for true colocation (navigation handled by skill system)
	const humansSubscriptions = humansCardActor.subscriptions;
	if (humansSubscriptions?.$isLoaded) {
		humansSubscriptions.$jazz.push(vibesRootActor.$jazz.id); // Send to ROOT, not self
	}
	const todosSubscriptions = todosCardActor.subscriptions;
	if (todosSubscriptions?.$isLoaded) {
		todosSubscriptions.$jazz.push(vibesRootActor.$jazz.id); // Send to ROOT, not self
	}
	// NO WAIT! Subscriptions updated locally, sync happens in background

	// Add all actors to global actors list
	actorsList.$jazz.push(headerTitleActor);
	actorsList.$jazz.push(humansTitleActor);
	actorsList.$jazz.push(humansDescActor);
	actorsList.$jazz.push(todosTitleActor);
	actorsList.$jazz.push(todosDescActor);
	actorsList.$jazz.push(humansCardActor);
	actorsList.$jazz.push(todosCardActor);
	actorsList.$jazz.push(headerActor);
	actorsList.$jazz.push(gridActor);
	actorsList.$jazz.push(vibesRootActor);

	// NO WAIT! Actors list updated locally, sync happens in background
	console.log('[createVibesActors] ⚡ All actors created instantly (local-first)');

	// Register root actor in vibes registry (OPTIMISTIC - no blocking!)
	root.vibes.$jazz.set('vibes', vibesRootActor.$jazz.id);
	// NO WAIT! Registry updated locally, sync happens in background
	console.log('[createVibesActors] ✅ Registered vibes root:', vibesRootActor.$jazz.id);
	
	return vibesRootActor.$jazz.id;
	} finally {
		locks.vibes = false;
	}
}
