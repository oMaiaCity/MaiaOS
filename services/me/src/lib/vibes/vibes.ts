/**
 * Create Vibes Actors - ID-Based Architecture
 * Uses template factories that return CompositeNode/LeafNode
 * ID-based parent-child relationships (no role queries)
 * Bottom-up creation: leafs → composites → root
 */

import { createActorEntity, getVibesRegistry } from "@maia/db";
import { Group } from "jazz-tools";
import { createLeaf, createComposite } from '$lib/compositor/engines/factoryEngine';
import titleFactory from '$lib/compositor/factories/leafs/title.factory.json';
import headerFactory from '$lib/compositor/factories/composites/header.factory.json';
import rootCardFactory from '$lib/compositor/factories/composites/rootCard.factory.json';

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
	
	// Get the VibesRegistry entity
	const vibesRegistry = await getVibesRegistry(account);
	const existingVibesRootId = vibesRegistry.vibes as string | undefined;
	
	if (existingVibesRootId && typeof existingVibesRootId === 'string' && existingVibesRootId.startsWith('co_')) {
		console.log('[createVibesActors] ✅ Found existing vibes root:', existingVibesRootId);
		return existingVibesRootId;
	}

		console.log('[createVibesActors] Creating new actors...');

	// Create group for actors (OPTIMISTIC - no blocking!)
	const group = Group.create();
	group.addMember('everyone', 'reader');
	// NO WAIT! Jazz syncs in background

		// ============================================
		// BOTTOM-UP CREATION: LEAFS → COMPOSITES → ROOT
		// ============================================

	// STEP 1: Create leaf actors (titles, descriptions)
	const headerTitleActor = await createActorEntity(account, {
		context: { visible: true },
		view: createLeaf(titleFactory as any, { text: 'Vibes', tag: 'h2' }),
		dependencies: {},
		role: 'vibes-header-title', // For debugging only
	}, group);

	const humansTitleActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			tag: 'h3',
			classes: 'text-base font-semibold text-slate-700',
			elements: ['Humans']
		},
		dependencies: {},
		role: 'humans-card-title',
	}, group);

	const humansDescActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			tag: 'p',
			classes: 'text-xs text-slate-600',
			elements: ['Human contact management vibe']
		},
		dependencies: {},
		role: 'humans-card-desc',
	}, group);

	const todosTitleActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			tag: 'h3',
			classes: 'text-base font-semibold text-slate-900',
			elements: ['Todos']
		},
		dependencies: {},
		role: 'todos-card-title',
	}, group);

	const todosDescActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			tag: 'p',
			classes: 'text-xs text-slate-600',
			elements: ['Task management and todo lists']
		},
		dependencies: {},
		role: 'todos-card-desc',
	}, group);

	// NO WAIT! All leaf actors created locally, use immediately
	
	// STEP 2: Create composite actors (cards, header)
		// NOTE: rootActorId will be set after root is created
		let rootActorId: string = '';

	// NAVIGATION CARDS: Use @ui/navigate skill for true colocation
	const humansCardActor = await createActorEntity(account, {
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
		role: 'humans-card',
	}, group);
	// Set children after creation
	humansCardActor.children.$jazz.push(humansTitleActor.$jazz.id);
	humansCardActor.children.$jazz.push(humansDescActor.$jazz.id);

	const todosCardActor = await createActorEntity(account, {
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
		role: 'todos-card',
	}, group);
	// Set children after creation
	todosCardActor.children.$jazz.push(todosTitleActor.$jazz.id);
	todosCardActor.children.$jazz.push(todosDescActor.$jazz.id);

	const headerActor = await createActorEntity(account, {
		context: { visible: true },
		view: createComposite(headerFactory as any, {}),
		dependencies: {},
		role: 'vibes-header',
	}, group);
	// Set children after creation
	headerActor.children.$jazz.push(headerTitleActor.$jazz.id);

	const gridActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			container: {
				layout: 'grid',
				class: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
			}
		},
		dependencies: {},
		role: 'vibes-grid',
	}, group);
	// Set children after creation
	gridActor.children.$jazz.push(humansCardActor.$jazz.id);
	gridActor.children.$jazz.push(todosCardActor.$jazz.id);

	// NO WAIT! All composite actors created locally, use immediately

	// STEP 3: Create root actor - MINIMAL (no actions)
	const vibesRootActor = await createActorEntity(account, {
		context: { visible: true },
		view: createComposite(rootCardFactory as any, { cardLayout: 'flex', cardClasses: 'card p-4 flex-col gap-4' }),
		dependencies: {},
		role: 'vibes-root',
	}, group);
	// Set children after creation
	vibesRootActor.children.$jazz.push(headerActor.$jazz.id);
	vibesRootActor.children.$jazz.push(gridActor.$jazz.id);

	// NO WAIT! Root actor created locally, use immediately

	// STEP 4: Update card actors' subscriptions - Subscribe to ROOT for root-level state updates
	// Cards use @ui/navigate skill for true colocation (navigation handled by skill system)
	humansCardActor.subscriptions.$jazz.push(vibesRootActor.$jazz.id); // Send to ROOT, not self
	todosCardActor.subscriptions.$jazz.push(vibesRootActor.$jazz.id); // Send to ROOT, not self
	// NO WAIT! Subscriptions updated locally, sync happens in background

	// Actors are automatically added to root.entities by createActorEntity
	console.log('[createVibesActors] ⚡ All actors created instantly (local-first)');

	// Register root actor in vibes registry (OPTIMISTIC - no blocking!)
	console.log('[createVibesActors] DEBUG - vibesRegistry keys:', Object.keys(vibesRegistry));
	console.log('[createVibesActors] DEBUG - vibesRegistry.$jazz.keys():', Array.from((vibesRegistry.$jazz as any).keys?.() || []));
	console.log('[createVibesActors] DEBUG - vibesRegistry ID:', vibesRegistry.$jazz.id);
	console.log('[createVibesActors] DEBUG - Attempting to set "vibes" to:', vibesRootActor.$jazz.id);
	vibesRegistry.$jazz.set('vibes', vibesRootActor.$jazz.id);
	// NO WAIT! Registry updated locally, sync happens in background
	console.log('[createVibesActors] ✅ Registered vibes root:', vibesRootActor.$jazz.id);
	
	return vibesRootActor.$jazz.id;
	} finally {
		locks.vibes = false;
	}
}
