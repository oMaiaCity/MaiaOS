/**
 * Tab Buttons Leaf Components
 * Each button has active and inactive variants for styling
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

// List button - Active state
export const tabButtonListActive: LeafNode = {
	tag: 'button',
	attributes: { type: 'button' },
	classes: 'px-4 py-2 rounded-lg text-sm font-medium transition-colors border bg-blue-500 text-white border-blue-600',
	bindings: {
		visible: "data.selectedLayout === 'list'",
	},
	children: ['List'],
	events: {
		click: {
			event: 'SWITCH_LAYOUT',
			payload: { layout: 'list' },
		},
	},
}

// List button - Inactive state
export const tabButtonList: LeafNode = {
	tag: 'button',
	attributes: { type: 'button' },
	classes: 'px-4 py-2 rounded-lg text-sm font-medium transition-colors border bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200',
	bindings: {
		visible: "data.selectedLayout !== 'list'",
		text: '"List"',
	},
	events: {
		click: {
			event: 'SWITCH_LAYOUT',
			payload: { layout: 'list' },
		},
	},
}

// Row button - Active state
export const tabButtonRowActive: LeafNode = {
	tag: 'button',
	attributes: { type: 'button' },
	classes: 'px-4 py-2 rounded-lg text-sm font-medium transition-colors border bg-blue-500 text-white border-blue-600',
	bindings: {
		visible: "data.selectedLayout === 'row'",
	},
	children: ['Row'],
	events: {
		click: {
			event: 'SWITCH_LAYOUT',
			payload: { layout: 'row' },
		},
	},
}

// Row button - Inactive state
export const tabButtonRow: LeafNode = {
	tag: 'button',
	attributes: { type: 'button' },
	classes: 'px-4 py-2 rounded-lg text-sm font-medium transition-colors border bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200',
	bindings: {
		visible: "data.selectedLayout !== 'row'",
		text: '"Row"',
	},
	events: {
		click: {
			event: 'SWITCH_LAYOUT',
			payload: { layout: 'row' },
		},
	},
}

// Grid button - Active state
export const tabButtonGridActive: LeafNode = {
	tag: 'button',
	attributes: { type: 'button' },
	classes: 'px-4 py-2 rounded-lg text-sm font-medium transition-colors border bg-blue-500 text-white border-blue-600',
	bindings: {
		visible: "data.selectedLayout === 'grid'",
	},
	children: ['Grid'],
	events: {
		click: {
			event: 'SWITCH_LAYOUT',
			payload: { layout: 'grid' },
		},
	},
}

// Grid button - Inactive state
export const tabButtonGrid: LeafNode = {
	tag: 'button',
	attributes: { type: 'button' },
	classes: 'px-4 py-2 rounded-lg text-sm font-medium transition-colors border bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200',
	bindings: {
		visible: "data.selectedLayout !== 'grid'",
		text: '"Grid"',
	},
	events: {
		click: {
			event: 'SWITCH_LAYOUT',
			payload: { layout: 'grid' },
		},
	},
}

