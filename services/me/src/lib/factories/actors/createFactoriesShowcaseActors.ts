/**
 * Create Factories Showcase Actors
 * Showcase of available view factories
 */

import { Actor, ActorList, ActorMessage } from "@maia/db";
import { Group, co, z } from "jazz-tools";
import { createRootCardComposite, createHeaderComposite, createTitleLeaf, createButtonLeaf } from '../index';

// Global lock
const getGlobalLock = () => {
	if (typeof window === 'undefined') return { factories: false };
	if (!(window as any).__actorCreationLocks) {
		(window as any).__actorCreationLocks = { factories: false };
	}
	return (window as any).__actorCreationLocks;
};

export async function createFactoriesShowcaseActors(account: any) {
	const locks = getGlobalLock();
	
	if (locks.factories) {
		throw new Error('Already creating factories showcase actors');
	}
	locks.factories = true;
	
	try {
		console.log('[createFactoriesShowcaseActors] Starting...');
	
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { 
				root: {
					actors: true,
					vibes: true
				} 
			},
		});
		const root = loadedAccount.root;

		let rootWithVibes = await root.$jazz.ensureLoaded({
			resolve: { vibes: true },
		});
		
		const vibesRegistry = rootWithVibes.vibes;
		const existingRootId = vibesRegistry.factories as string | undefined;
		
		if (existingRootId && typeof existingRootId === 'string' && existingRootId.startsWith('co_')) {
			console.log('[createFactoriesShowcaseActors] ✅ Found existing root:', existingRootId);
			return existingRootId;
		}

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
		}

		const group = Group.create();
		group.addMember('everyone', 'reader');
		await group.$jazz.waitForSync();

		// Create simple showcase
		const titleActor = Actor.create({
			context: {},
			view: createTitleLeaf({ text: 'View Factories', tag: 'h2' }),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'factories-showcase-title',
		}, group);

		const descActor = Actor.create({
			context: {},
			view: {
				tag: 'p',
				classes: 'text-slate-600',
				elements: ['This page showcases reusable view factory functions for creating consistent UI components.']
			},
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'factories-showcase-desc',
		}, group);

		const exampleButtonActor = Actor.create({
			context: {},
			view: createButtonLeaf({
				text: 'Example Button',
				event: 'EXAMPLE_CLICK',
				payload: { message: 'Button clicked!' },
				variant: 'primary'
			}),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'factories-showcase-example-button',
		}, group);

		await Promise.all([
			titleActor.$jazz.waitForSync(),
			descActor.$jazz.waitForSync(),
			exampleButtonActor.$jazz.waitForSync(),
		]);

		const headerActor = Actor.create({
			context: {},
			view: createHeaderComposite(),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([titleActor.$jazz.id]),
			role: 'factories-showcase-header',
		}, group);

		const contentActor = Actor.create({
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
			children: co.list(z.string()).create([descActor.$jazz.id, exampleButtonActor.$jazz.id]),
			role: 'factories-showcase-content',
		}, group);

		await Promise.all([
			headerActor.$jazz.waitForSync(),
			contentActor.$jazz.waitForSync(),
		]);

		const rootActor = Actor.create({
			context: {},
			view: createRootCardComposite({ cardLayout: 'flex', cardClasses: 'card p-4 flex-col gap-4' }),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([headerActor.$jazz.id, contentActor.$jazz.id]),
			role: 'factories-showcase-root',
		}, group);

		await rootActor.$jazz.waitForSync();

		actorsList.$jazz.push(titleActor);
		actorsList.$jazz.push(descActor);
		actorsList.$jazz.push(exampleButtonActor);
		actorsList.$jazz.push(headerActor);
		actorsList.$jazz.push(contentActor);
		actorsList.$jazz.push(rootActor);

		await actorsList.$jazz.waitForSync();

		const rootActorId = rootActor.$jazz.id;
		const loadedRootWithVibes = await root.$jazz.ensureLoaded({
			resolve: { vibes: true },
		});
		loadedRootWithVibes.vibes.$jazz.set('factories', rootActorId);
		await loadedRootWithVibes.vibes.$jazz.waitForSync();
		console.log('[createFactoriesShowcaseActors] ✅ Registered root:', rootActorId);
		
		return rootActorId;
	} finally {
		locks.factories = false;
	}
}
