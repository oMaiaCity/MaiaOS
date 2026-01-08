/**
 * Kanban Composite Template
 * Displays items in a kanban board with drag-and-drop columns
 */

import type { CompositeNode } from '$lib/compositor/view/types';

export interface KanbanParams {
  itemsPath: string; // Path to items array (e.g., 'context.queries.todos.items')
  itemKey?: string; // Key for item iteration (default: 'id')
}

export interface KanbanColumn {
  key: string;
  title: string;
  status: string;
  colorClass: string;
}

export const defaultKanbanColumns: KanbanColumn[] = [
  {
    key: 'todo',
    title: 'Todo',
    status: 'todo',
    colorClass: 'text-slate-700',
  },
  {
    key: 'in-progress',
    title: 'In Progress',
    status: 'in-progress',
    colorClass: 'text-blue-700',
  },
  {
    key: 'done',
    title: 'Done',
    status: 'done',
    colorClass: 'text-green-700',
  },
];

export function createKanbanComposite(params: KanbanParams): CompositeNode {
  const itemKey = params.itemKey || 'id';
  
  return {
    container: {
      layout: 'flex',
      class: 'flex gap-2 @xs:gap-3 @sm:gap-4 overflow-x-auto overflow-y-hidden min-h-0 flex-1 scroll-smooth',
    },
    children: defaultKanbanColumns.map((column) => {
      // Convert column.status to context property name (e.g., 'in-progress' -> 'dragOverColumn_in_progress')
      const dragOverPropName = `dragOverColumn_${column.status.replace(/-/g, '_')}`;
      
      return {
        slot: `kanban-column-${column.key}`,
        composite: {
          container: {
            layout: 'flex',
            class: 'flex-col gap-2 h-full min-h-0 border border-slate-200 rounded-lg @sm:rounded-xl @md:rounded-2xl p-2 @xs:p-2.5 @sm:p-3 @md:p-4 min-w-[240px] @xs:min-w-[260px] @sm:min-w-[280px] flex-shrink-0 bg-slate-50',
          },
          children: [
            // Column header
            {
              slot: 'header',
              leaf: {
                tag: 'h3',
                classes: `text-xs @xs:text-sm @sm:text-base font-semibold ${column.colorClass} mb-2 flex-shrink-0 text-center`,
                elements: [column.title],
              },
            },
            // Dropzone for todos - MUST be a composite, not a leaf, to support foreach
            {
              slot: 'dropzone',
              composite: {
                container: {
                  layout: 'flex',
                  class: 'flex flex-col gap-1.5 @xs:gap-2 @sm:gap-2.5 flex-1 overflow-y-auto rounded-lg transition-all duration-200 scroll-smooth border-2 border-transparent',
                  attributes: {
                    'data-status': column.status,
                    'data-dropzone': 'true',
                  },
                },
                bindings: {
                  visible: `context.isDragging || true`, // Always visible, but we'll handle styling via events/CSS
                },
                events: {
                  drop: {
                    event: '@todo/drop',
                    payload: { status: column.status },
                  },
                  dragover: {
                    event: '@ui/preventDefaultOnly',
                    payload: {},
                  },
                  dragenter: {
                    event: '@input/updateContext',
                    payload: { [dragOverPropName]: true },
                  },
                  dragleave: {
                    event: '@input/updateContext',
                    payload: { [dragOverPropName]: false },
                  },
                },
                // Foreach loop - filters by status in view layer
                foreach: {
                  items: params.itemsPath,
                  key: itemKey,
                  composite: {
                    container: {
                      layout: 'flex',
                      class: 'flex items-start gap-1.5 @xs:gap-2 @sm:gap-2 px-2 py-1.5 @xs:px-2.5 @xs:py-2 @sm:px-3 @sm:py-2 @md:px-3 @md:py-2.5 rounded-lg @sm:rounded-xl bg-white border border-slate-200 shadow-[0_0_4px_rgba(0,0,0,0.02)] hover:shadow-[0_0_8px_rgba(0,0,0,0.04)] transition-all cursor-move flex-shrink-0',
                      attributes: {
                        draggable: 'true',
                        'data-todo-id': 'item.id',
                      },
                    },
                    bindings: {
                      visible: `item.status === '${column.status}'`,
                    },
                    events: {
                      dragstart: {
                        event: '@todo/dragStart',
                        payload: { id: 'item.id', status: 'item.status' },
                      },
                      dragend: {
                        event: '@todo/dragEnd',
                        payload: {},
                      },
                    },
                    children: [
                      // Checkbox/status indicator
                      {
                        slot: 'checkbox',
                        leaf: {
                          tag: 'button',
                          attributes: { type: 'button' },
                          classes: 'w-4 h-4 @xs:w-5 @xs:h-5 @sm:w-5 @sm:h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-1 @sm:focus:ring-2 focus:ring-[#001a42] focus:ring-offset-0.5 @sm:focus:ring-offset-1 cursor-pointer shrink-0 mt-0.5',
                          bindings: {
                            class: "item.status === 'done' ? 'border-green-500 bg-green-100' : item.status === 'in-progress' ? 'border-blue-500 bg-blue-100' : 'border-slate-300 bg-slate-100'",
                          },
                          events: {
                            click: {
                              event: '@entity/toggleStatus',
                              payload: {
                                id: 'item.id',
                                value1: 'todo',
                                value2: 'done',
                                statusField: 'status',
                              },
                            },
                          },
                          elements: [
                            {
                              tag: 'span',
                              classes: 'text-green-500 font-bold text-xs @xs:text-xs @sm:text-sm',
                              bindings: {
                                text: "item.status === 'done' ? '✓' : item.status === 'in-progress' ? '⋯' : ''",
                                visible: "item.status === 'done' || item.status === 'in-progress'",
                              },
                            },
                          ],
                        },
                      },
                      // Todo name
                      {
                        slot: 'name',
                        leaf: {
                          tag: 'input',
                          attributes: { type: 'text' },
                          classes: 'flex-1 text-xs @xs:text-sm @sm:text-sm font-medium text-slate-700 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-0 min-w-0',
                          bindings: {
                            value: 'item.name',
                            class: "item.status === 'done' ? 'line-through text-slate-400' : ''",
                          },
                          events: {
                            blur: {
                              event: '@entity/updateEntity',
                              payload: { id: 'item.id', name: 'item.name' },
                            },
                          },
                        },
                      },
                      // Delete button
                      {
                        slot: 'delete',
                        leaf: {
                          tag: 'button',
                          classes: 'px-1 py-0.5 @xs:px-1 @xs:py-0.5 @sm:px-1.5 @sm:py-1 text-xs @xs:text-xs @sm:text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all duration-200 w-4 h-4 @xs:w-5 @xs:h-5 @sm:w-5 @sm:h-5 flex items-center justify-center shrink-0 mt-0.5',
                          attributes: { type: 'button' },
                          elements: ['✕'],
                          events: {
                            click: {
                              event: '@entity/deleteEntity',
                              payload: { id: 'item.id' },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      };
    }),
  };
}
