/**
 * Create Humans Actors - ID-Based Architecture with Foreach
 * Uses inline foreach templates for dynamic lists
 * ID-based parent-child relationships
 * Bottom-up creation: buttons → header → list → root
 */

import { Actor, ActorList, ActorMessage, VibesRegistry } from "@hominio/db";
import { Group, co, z } from "jazz-tools";
import { createRootCardComposite, createHeaderComposite, createTitleLeaf, createButtonLeaf } from '../../design-templates';

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

		// STEP 1: Create leaf actors (title, create button)
		const headerTitleActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: createTitleLeaf({ text: 'Humans', tag: 'h2' }),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'humans-header-title',
		}, group);

		// Create button will send messages to root
		let rootActorId: string = '';

		const createButtonActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: createButtonLeaf({
				text: 'Create Human',
				event: 'CREATE_HUMAN',
				payload: {},
				variant: 'primary'
			}),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [], // Will be set after root is created
			children: co.list(z.string()).create([]),
			role: 'humans-create-button',
		}, group);

		await Promise.all([
			headerTitleActor.$jazz.waitForSync(),
			createButtonActor.$jazz.waitForSync(),
		]);

		// STEP 2: Create composite actors (header, list)
		const headerActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
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
			currentState: 'idle',
			states: { 
				idle: {
					on: {
						REMOVE_HUMAN: { target: 'idle', actions: ['@entity/deleteEntity'] }
					}
				}
			},
			context: {
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
					items: 'queries.humans.items', // Data path resolved by Composite.svelte
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

		await Promise.all([
			headerActor.$jazz.waitForSync(),
			listActor.$jazz.waitForSync(),
		]);

		// STEP 3: Create card wrapper actor (inner card container)
		const cardWrapperActor = Actor.create({
			currentState: 'idle',
			states: { idle: {} },
			context: {},
			view: {
				container: {
					layout: 'flex',
					class: 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 flex-col gap-4'
				}
			},
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([headerActor.$jazz.id, listActor.$jazz.id]),
			role: 'humans-card-wrapper',
		}, group);

		await cardWrapperActor.$jazz.waitForSync();

		// STEP 4: Create root actor with outer container styling and action handlers
		// Use skill IDs (strings) so skillLoader can resolve them from registry
		const humansRootActor = Actor.create({
			currentState: 'idle',
			states: {
				idle: {
					on: {
						CREATE_HUMAN: { target: 'idle', actions: ['@human/createRandom'] }
					},
				},
			},
			context: {},
			view: {
				container: {
					layout: 'grid',
					class: 'max-w-6xl mx-auto grid-cols-1 p-2 @xs:p-3 @sm:p-4 @md:p-6'
				}
			},
			dependencies: {
				entities: root.entities.$jazz.id
			},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([cardWrapperActor.$jazz.id]),
			role: 'humans-root',
		}, group);

		await humansRootActor.$jazz.waitForSync();
		rootActorId = humansRootActor.$jazz.id;

		// STEP 5: Update subscriptions - CLEAN ARCHITECTURE FOR LIST/LIST ITEMS
		// Each actor subscribes to itself - no event bubbling!
		// This ensures each actor handles its own events within its own state machine.
		createButtonActor.subscriptions.$jazz.push(rootActorId); // Button sends CREATE_HUMAN to root
		listActor.subscriptions.$jazz.push(listActor.$jazz.id); // List handles its own REMOVE_HUMAN events
		humansRootActor.subscriptions.$jazz.push(rootActorId); // Root handles its own events
		
		await Promise.all([
			createButtonActor.$jazz.waitForSync(),
			listActor.$jazz.waitForSync(),
			humansRootActor.$jazz.waitForSync(),
		]);

		// DEBUG: Verify subscriptions
		console.log('[createHumansActors] Subscriptions setup:', {
			createButton: Array.from(createButtonActor.subscriptions || []),
			listActor: Array.from(listActor.subscriptions || []),
			rootActor: Array.from(humansRootActor.subscriptions || []),
			listActorId: listActor.$jazz.id,
			rootActorId: rootActorId,
		});

		// Add all actors to global actors list
		actorsList.$jazz.push(headerTitleActor);
		actorsList.$jazz.push(createButtonActor);
		actorsList.$jazz.push(headerActor);
		actorsList.$jazz.push(listActor);
		actorsList.$jazz.push(humansRootActor);

		await actorsList.$jazz.waitForSync();
		console.log('[createHumansActors] All actors created and synced');

		// Register root actor in vibes registry
		const loadedRootWithVibes = await root.$jazz.ensureLoaded({
			resolve: { vibes: true },
		});
		loadedRootWithVibes.vibes.$jazz.set('humans', rootActorId);
		await loadedRootWithVibes.vibes.$jazz.waitForSync();
		console.log('[createHumansActors] ✅ Registered humans root:', rootActorId);
		
		return rootActorId;
	} finally {
		locks.humans = false;
	}
}
