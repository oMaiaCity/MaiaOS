/**
 * View Buttons Leaf Components
 * Each button has active and inactive variants for styling
 * Responsive using container queries - adapts from 256px to 1280px+
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

// Shared button classes - Active state
const activeButtonClasses = 'px-1.5 py-0.5 @xs:px-2 @xs:py-1 @sm:px-3 @sm:py-1.5 @md:px-4 @md:py-2 rounded-full border border-[#001a42] bg-[#001a42] text-[#e6ecf7] transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm shadow-sm'

// Shared button classes - Inactive state
const inactiveButtonClasses = 'px-1.5 py-0.5 @xs:px-2 @xs:py-1 @sm:px-3 @sm:py-1.5 @md:px-4 @md:py-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm'

// List button - Active state
export const viewButtonListActive: LeafNode = {
	id: 'todo.leaf.viewButtonListActive',
	tag: 'button',
	attributes: { type: 'button' },
	classes: activeButtonClasses,
	bindings: {
		visible: "data.view.viewMode === 'list'",
	},
	events: {
		click: {
			event: 'SET_VIEW',
			payload: { viewMode: 'list' },
		},
	},
	children: ['List'],
}

// List button - Inactive state
export const viewButtonList: LeafNode = {
	id: 'todo.leaf.viewButtonList',
	tag: 'button',
	attributes: { type: 'button' },
	classes: inactiveButtonClasses,
	bindings: {
		visible: "data.view.viewMode !== 'list'",
	},
	events: {
		click: {
			event: 'SET_VIEW',
			payload: { viewMode: 'list' },
		},
	},
	children: ['List'],
}

// Kanban button - Active state
export const viewButtonKanbanActive: LeafNode = {
	id: 'todo.leaf.viewButtonKanbanActive',
	tag: 'button',
	attributes: { type: 'button' },
	classes: activeButtonClasses,
	bindings: {
		visible: "data.view.viewMode === 'kanban'",
	},
	events: {
		click: {
			event: 'SET_VIEW',
			payload: { viewMode: 'kanban' },
		},
	},
	children: ['Kanban'],
}

// Kanban button - Inactive state
export const viewButtonKanban: LeafNode = {
	id: 'todo.leaf.viewButtonKanban',
	tag: 'button',
	attributes: { type: 'button' },
	classes: inactiveButtonClasses,
	bindings: {
		visible: "data.view.viewMode !== 'kanban'",
	},
	events: {
		click: {
			event: 'SET_VIEW',
			payload: { viewMode: 'kanban' },
		},
	},
	children: ['Kanban'],
}

// Timeline button - Active state
export const viewButtonTimelineActive: LeafNode = {
	id: 'todo.leaf.viewButtonTimelineActive',
	tag: 'button',
	attributes: { type: 'button' },
	classes: activeButtonClasses,
	bindings: {
		visible: "data.view.viewMode === 'timeline'",
	},
	events: {
		click: {
			event: 'SET_VIEW',
			payload: { viewMode: 'timeline' },
		},
	},
	children: ['Timeline'],
}

// Timeline button - Inactive state
export const viewButtonTimeline: LeafNode = {
	id: 'todo.leaf.viewButtonTimeline',
	tag: 'button',
	attributes: { type: 'button' },
	classes: inactiveButtonClasses,
	bindings: {
		visible: "data.view.viewMode !== 'timeline'",
	},
	events: {
		click: {
			event: 'SET_VIEW',
			payload: { viewMode: 'timeline' },
		},
	},
	children: ['Timeline'],
}
