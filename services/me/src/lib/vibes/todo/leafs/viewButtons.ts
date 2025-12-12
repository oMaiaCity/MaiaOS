/**
 * View Buttons Leaf Components
 * Each button has active and inactive variants for styling
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

// List button - Active state
export const viewButtonListActive: LeafNode = {
	tag: 'button',
	attributes: { type: 'button' },
	classes: [
		'px-4',
		'py-2',
		'rounded-full',
		'border',
		'border-[#001a42]',
		'bg-[#001a42]',
		'text-[#e6ecf7]',
		'transition-all',
		'duration-300',
		'font-medium',
		'text-sm',
		'shadow-sm',
	],
	bindings: {
		visible: "data.viewMode === 'list'",
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
	tag: 'button',
	attributes: { type: 'button' },
	classes: [
		'px-4',
		'py-2',
		'rounded-full',
		'border',
		'border-slate-300',
		'bg-white',
		'text-slate-700',
		'hover:border-slate-400',
		'hover:bg-slate-50',
		'transition-all',
		'duration-300',
		'font-medium',
		'text-sm',
	],
	bindings: {
		visible: "data.viewMode !== 'list'",
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
	tag: 'button',
	attributes: { type: 'button' },
	classes: [
		'px-4',
		'py-2',
		'rounded-full',
		'border',
		'border-[#001a42]',
		'bg-[#001a42]',
		'text-[#e6ecf7]',
		'transition-all',
		'duration-300',
		'font-medium',
		'text-sm',
		'shadow-sm',
	],
	bindings: {
		visible: "data.viewMode === 'kanban'",
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
	tag: 'button',
	attributes: { type: 'button' },
	classes: [
		'px-4',
		'py-2',
		'rounded-full',
		'border',
		'border-slate-300',
		'bg-white',
		'text-slate-700',
		'hover:border-slate-400',
		'hover:bg-slate-50',
		'transition-all',
		'duration-300',
		'font-medium',
		'text-sm',
	],
	bindings: {
		visible: "data.viewMode !== 'kanban'",
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
	tag: 'button',
	attributes: { type: 'button' },
	classes: [
		'px-4',
		'py-2',
		'rounded-full',
		'border',
		'border-[#001a42]',
		'bg-[#001a42]',
		'text-[#e6ecf7]',
		'transition-all',
		'duration-300',
		'font-medium',
		'text-sm',
		'shadow-sm',
	],
	bindings: {
		visible: "data.viewMode === 'timeline'",
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
	tag: 'button',
	attributes: { type: 'button' },
	classes: [
		'px-4',
		'py-2',
		'rounded-full',
		'border',
		'border-slate-300',
		'bg-white',
		'text-slate-700',
		'hover:border-slate-400',
		'hover:bg-slate-50',
		'transition-all',
		'duration-300',
		'font-medium',
		'text-sm',
	],
	bindings: {
		visible: "data.viewMode !== 'timeline'",
	},
	events: {
		click: {
			event: 'SET_VIEW',
			payload: { viewMode: 'timeline' },
		},
	},
	children: ['Timeline'],
}
