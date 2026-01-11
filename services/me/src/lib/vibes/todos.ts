/**
 * Create Todos Actors - ID-Based Architecture with Foreach
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
import inputSectionFactory from '$lib/compositor/factories/composites/inputSection.factory.json';
import timelineFactory from '$lib/compositor/factories/composites/timeline.factory.json';
import kanbanFactory from '$lib/compositor/factories/composites/kanban.factory.json';
import viewSwitcherFactory from '$lib/compositor/factories/composites/viewSwitcher.factory.json';
import { get, eq, or, not, trim, ifThenElse } from '@maia/script';

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
		throw new Error('Already creating todos actors');
	}
	locks.todos = true;
	
	try {
		// Get the VibesRegistry entity
		const vibesRegistry = await getVibesRegistry(account);
		const existingTodosRootId = vibesRegistry.todos as string | undefined;
		
		if (existingTodosRootId && typeof existingTodosRootId === 'string' && existingTodosRootId.startsWith('co_')) {
			return existingTodosRootId;
		}

		// Load root to get entities list ID
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { root: { entities: true } },
		});
		const root = loadedAccount.root;
		if (!root?.entities) {
			throw new Error('Root entities list not found');
		}

	// Create group for actors (OPTIMISTIC - no blocking!)
	const group = Group.create();
	group.addMember('everyone', 'reader');

		// ============================================
		// BOTTOM-UP CREATION: LEAFS → COMPOSITES → ROOT
		// ============================================

	// STEP 1: Create composite actors (input section, list, timeline)
	// ARCHITECTURE: 1 Actor = 1 Composite/Leaf
	// Simple title is now inline element in header composite
	// Input section actor - TRUE COLOCATION: handles its own @input/updateContext and @todo/create actions
	const inputSectionActor = await createActorEntity(account, {
		context: { 
			visible: true,
			newTodoText: '', // Match legacy data.view.newTodoText
			error: null
		},
		view: createComposite(inputSectionFactory as any, {
			valuePath: 'context.newTodoText', // CLEAN ARCHITECTURE: Always use context.* prefix
			inputEvent: '@context/update', // ✅ Renamed: Generic context update tool
			submitEvent: '@core/createEntity', // ✅ Renamed: Generic entity creation tool
			submitPayload: {
				schemaName: 'Todo',
				entityData: {
					name: 'context.newTodoText', // ✅ String path (ToolEngine resolves via DSL)
					status: 'todo',
					endDate: {
						"$toISOString": [
							{ "$add": [
								{ "$now": [] },
								{ "$multiply": [7, 86400000] } // 7 days * ms per day
							]}
						]
					}, // ✅ MaiaScript DSL expression (no JavaScript!)
					duration: 60
				},
				clearFieldPath: 'newTodoText' // ✅ Clear input after creation
			}, // CLEAN ARCHITECTURE: Always use context.* prefix
			inputName: 'new-todo',
			placeholder: 'Add a new todo...',
			buttonText: 'Add',
			buttonDisabled: or(
				not(get('context.newTodoText')),
				eq({ $trim: get('context.newTodoText') }, '')
			), // CLEAN ARCHITECTURE: Always use context.* prefix
			errorVisible: { "$": "context.error" },
			errorText: 'context.error'
		}),
		dependencies: {},
		role: 'todos-input-section',
	}, group);

	// List actor with inline foreach template - contains queries and dependencies
	const listActor = await createActorEntity(account, {
		context: {
			visible: true, // Always visible when rendered
			queries: {
				todos: {
					schemaName: 'Todo'
				}
			}
		},
		view: {
			container: {
				class: 'flex p-0 flex-col gap-1.5 @xs:gap-2 @sm:gap-3 overflow-auto min-h-0 flex-1 w-full'
			},
			foreach: {
				items: 'context.queries.todos.items', // CLEAN ARCHITECTURE: Always use context.* prefix
				key: 'id',
					composite: {
						container: {
							class: 'flex items-center gap-1.5 @xs:gap-2 @sm:gap-2 @md:gap-3 px-2 py-1.5 @xs:px-2.5 @xs:py-2 @sm:px-3 @sm:py-2 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] w-full flex-shrink-0 overflow-hidden'
						},
						children: [
							{
								slot: 'checkbox',
								leaf: {
									tag: 'button',
									attributes: { type: 'button' },
									classes: 'w-5 h-5 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-1 @sm:focus:ring-2 focus:ring-[#001a42] focus:ring-offset-0.5 @sm:focus:ring-offset-1 cursor-pointer shrink-0',
									bindings: {
										class: ifThenElse(
											eq(get('item.status'), 'done'),
											'border-green-500 bg-green-100',
											'border-slate-300 bg-slate-100'
										)
									},
									events: {
										click: {
											event: '@core/toggleStatus', // ✅ Renamed: Generic toggle tool
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
												text: ifThenElse(
													eq(get('item.status'), 'done'),
													'✓',
													''
												),
												visible: eq(get('item.status'), 'done')
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
										class: ifThenElse(
											eq(get('item.status'), 'done'),
											'line-through text-slate-400',
											''
										)
									},
									events: {
										blur: {
											event: '@core/updateEntity', // ✅ Renamed: Generic update tool
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
										visible: eq(get('item.status'), 'done')
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
										visible: eq(get('item.status'), 'in-progress')
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
										visible: eq(get('item.status'), 'todo')
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
											event: '@core/deleteEntity', // ✅ Renamed: Generic delete tool
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
		role: 'todos-list',
	}, group);

	// Timeline actor - displays todos in timeline format
	const timelineActor = await createActorEntity(account, {
		context: {
			visible: true, // Always visible when rendered
			queries: {
				todos: {
					schemaName: 'Todo'
				}
			}
		},
		view: createComposite(timelineFactory as any, {
			itemsPath: 'context.queries.todos.items',
			itemKey: 'id'
		}),
		dependencies: {
			entities: root.entities.$jazz.id
		},
		role: 'todos-timeline',
	}, group);

	// Kanban actor - displays todos in kanban board with drag-and-drop
	// Uses 3 separate queries with filters for each column (proper query engine filters)
	const kanbanActor = await createActorEntity(account, {
		context: {
			visible: true,
			draggedTodoId: null,
			draggedTodoStatus: null,
			isDragging: false,
			dragOverColumn_todo: false,
			dragOverColumn_in_progress: false,
			dragOverColumn_done: false,
			queries: {
				todos_todo: {
					schemaName: 'Todo',
					operations: {
						"$filter": {
							"field": "status",
							"condition": { "$eq": [{ "$": "item.status" }, "todo"] }
						}
					}
				},
				todos_in_progress: {
					schemaName: 'Todo',
					operations: {
						"$filter": {
							"field": "status",
							"condition": { "$eq": [{ "$": "item.status" }, "in-progress"] }
						}
					}
				},
				todos_done: {
					schemaName: 'Todo',
					operations: {
						"$filter": {
							"field": "status",
							"condition": { "$eq": [{ "$": "item.status" }, "done"] }
						}
					}
				}
			}
		},
		view: createComposite(kanbanFactory as any, {
			itemsPath: 'context.queries.todos_todo.items', // Todo column - filtered query
			itemsPathInProgress: 'context.queries.todos_in_progress.items', // In Progress column - filtered query
			itemsPathDone: 'context.queries.todos_done.items', // Done column - filtered query
			itemKey: 'id'
		}),
		dependencies: {
			entities: root.entities.$jazz.id
		},
		role: 'todos-kanban',
	}, group);

	// ✅ Content actor - handles actor swapping for view switching
	// This is the GENERIC actor-swapping container that replaces visibility toggling
	const contentActor = await createActorEntity(account, {
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
				class: 'flex flex-col w-full min-h-0 flex-1 overflow-hidden'
			}
		},
		dependencies: {},
		role: 'todos-content',
	}, group);
	// Set children after creation (default: show list view)
	contentActor.children.$jazz.push(listActor.$jazz.id);

	// View switcher actor - stores viewMode in its own context for styling
	const viewSwitcherActor = await createActorEntity(account, {
		context: { 
			visible: true,
			views: [
				{ id: 'list', label: 'List' },
				{ id: 'timeline', label: 'Timeline' },
				{ id: 'kanban', label: 'Kanban' }
			]
		},
		view: createComposite(viewSwitcherFactory as any, {
			viewsPath: 'context.views', // ✅ Path to views array in actor context
			currentViewPath: 'dependencies.content.context.viewMode' // ✅ Read from contentActor's context
		}),
		dependencies: {
			content: contentActor.$jazz.id // ✅ For reading viewMode and sending events
		},
		role: 'todos-view-switcher',
	}, group);

	// Header actor - contains title and view switcher in same row
	const headerActor = await createActorEntity(account, {
		context: { visible: true },
		view: {
			container: { 
				class: 'flex px-2 @xs:px-3 @sm:px-4 @md:px-6 py-3 @xs:py-3 @sm:py-4 border-b border-slate-200 flex-col items-center gap-3 h-auto overflow-hidden w-full'
			},
			elements: [
				{
					tag: 'h2',
					classes: 'text-2xl @xs:text-3xl @sm:text-4xl @md:text-5xl font-bold text-[#001a42] tracking-tight',
					elements: ['Todos']
				},
				{
					slot: 'children',
					tag: 'div',
					classes: 'w-full'
				}
			]
		},
		dependencies: {},
		role: 'todos-header',
	}, group);
	// Set children after creation (Switcher is still an actor - has events)
	headerActor.children.$jazz.push(viewSwitcherActor.$jazz.id);

	// STEP 3: Create root actor (simplified - no view mode management, just a container)
	const todosRootActor = await createActorEntity(account, {
		context: {
			visible: true,
		},
		view: createComposite(rootCardFactory as any, {
			cardLayout: 'grid',
			cardClasses: 'card h-full p-2 @xs:p-3 @sm:p-4 @md:p-6 grid grid-cols-1 grid-rows-[auto_auto_1fr] gap-4 min-h-0'
		}),
		dependencies: {
			entities: root.entities.$jazz.id
		},
		role: 'todos-root',
	}, group);
	// Set children after creation (Switcher is now inside header)
	todosRootActor.children.$jazz.push(headerActor.$jazz.id);
	todosRootActor.children.$jazz.push(inputSectionActor.$jazz.id);
	todosRootActor.children.$jazz.push(contentActor.$jazz.id);

	// STEP 4: Update subscriptions - TRUE COLOCATION with actor swapping
	inputSectionActor.subscriptions.$jazz.push(inputSectionActor.$jazz.id);
	listActor.subscriptions.$jazz.push(listActor.$jazz.id);
	timelineActor.subscriptions.$jazz.push(timelineActor.$jazz.id);
	kanbanActor.subscriptions.$jazz.push(kanbanActor.$jazz.id); // ✅ Kanban handles drag-and-drop events
	viewSwitcherActor.subscriptions.$jazz.push(contentActor.$jazz.id); // ✅ Switcher SENDS events to contentActor
	viewSwitcherActor.subscriptions.$jazz.push(viewSwitcherActor.$jazz.id); // ✅ Switcher also subscribes to itself to receive events and update viewMode
	contentActor.subscriptions.$jazz.push(contentActor.$jazz.id); // ✅ Content actor handles @context/swapActors

	// Actors are automatically added to root.entities by createActorEntity

	// Register root actor in vibes registry
	vibesRegistry.$jazz.set('todos', todosRootActor.$jazz.id);
	
	return todosRootActor.$jazz.id;
	} finally {
		locks.todos = false;
	}
}
