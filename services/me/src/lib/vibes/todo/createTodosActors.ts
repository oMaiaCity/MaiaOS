/**
 * Create Todos Actors - ID-Based Architecture with Foreach
 * Uses inline foreach templates for dynamic lists
 * ID-based parent-child relationships
 * Bottom-up creation: buttons → header → list → root
 */

import { Actor, ActorList, ActorMessage, VibesRegistry } from "@maia/db";
import { Group, co, z } from "jazz-tools";
import { createRootCardComposite, createHeaderComposite, createTitleLeaf, createButtonLeaf, createBadgeLeaf, createInputSectionComposite, createViewSwitcherComposite, createTimelineComposite, createKanbanComposite } from '../design-templates';

// Global lock
const getGlobalLock = () => {
	if (typeof window === 'undefined') return { vibes: false, humans: false, todos: false };
	if (!(window as any).__actorCreationLocks) {
		(window as any).__actorCreationLocks = { vibes: false, humans: false, todos: false };
	}
	return (window as any).__actorCreationLocks;
};

export async function createTodosActors(account: any) {
	const locks = getGlobalLock();
	
	if (locks.todos) {
		console.log('[createTodosActors] Already creating (global lock), waiting...');
		throw new Error('Already creating todos actors');
	}
	locks.todos = true;
	
	try {
		console.log('[createTodosActors] Starting ID-based actor creation...');
	
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

		// Check registry for existing todos root actor
		let rootWithVibes = await root.$jazz.ensureLoaded({
			resolve: { vibes: true },
		});
		
		if (!rootWithVibes.vibes?.$isLoaded) {
			throw new Error('Vibes registry is not loaded');
		}
		
		const vibesRegistry = rootWithVibes.vibes;
		const existingTodosRootId = vibesRegistry.todos as string | undefined;
		
		if (existingTodosRootId && typeof existingTodosRootId === 'string' && existingTodosRootId.startsWith('co_')) {
			console.log('[createTodosActors] ✅ Found existing todos root:', existingTodosRootId);
			return existingTodosRootId;
		}

		console.log('[createTodosActors] Creating new actors...');

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

		// ============================================
		// BOTTOM-UP CREATION: LEAFS → COMPOSITES → ROOT
		// ============================================

	// STEP 1: Create leaf actors (title)
	const headerTitleActor = Actor.create({
		context: { visible: true },
		view: createTitleLeaf({ text: 'Todos', tag: 'h2' }),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([]),
		role: 'todos-header-title',
	}, group);

	// STEP 2: Create composite actors (input section, list, timeline)
	// Input section actor - TRUE COLOCATION: handles its own @input/updateContext and @todo/create actions
	const inputSectionActor = Actor.create({
		context: { 
			visible: true,
			newTodoText: '', // Match legacy data.view.newTodoText
			error: null
		},
		view: createInputSectionComposite({
			valuePath: 'context.newTodoText', // CLEAN ARCHITECTURE: Always use context.* prefix
			inputEvent: '@input/updateContext', // Generic context update skill
			submitEvent: '@todo/create',
			submitPayload: { name: 'context.newTodoText' }, // CLEAN ARCHITECTURE: Always use context.* prefix
			inputName: 'new-todo',
			placeholder: 'Add a new todo...',
			buttonText: 'Add',
			buttonDisabled: "!context.newTodoText || context.newTodoText.trim() === ''", // CLEAN ARCHITECTURE: Always use context.* prefix
			errorVisible: "context.error",
			errorText: 'context.error'
		}),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([]),
		role: 'todos-input-section',
	}, group);

	// List actor with inline foreach template - contains queries and dependencies
	const listActor = Actor.create({
		context: {
			visible: true, // Always visible when rendered
			queries: {
				todos: {
					schemaName: 'Todo',
					items: []
				}
			}
		},
		view: {
			container: {
				layout: 'flex',
				class: 'p-0 flex-col gap-1.5 @xs:gap-2 @sm:gap-3 overflow-auto min-h-0 flex-1'
			},
			foreach: {
				items: 'context.queries.todos.items', // CLEAN ARCHITECTURE: Always use context.* prefix
				key: 'id',
					composite: {
						container: {
							layout: 'flex',
							class: 'flex items-center gap-1.5 @xs:gap-2 @sm:gap-2 @md:gap-3 px-2 py-1.5 @xs:px-2.5 @xs:py-2 @sm:px-3 @sm:py-2 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] w-full flex-shrink-0'
						},
						children: [
							{
								slot: 'checkbox',
								leaf: {
									tag: 'button',
									attributes: { type: 'button' },
									classes: 'w-5 h-5 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-1 @sm:focus:ring-2 focus:ring-[#001a42] focus:ring-offset-0.5 @sm:focus:ring-offset-1 cursor-pointer shrink-0',
									bindings: {
										class: "item.status === 'done' ? 'border-green-500 bg-green-100' : 'border-slate-300 bg-slate-100'"
									},
									events: {
										click: {
											event: '@entity/toggleStatus',
											payload: { 
												id: 'item.id',
												value1: 'todo',
												value2: 'done',
												statusField: 'status'
											}
										}
									},
									elements: [
										{
											tag: 'span',
											classes: 'text-green-500 font-bold',
											bindings: {
												text: "item.status === 'done' ? '✓' : ''",
												visible: "item.status === 'done'"
											}
										}
									]
								}
							},
							{
								slot: 'name',
								leaf: {
									tag: 'input',
									attributes: { type: 'text' },
									classes: 'flex-1 text-xs @xs:text-xs @sm:text-sm font-medium text-slate-700 min-w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-0',
									bindings: { 
										value: 'item.name',
										class: "item.status === 'done' ? 'line-through text-slate-400' : ''"
									},
									events: {
										blur: {
											event: '@entity/updateEntity',
											payload: { id: 'item.id', name: 'item.name' }
										}
									}
								}
							},
							// Status badges (conditional rendering for proper colors)
							{
								slot: 'badge-done',
								leaf: {
									tag: 'span',
									classes: 'px-1 py-0 @xs:px-1.5 @xs:py-0.5 text-[8px] @xs:text-[10px] @sm:text-xs font-medium rounded-full border border-white shrink-0 bg-green-100 text-green-700',
									bindings: { 
										text: 'item.status',
										visible: "item.status === 'done'"
									}
								}
							},
							{
								slot: 'badge-in-progress',
								leaf: {
									tag: 'span',
									classes: 'px-1 py-0 @xs:px-1.5 @xs:py-0.5 text-[8px] @xs:text-[10px] @sm:text-xs font-medium rounded-full border border-white shrink-0 bg-blue-100 text-blue-700',
									bindings: { 
										text: 'item.status',
										visible: "item.status === 'in-progress'"
									}
								}
							},
							{
								slot: 'badge-todo',
								leaf: {
									tag: 'span',
									classes: 'px-1 py-0 @xs:px-1.5 @xs:py-0.5 text-[8px] @xs:text-[10px] @sm:text-xs font-medium rounded-full border border-white shrink-0 bg-slate-100 text-slate-700',
									bindings: { 
										text: 'item.status',
										visible: "item.status === 'todo'"
									}
								}
							},
							{
								slot: 'delete',
								leaf: {
									tag: 'button',
									classes: 'px-1 py-0.5 @xs:px-1.5 @xs:py-1 @sm:px-2 @sm:py-1 text-xs @xs:text-xs @sm:text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all duration-200 w-5 h-5 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 flex items-center justify-center shrink-0',
									attributes: { type: 'button' },
									elements: ['✕'],
									events: {
										click: {
											event: '@entity/deleteEntity',
											payload: { id: 'item.id' }
										}
									}
								}
							}
						]
					}
				}
			},
			dependencies: { 
				entities: root.entities.$jazz.id
			},
			inbox: co.feed(ActorMessage).create([]),
			subscriptions: co.list(z.string()).create([]),
			children: co.list(z.string()).create([]),
			role: 'todos-list',
		}, group);

	// Timeline actor - displays todos in timeline format
	const timelineActor = Actor.create({
		context: {
			visible: true, // Always visible when rendered
			queries: {
				todos: {
					schemaName: 'Todo',
					items: []
				}
			}
		},
		view: createTimelineComposite({
			itemsPath: 'context.queries.todos.items',
			itemKey: 'id'
		}),
		dependencies: {
			entities: root.entities.$jazz.id
		},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: co.list(z.string()).create([]),
		children: co.list(z.string()).create([]),
		role: 'todos-timeline',
	}, group);

	// Kanban actor - displays todos in kanban board with drag-and-drop
	// Uses 3 separate queries with filters for each column
	const kanbanActor = Actor.create({
		context: {
			visible: true,
			draggedTodoId: null,
			draggedTodoStatus: null,
			isDragging: false,
			dragOverColumn_todo: false,
			dragOverColumn_in_progress: false,
			dragOverColumn_done: false,
			queries: {
				todos: {
					schemaName: 'Todo',
					items: []
				}
			}
		},
		view: createKanbanComposite({
			itemsPath: 'context.queries.todos.items',
			itemKey: 'id'
		}),
		dependencies: {
			entities: root.entities.$jazz.id
		},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: co.list(z.string()).create([]),
		children: co.list(z.string()).create([]),
		role: 'todos-kanban',
	}, group);

	// ✅ Content actor - handles actor swapping for view switching
	// This is the GENERIC actor-swapping container that replaces visibility toggling
	const contentActor = Actor.create({
		context: {
			visible: true,
			viewMode: 'list', // Default view mode (for view switcher button styling)
			// Mapping of viewMode -> actorId (set after actors are created)
			viewActors: {
				list: listActor.$jazz.id,
				timeline: timelineActor.$jazz.id,
				kanban: kanbanActor.$jazz.id,
			}
		},
		view: {
			container: {
				layout: 'flex',
				class: 'flex-col w-full h-full'
			}
		},
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([listActor.$jazz.id]), // Default: show list view
		role: 'todos-content',
	}, group);

	// View switcher actor - reads viewMode directly from contentActor via dependencies
	const viewSwitcherActor = Actor.create({
		context: { 
			visible: true
		},
		view: createViewSwitcherComposite({
			views: [
				{ id: 'list', label: 'List' },
				{ id: 'timeline', label: 'Timeline' },
				{ id: 'kanban', label: 'Kanban' }
			],
			currentViewPath: 'dependencies.content.context.viewMode' // ✅ Read directly from contentActor's context
		}),
		dependencies: {
			content: contentActor.$jazz.id // ✅ Set at creation time
		},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([]),
		role: 'todos-view-switcher',
	}, group);

	// Header actor - contains title and view switcher in same row
	const headerActor = Actor.create({
		context: { visible: true },
		view: createHeaderComposite(),
		dependencies: {},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([headerTitleActor.$jazz.id, viewSwitcherActor.$jazz.id]), // ✅ Title + Switcher in same row
		role: 'todos-header',
	}, group);

	// STEP 3: Create root actor (simplified - no view mode management, just a container)
	const todosRootActor = Actor.create({
		context: {
			visible: true,
		},
		view: createRootCardComposite({
			cardLayout: 'flex',
			cardClasses: 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 flex-col gap-4'
		}),
		dependencies: {
			entities: root.entities.$jazz.id
		},
		inbox: co.feed(ActorMessage).create([]),
		subscriptions: [],
		children: co.list(z.string()).create([headerActor.$jazz.id, inputSectionActor.$jazz.id, contentActor.$jazz.id]), // Switcher is now inside header
		role: 'todos-root',
	}, group);

	// STEP 4: Update subscriptions - TRUE COLOCATION with actor swapping
	inputSectionActor.subscriptions.$jazz.push(inputSectionActor.$jazz.id);
	listActor.subscriptions.$jazz.push(listActor.$jazz.id);
	timelineActor.subscriptions.$jazz.push(timelineActor.$jazz.id);
	kanbanActor.subscriptions.$jazz.push(kanbanActor.$jazz.id); // ✅ Kanban handles drag-and-drop events
	viewSwitcherActor.subscriptions.$jazz.push(contentActor.$jazz.id); // ✅ Switcher SENDS events to contentActor
	contentActor.subscriptions.$jazz.push(contentActor.$jazz.id); // ✅ Content actor handles @view/swapActors

	// Add all actors to global actors list
	actorsList.$jazz.push(headerTitleActor);
	actorsList.$jazz.push(headerActor);
	actorsList.$jazz.push(viewSwitcherActor);
	actorsList.$jazz.push(inputSectionActor);
	actorsList.$jazz.push(listActor);
	actorsList.$jazz.push(timelineActor);
	actorsList.$jazz.push(kanbanActor); // ✅ Add kanban actor
	actorsList.$jazz.push(contentActor); // ✅ Add content actor
	actorsList.$jazz.push(todosRootActor);

	console.log('[createTodosActors] ⚡ All actors created instantly (local-first)');

	// Register root actor in vibes registry
	root.vibes.$jazz.set('todos', todosRootActor.$jazz.id);
	console.log('[createTodosActors] ✅ Registered todos root:', todosRootActor.$jazz.id);
	
	return todosRootActor.$jazz.id;
	} finally {
		locks.todos = false;
	}
}
