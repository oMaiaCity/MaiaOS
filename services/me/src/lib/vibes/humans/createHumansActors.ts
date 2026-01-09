/**
 * Create Humans Actors - ID-Based Architecture with Foreach
 * Uses inline foreach templates for dynamic lists
 * ID-based parent-child relationships
 * Bottom-up creation: buttons → header → list → root
 */

import { Actor, ActorList, ActorMessage, VibesRegistry } from "@maia/db";
import { Group, co, z } from "jazz-tools";
import { createRootCardComposite, createHeaderComposite, createTitleLeaf, createButtonLeaf } from '../design-templates';

// Global lock
const getGlobalLock = () => {
	if (typeof window === 'undefined') return { vibes: false, humans: false };
	if (!(window as any).__actorCreationLocks) {
		(window as any).__actorCreationLocks = { vibes: false, humans: false };
	}
	return (window as any).__actorCreationLocks;
};

export async function createHumansActors(account: any) {
	const locks = getGlobalLock();
	
	if (locks.humans) {
		console.log('[createHumansActors] Already creating (global lock), waiting...');
		throw new Error('Already creating humans actors');
	}
	locks.humans = true;
	
	try {
		console.log('[createHumansActors] Starting ID-based actor creation...');
	
		// Ensure root is loaded
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { 
				root: {
					actors: true,
					vibes: true,
					entities: true
				} 
			},
		});
		if (!loadedAccount.root?.$isLoaded) {
			throw new Error('Root is not loaded');
		}
		const root = loadedAccount.root;

		// Check registry for existing humans root actor
		let rootWithVibes = await root.$jazz.ensureLoaded({
			resolve: { vibes: true },
		});
		
		if (!rootWithVibes.vibes?.$isLoaded) {
			throw new Error('Vibes registry is not loaded');
		}
		
		const vibesRegistry = rootWithVibes.vibes;
		const existingHumansRootId = vibesRegistry.humans as string | undefined;
		
		if (existingHumansRootId && typeof existingHumansRootId === 'string' && existingHumansRootId.startsWith('co_')) {
			console.log('[createHumansActors] ✅ Found existing humans root:', existingHumansRootId);
			return existingHumansRootId;
		}

		console.log('[createHumansActors] Creating new actors...');

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

	// STEP 1: Create leaf actors (title, create button)
	const headerTitleActor = Actor.create({
		context: { visible: true },
		view: createTitleLeaf({ text: 'Humans', tag: 'h2' }),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([]),
		role: 'humans-header-title',
	}, group);

	// Create button - TRUE COLOCATION: handles its own @human/createRandom action
	const createButtonActor = Actor.create({
		context: { visible: true },
		view: createButtonLeaf({
			text: 'Create Human',
			event: '@human/createRandom',
			payload: {},
			variant: 'primary'
		}),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [], // Will subscribe to itself after creation
		children: co.list(z.string()).create([]),
		role: 'humans-create-button',
	}, group);

	// NO WAIT! Actors created locally, use immediately
	
	// STEP 2: Create composite actors (header, list)
	const headerActor = Actor.create({
		context: { visible: true },
		view: createHeaderComposite(),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([headerTitleActor.$jazz.id, createButtonActor.$jazz.id]),
		role: 'humans-header',
	}, group);

	// List actor with inline foreach template - contains queries and dependencies
	// ARCHITECTURAL PRINCIPLE: Each actor handles its own events (no bubbling!)
	const listActor = Actor.create({
		context: {
			visible: true,
			queries: {
				humans: {
					schemaName: 'Human',
					items: [] // Will be populated by ActorRenderer from entities
				}
			}
		},
			view: {
				container: {
					layout: 'flex',
					class: 'p-2 @xs:p-3 @sm:p-4 @md:p-6 flex-col gap-1.5 @xs:gap-2 @sm:gap-3 overflow-auto'
				},
			foreach: {
				items: 'context.queries.humans.items', // CLEAN ARCHITECTURE: Always use context.* prefix
				key: 'id',
					composite: {
						// Inline template for each human item (matches legacy humanItemLeaf styling)
						container: {
							layout: 'flex',
							class: 'flex-col @sm:flex-row items-start @sm:items-center gap-1 @xs:gap-1.5 @sm:gap-2 @md:gap-3 px-1.5 py-1 @xs:px-2 @xs:py-1.5 @sm:px-3 @sm:py-2 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)]'
						},
						children: [
							{
								slot: 'name',
								leaf: {
									tag: 'div',
									classes: 'flex-1 min-w-0 text-[10px] @xs:text-xs @sm:text-sm font-semibold text-slate-900 truncate',
									bindings: { text: 'item.name' }
								}
							},
							{
								slot: 'email',
								leaf: {
									tag: 'div',
									classes: 'flex-1 min-w-0 text-[9px] @xs:text-[10px] @sm:text-xs text-slate-600 truncate',
									bindings: { text: 'item.email' }
								}
							},
							{
								slot: 'dob',
								leaf: {
									tag: 'div',
									classes: 'flex-1 min-w-0 text-[9px] @xs:text-[10px] @sm:text-xs text-slate-500 truncate',
									bindings: { text: "item.dateOfBirth ? new Date(item.dateOfBirth).toLocaleDateString() : ''" }
								}
							},
							{
								slot: 'delete',
								leaf: {
									tag: 'button',
									classes: 'px-1 py-0.5 @xs:px-1.5 @xs:py-1 @sm:px-2 @sm:py-1 text-[10px] @xs:text-xs @sm:text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-all duration-200 w-4 h-4 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 flex items-center justify-center shrink-0',
									attributes: { type: 'button' },
									elements: ['✕'],
									events: {
										click: {
											event: 'REMOVE_HUMAN',
											payload: { id: 'item.id' } // Object with data path - will be resolved to { id: <actual_id> }
										}
									}
								}
							}
						]
					}
				}
			},
			dependencies: { 
				entities: root.entities.$jazz.id // For queries.humans resolution
			},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: co.list(z.string()).create([]), // Will subscribe to itself after creation
			children: co.list(z.string()).create([]),
			role: 'humans-list',
		}, group);

	// NO WAIT! Actors created locally, use immediately

	// STEP 3: Create root actor - SINGLE ACTOR with nested divs via elements[]
	// TRUE COLOCATION: Root actor is minimal (no actions), just a container
	const humansRootActor = Actor.create({
		context: { visible: true },
		view: createRootCardComposite({ 
			cardLayout: 'flex', 
			cardClasses: 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 flex-col gap-4' 
		}),
		dependencies: {
			entities: root.entities.$jazz.id
		},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [], // No subscriptions needed - root doesn't handle events
		children: co.list(z.string()).create([headerActor.$jazz.id, listActor.$jazz.id]),
		role: 'humans-root',
	}, group);

	// NO WAIT! Root actor created locally, use immediately

	// STEP 4: Update subscriptions - TRUE COLOCATION
	// Each actor subscribes to itself - no event bubbling!
	createButtonActor.subscriptions.$jazz.push(createButtonActor.$jazz.id); // Button handles its own CREATE_HUMAN
	listActor.subscriptions.$jazz.push(listActor.$jazz.id); // List handles its own REMOVE_HUMAN events
		
	// NO WAIT! Subscriptions updated locally, sync happens in background

	// DEBUG: Verify subscriptions
	console.log('[createHumansActors] Subscriptions setup:', {
		createButton: Array.from(createButtonActor.subscriptions || []),
		listActor: Array.from(listActor.subscriptions || []),
		createButtonId: createButtonActor.$jazz.id,
		listActorId: listActor.$jazz.id,
	});

	// Add all actors to global actors list
	actorsList.$jazz.push(headerTitleActor);
	actorsList.$jazz.push(createButtonActor);
	actorsList.$jazz.push(headerActor);
	actorsList.$jazz.push(listActor);
	actorsList.$jazz.push(humansRootActor);

	// NO WAIT! Actors list updated locally, sync happens in background
	console.log('[createHumansActors] ⚡ All actors created instantly (local-first)');

	// Register root actor in vibes registry (OPTIMISTIC - no blocking!)
	root.vibes.$jazz.set('humans', humansRootActor.$jazz.id);
	// NO WAIT! Registry updated locally, sync happens in background
	console.log('[createHumansActors] ✅ Registered humans root:', humansRootActor.$jazz.id);
	
	return humansRootActor.$jazz.id;
	} finally {
		locks.humans = false;
	}
}
