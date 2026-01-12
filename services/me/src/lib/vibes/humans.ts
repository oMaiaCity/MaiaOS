/**
 * Create Humans Actors - ID-Based Architecture with Foreach
 * Uses inline foreach templates for dynamic lists
 * ID-based parent-child relationships
 * Bottom-up creation: buttons → header → list → root
 */

import { createActorEntity, getVibesRegistry } from "@maia/db";
import { Group } from "jazz-tools";
import { createLeaf, createComposite } from '$lib/compositor/engines/factoryEngine';
import titleFactory from '$lib/compositor/factories/leafs/title.factory.json';
import headerFactory from '$lib/compositor/factories/composites/header.factory.json';
import rootCardFactory from '$lib/compositor/factories/composites/rootCard.factory.json';
import buttonFactory from '$lib/compositor/factories/leafs/button.factory.json';

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
		throw new Error('Already creating humans actors');
	}
	locks.humans = true;
	
	try {
		// Get the VibesRegistry entity
		const vibesRegistry = await getVibesRegistry(account);
		const existingHumansRootId = vibesRegistry.humans as string | undefined;
		
		if (existingHumansRootId && typeof existingHumansRootId === 'string' && existingHumansRootId.startsWith('co_')) {
			return existingHumansRootId;
		}

		// Load root to get actors list ID
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { root: { actors: true } },
		});
		const root = loadedAccount.root;
		if (!root?.actors) {
			throw new Error('Root actors list not found');
		}

	// Create group for actors (OPTIMISTIC - no blocking!)
	const group = Group.create();
	group.addMember('everyone', 'reader');
	// NO WAIT! Jazz syncs in background

		// ============================================
		// BOTTOM-UP CREATION: LEAFS → COMPOSITES → ROOT
		// ============================================

	// STEP 1: Create leaf actors (create button only - title is now inline)
	// ARCHITECTURE: 1 Actor = 1 Composite/Leaf
	// Simple title is now inline element in header composite
	
	// Create button - TRUE COLOCATION: handles its own @human/createRandom action
	const createButtonActor = await createActorEntity(account, {
		context: { visible: true },
		view: createLeaf(buttonFactory as any, {
			text: 'Create Human',
			event: '@human/createRandom',
			payload: {}
		}),
		dependencies: {},
		role: 'humans-create-button',
	}, group);

	// NO WAIT! Actors created locally, use immediately
	
	// STEP 2: Create composite actors (header, list)
	const headerActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			container: { 
				class: 'flex px-2 @xs:px-3 @sm:px-4 @md:px-6 py-3 @xs:py-3 @sm:py-4 border-b border-slate-200 flex-row justify-between items-center gap-3 h-auto overflow-hidden w-full'
			},
			elements: [
				{
					tag: 'h2',
					classes: 'text-2xl @xs:text-3xl @sm:text-4xl @md:text-5xl font-bold text-[#001a42] tracking-tight',
					elements: ['Humans']
				},
				{
					slot: 'children',
					tag: 'div',
					classes: 'flex gap-2'
				}
			]
		},
		dependencies: {},
		role: 'humans-header',
	}, group);
	// Set children after creation (button is still an actor - has events)
	headerActor.children.$jazz.push(createButtonActor.$jazz.id);

	// List actor with inline foreach template - contains queries and dependencies
	// ARCHITECTURAL PRINCIPLE: Each actor handles its own events (no bubbling!)
	const listActor = await createActorEntity(account, {
		context: {
			visible: true,
			queries: {
				humans: {
					schemaName: 'Human'
				}
			}
		},
		view: {
			container: {
				class: 'flex p-2 @xs:p-3 @sm:p-4 @md:p-6 flex-col gap-1.5 @xs:gap-2 @sm:gap-3 overflow-auto w-full'
			},
			foreach: {
				items: 'context.queries.humans.items', // CLEAN ARCHITECTURE: Always use context.* prefix
				key: 'id',
					composite: {
						// Inline template for each human item (matches legacy humanItemLeaf styling)
						container: {
							class: 'flex flex-col @sm:flex-row items-start @sm:items-center gap-1 @xs:gap-1.5 @sm:gap-2 @md:gap-3 px-1.5 py-1 @xs:px-2 @xs:py-1.5 @sm:px-3 @sm:py-2 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] overflow-hidden'
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
									bindings: { 
										text: {
											"$if": {
												"test": { "$": "item.dateOfBirth" },
												"then": { "$formatDate": [{ "$": "item.dateOfBirth" }, "MMM d, yyyy"] },
												"else": ""
											}
										}
									}
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
											event: '@core/deleteEntity', // ✅ Renamed: Use generic delete tool
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
			entities: root.actors.$jazz.id // For queries.humans resolution
		},
		role: 'humans-list',
	}, group);

	// NO WAIT! Actors created locally, use immediately

	// STEP 3: Create root actor - SINGLE ACTOR with nested divs via elements[]
	// TRUE COLOCATION: Root actor is minimal (no actions), just a container
	const humansRootActor = await createActorEntity(account, {
		context: { visible: true },
		view: createComposite(rootCardFactory as any, { 
			cardLayout: 'flex', 
			cardClasses: 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 flex-col gap-4' 
		}),
		dependencies: {
			entities: root.actors.$jazz.id
		},
		role: 'humans-root',
	}, group);
	// Set children after creation
	humansRootActor.children.$jazz.push(headerActor.$jazz.id);
	humansRootActor.children.$jazz.push(listActor.$jazz.id);

	// NO WAIT! Root actor created locally, use immediately

	// STEP 4: Update subscriptions - TRUE COLOCATION
	// Each actor subscribes to itself - no event bubbling!
	createButtonActor.subscriptions.$jazz.push(createButtonActor.$jazz.id); // Button handles its own CREATE_HUMAN
	listActor.subscriptions.$jazz.push(listActor.$jazz.id); // List handles its own @core/deleteEntity events
		
	// NO WAIT! Subscriptions updated locally, sync happens in background

	// Actors are automatically added to root.entities by createActorEntity

	// Register root actor in vibes registry (OPTIMISTIC - no blocking!)
	vibesRegistry.$jazz.set('humans', humansRootActor.$jazz.id);
	// NO WAIT! Registry updated locally, sync happens in background
	
	return humansRootActor.$jazz.id;
	} finally {
		locks.humans = false;
	}
}
