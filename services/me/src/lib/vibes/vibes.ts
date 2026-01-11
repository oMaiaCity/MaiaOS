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

	// STEP 1: Create composite actors (cards, header)
	// ARCHITECTURE: 1 Actor = 1 Composite/Leaf
	// Simple titles/descriptions are now inline elements[] within parent composites
	// NAVIGATION CARDS: Use @ui/navigate skill for true colocation
	// Inline title/description as elements[] (no separate actors needed)
	const humansCardActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			container: {
				class: 'card p-4 flex flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow overflow-hidden w-full'
			},
			events: {
				click: {
					event: '@ui/navigate',
					payload: { vibeName: 'humans' }
				}
			},
			elements: [
				{ tag: 'h3', classes: 'text-base font-semibold text-slate-700', elements: ['Humans'] },
				{ tag: 'p', classes: 'text-xs text-slate-600', elements: ['Human contact management vibe'] }
			]
		},
		dependencies: {},
		role: 'humans-card',
	}, group);

	const todosCardActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			container: {
				class: 'card p-4 flex flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow overflow-hidden w-full'
			},
			events: {
				click: {
					event: '@ui/navigate',
					payload: { vibeName: 'todos' }
				}
			},
			elements: [
				{ tag: 'h3', classes: 'text-base font-semibold text-slate-900', elements: ['Todos'] },
				{ tag: 'p', classes: 'text-xs text-slate-600', elements: ['Task management and todo lists'] }
			]
		},
		dependencies: {},
		role: 'todos-card',
	}, group);

	const headerActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			container: { 
				class: 'flex px-2 @xs:px-3 @sm:px-4 @md:px-6 py-3 @xs:py-3 @sm:py-4 border-b border-slate-200 flex-col items-center gap-3 h-auto overflow-hidden w-full'
			},
			elements: [{
				tag: 'h2',
				classes: 'text-2xl @xs:text-3xl @sm:text-4xl @md:text-5xl font-bold text-[#001a42] tracking-tight',
				elements: ['Vibes']
			}]
		},
		dependencies: {},
		role: 'vibes-header',
	}, group);

	const gridActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			container: {
				class: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full overflow-hidden'
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
