/**
 * Timeline Composite Factory
 * Displays items in a vertical timeline format with dates and visual connectors
 */

import type { CompositeNode } from '$lib/compositor/view/types';

export interface TimelineParams {
  itemsPath: string; // Path to items array (e.g., 'context.queries.todos.items')
  itemKey?: string; // Key for item iteration (default: 'id')
}

export function createTimelineComposite(params: TimelineParams): CompositeNode {
  const itemKey = params.itemKey || 'id';
  
  return {
    container: {
      layout: 'flex',
      class: 'p-0 flex-col gap-0 overflow-auto min-h-0 flex-1',
    },
    foreach: {
      items: params.itemsPath,
      key: itemKey,
      composite: {
        container: {
          layout: 'flex',
          class: 'relative flex gap-2 @xs:gap-3 @sm:gap-4 pb-4 @xs:pb-5 @sm:pb-6 last:pb-0 flex-shrink-0',
        },
        children: [
          // Timeline dot and line
          {
            slot: 'timeline-indicator',
            composite: {
              container: {
                layout: 'flex',
                class: 'flex-col items-center shrink-0 w-8 @xs:w-10 @sm:w-12',
              },
              children: [
                {
                  slot: 'dot',
                  leaf: {
                    tag: 'div',
                    classes: 'w-3 h-3 @xs:w-4 @xs:h-4 @sm:w-5 @sm:h-5 rounded-full border-2 border-[#001a42] shrink-0 mt-1',
                    bindings: {
                      class: "item.status === 'done' ? 'bg-green-500 border-green-500' : item.status === 'in-progress' ? 'bg-blue-500 border-blue-500' : 'bg-slate-100 border-[#001a42]'",
                    },
                  },
                },
                {
                  slot: 'line',
                  leaf: {
                    tag: 'div',
                    classes: 'w-0.5 flex-1 bg-slate-200 min-h-[20px]',
                  },
                },
              ],
            },
          },
          // Timeline content
          {
            slot: 'timeline-content',
            composite: {
              container: {
                layout: 'flex',
                class: 'flex-1 flex-col gap-1 @xs:gap-1.5 @sm:gap-2',
              },
              children: [
                // Date/time header
                {
                  slot: 'header',
                  leaf: {
                    tag: 'div',
                    classes: 'text-[10px] @xs:text-xs @sm:text-sm text-slate-500 font-medium',
                    bindings: {
                      text: "String(new Date(item._created || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))",
                    },
                  },
                },
                // Card with todo content
                {
                  slot: 'card',
                  composite: {
                    container: {
                      layout: 'flex',
                      class: 'flex items-start gap-2 @xs:gap-2.5 @sm:gap-3 px-2 py-1.5 @xs:px-2.5 @xs:py-2 @sm:px-3 @sm:py-2.5 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] hover:shadow-[0_0_8px_rgba(0,0,0,0.04)] transition-shadow flex-shrink-0',
                    },
                    children: [
                      // Checkbox
                      {
                        slot: 'checkbox',
                        leaf: {
                          tag: 'button',
                          attributes: { type: 'button' },
                          classes: 'w-5 h-5 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-1 @sm:focus:ring-2 focus:ring-[#001a42] focus:ring-offset-0.5 @sm:focus:ring-offset-1 cursor-pointer shrink-0 mt-0.5',
                          bindings: {
                            class: "item.status === 'done' ? 'border-green-500 bg-green-100' : 'border-slate-300 bg-slate-100'",
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
                              classes: 'text-green-500 font-bold',
                              bindings: {
                                text: "item.status === 'done' ? '✓' : ''",
                                visible: "item.status === 'done'",
                              },
                            },
                          ],
                        },
                      },
                      // Content area (inline: name + badge)
                      {
                        slot: 'content',
                        composite: {
                          container: {
                            layout: 'flex',
                            class: 'flex-1 flex items-center gap-2 @xs:gap-2.5 @sm:gap-3 min-w-0',
                          },
                          children: [
                            // Todo name
                            {
                              slot: 'name',
                              leaf: {
                                tag: 'input',
                                attributes: { type: 'text' },
                                classes: 'flex-1 text-xs @xs:text-sm @sm:text-base font-medium text-slate-700 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-0 min-w-0',
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
                            // Status badge (inline, pulled right)
                            {
                              slot: 'status',
                              leaf: {
                                tag: 'span',
                                classes: 'px-1.5 py-0.5 @xs:px-2 @xs:py-0.5 text-[9px] @xs:text-[10px] @sm:text-xs font-medium rounded-full border border-white shrink-0 ml-auto',
                                bindings: {
                                  text: 'item.status',
                                  class: "item.status === 'done' ? 'bg-green-100 text-green-700' : item.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'",
                                },
                              },
                            },
                          ],
                        },
                      },
                      // Delete button
                      {
                        slot: 'delete',
                        leaf: {
                          tag: 'button',
                          classes: 'px-1 py-0.5 @xs:px-1.5 @xs:py-1 @sm:px-2 @sm:py-1 text-xs @xs:text-xs @sm:text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all duration-200 w-5 h-5 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 flex items-center justify-center shrink-0 mt-0.5',
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
              ],
            },
          },
        ],
      },
    },
  };
}
