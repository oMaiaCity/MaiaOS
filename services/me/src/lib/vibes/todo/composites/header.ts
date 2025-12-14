/**
 * Header Composite Configuration
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { titleLeaf } from '../leafs'
import {
	viewButtonKanban,
	viewButtonKanbanActive,
	viewButtonList,
	viewButtonListActive,
	viewButtonTimeline,
	viewButtonTimelineActive,
} from '../leafs/viewButtons'

export const headerComposite: CompositeConfig = {
	type: 'stack',
	container: {
		class: 'p-0 bg-transparent',
	},
	children: [
		{
			slot: 'title',
			leaf: {
				...titleLeaf,
				classes: titleLeaf.classes ? `${titleLeaf.classes} h-auto` : 'h-auto',
			},
		},

		{
			slot: 'viewButtons',
			composite: {
				type: 'flex',
				flex: {
					direction: 'row',
					justify: 'center',
					align: 'center',
					gap: '0.5rem',
					wrap: 'nowrap',
				},
				container: {
					class: 'pb-4',
				},
				children: [
					{
						slot: 'viewButton.list.active',
						leaf: viewButtonListActive,
					},
					{
						slot: 'viewButton.list',
						leaf: viewButtonList,
					},
					{
						slot: 'viewButton.kanban.active',
						leaf: viewButtonKanbanActive,
					},
					{
						slot: 'viewButton.kanban',
						leaf: viewButtonKanban,
					},
					{
						slot: 'viewButton.timeline.active',
						leaf: viewButtonTimelineActive,
					},
					{
						slot: 'viewButton.timeline',
						leaf: viewButtonTimeline,
					},
				],
			},
		},
	],
}
