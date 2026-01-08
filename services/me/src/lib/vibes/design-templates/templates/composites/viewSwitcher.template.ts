/**
 * View Switcher Composite Template
 * Button array for switching between different view modes (list, timeline, etc.)
 */

import type { CompositeNode } from '$lib/compositor/view/types';

export interface ViewSwitcherParams {
  views: Array<{
    id: string;
    label: string;
    icon?: string;
  }>;
  currentViewPath?: string; // Path to current view mode in context (e.g., 'context.viewMode')
}

export function createViewSwitcherComposite(params: ViewSwitcherParams): CompositeNode {
  const currentViewPath = params.currentViewPath || 'context.viewMode';
  
  return {
    container: {
      layout: 'flex',
      class: '!overflow-visible gap-2 items-center justify-center flex-wrap py-2 h-auto', // Override overflow-hidden, ensure auto height
    },
    children: params.views.map((view) => ({
      slot: `view-${view.id}`,
      leaf: {
        tag: 'button',
        attributes: { type: 'button' },
            classes: 'px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border-2 cursor-pointer select-none whitespace-nowrap',
        bindings: {
          class: `${currentViewPath} === '${view.id}' ? 'bg-[#001a42] text-white border-[#001a42] hover:bg-[#002662]' : 'bg-white text-slate-800 border-slate-500 hover:bg-slate-100 hover:border-slate-600'`,
        },
        events: {
          click: {
            event: '@view/swapActors',
            payload: { viewMode: view.id },
          },
        },
        elements: [view.label],
      },
    })),
  };
}
