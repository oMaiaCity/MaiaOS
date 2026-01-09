/**
 * Create Design Templates Actors
 * Showcase of available design templates
 */

import { Actor, ActorList, ActorMessage } from "@maia/db";
import { Group, co, z } from "jazz-tools";
import { createRootCardComposite, createHeaderComposite, createTitleLeaf, createButtonLeaf } from '../index';

// Global lock
const getGlobalLock = () => {
	if (typeof window === 'undefined') return { designTemplates: false };
	if (!(window as any).__actorCreationLocks) {
		(window as any).__actorCreationLocks = { designTemplates: false };
	}
	return (window as any).__actorCreationLocks;
};

export async function createDesignTemplatesActors(account: any) {
	const locks = getGlobalLock();
	
	if (locks.designTemplates) {
		throw new Error('Already creating design templates actors');
	}
	locks.designTemplates = true;
	
	try {
		console.log('[createDesignTemplatesActors] Starting...');
	
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
		const existingRootId = vibesRegistry.designTemplates as string | undefined;
		
		if (existingRootId && typeof existingRootId === 'string' && existingRootId.startsWith('co_')) {
			console.log('[createDesignTemplatesActors] ✅ Found existing root:', existingRootId);
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
			view: createTitleLeaf({ text: 'Design Templates', tag: 'h2' }),
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'design-templates-title',
		}, group);

		const descActor = Actor.create({
			context: {},
			view: {
				tag: 'p',
				classes: 'text-slate-600',
				elements: ['This page showcases reusable design template factories for creating consistent UI components.']
			},
			dependencies: {},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: [],
			children: co.list(z.string()).create([]),
			role: 'design-templates-desc',
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
			role: 'design-templates-example-button',
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
			role: 'design-templates-header',
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
			role: 'design-templates-content',
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
			role: 'design-templates-root',
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
		loadedRootWithVibes.vibes.$jazz.set('designTemplates', rootActorId);
		await loadedRootWithVibes.vibes.$jazz.waitForSync();
		console.log('[createDesignTemplatesActors] ✅ Registered root:', rootActorId);
		
		return rootActorId;
	} finally {
		locks.designTemplates = false;
	}
}
