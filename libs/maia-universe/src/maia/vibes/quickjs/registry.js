/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '@MaiaOS/factories/identity-from-maia-path.js'
import maiacityBrand from '../brand/maiacity.style.maia'
import raw0 from './add-form/actor.maia'
import raw1 from './add-form/context.maia'
import raw2 from './add-form/interface.maia'
import raw3 from './add-form/process.maia'
import raw4 from './add-form/view.maia'
import raw10 from './deps-list/actor.maia'
import raw11 from './deps-list/interface.maia'
import raw12 from './deps-list/process.maia'
import raw13 from './deps-list/style.maia'
import raw14 from './deps-list/view.maia'
import raw5 from './deps-list-detail/actor.maia'
import raw6 from './deps-list-detail/context.maia'
import raw7 from './deps-list-detail/interface.maia'
import raw8 from './deps-list-detail/process.maia'
import raw9 from './deps-list-detail/view.maia'
import raw15 from './intent/intent.actor.maia'
import raw16 from './intent/intent.context.maia'
import raw17 from './intent/intent.process.maia'
import raw18 from './intent/intent.view.maia'
import raw19 from './layout-quickjs/actor.maia'
import raw20 from './layout-quickjs/context.maia'
import raw21 from './layout-quickjs/interface.maia'
import quickjsVibe from './manifest.vibe.maia'

const base = 'quickjs'
const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(quickjsVibe, `${base}/manifest.vibe.maia`)

const depsListContext = annotateMaiaConfig(
	{
		$factory: '°maia/factory/context.factory.maia',
		title: 'Dependency actors',
		listItems: (quickjsVibe.dependencies || []).map((id) => ({
			id,
			label: id.replace(/^°maia\//, ''),
		})),
		hasSelection: false,
		selectedActorRef: null,
		selectedCodeCoId: null,
		selectedWasmCode: {
			factory: '°maia/factory/cotext.factory.maia',
			filter: { id: '$selectedCodeCoId' },
			map: { items: 'items' },
		},
		selectedItem: { id: '', label: '' },
	},
	`${base}/deps-list/context.dynamic.maia`,
)

export const QuickjsVibeRegistry = {
	vibe,

	styles: {
		'brand/maiacity.style.maia': brand,
		'quickjs/deps-list/style.maia': annotateMaiaConfig(raw13, 'quickjs/deps-list/style.maia'),
	},

	actors: {
		'quickjs/add-form/actor.maia': annotateMaiaConfig(raw0, 'quickjs/add-form/actor.maia'),
		'quickjs/deps-list-detail/actor.maia': annotateMaiaConfig(
			raw5,
			'quickjs/deps-list-detail/actor.maia',
		),
		'quickjs/deps-list/actor.maia': annotateMaiaConfig(raw10, 'quickjs/deps-list/actor.maia'),
		'quickjs/intent/intent.actor.maia': annotateMaiaConfig(raw15, 'quickjs/intent/intent.actor.maia'),
		'quickjs/layout-quickjs/actor.maia': annotateMaiaConfig(
			raw19,
			'quickjs/layout-quickjs/actor.maia',
		),
	},

	views: {
		'quickjs/add-form/view.maia': annotateMaiaConfig(raw4, 'quickjs/add-form/view.maia'),
		'quickjs/deps-list-detail/view.maia': annotateMaiaConfig(
			raw9,
			'quickjs/deps-list-detail/view.maia',
		),
		'quickjs/deps-list/view.maia': annotateMaiaConfig(raw14, 'quickjs/deps-list/view.maia'),
		'quickjs/intent/intent.view.maia': annotateMaiaConfig(raw18, 'quickjs/intent/intent.view.maia'),
	},

	contexts: {
		'quickjs/add-form/context.maia': annotateMaiaConfig(raw1, 'quickjs/add-form/context.maia'),
		'quickjs/deps-list-detail/context.maia': annotateMaiaConfig(
			raw6,
			'quickjs/deps-list-detail/context.maia',
		),
		'quickjs/intent/intent.context.maia': annotateMaiaConfig(
			raw16,
			'quickjs/intent/intent.context.maia',
		),
		'quickjs/layout-quickjs/context.maia': annotateMaiaConfig(
			raw20,
			'quickjs/layout-quickjs/context.maia',
		),
		[`${base}/deps-list/context.dynamic.maia`]: depsListContext,
	},

	processes: {
		'quickjs/add-form/process.maia': annotateMaiaConfig(raw3, 'quickjs/add-form/process.maia'),
		'quickjs/deps-list-detail/process.maia': annotateMaiaConfig(
			raw8,
			'quickjs/deps-list-detail/process.maia',
		),
		'quickjs/deps-list/process.maia': annotateMaiaConfig(raw12, 'quickjs/deps-list/process.maia'),
		'quickjs/intent/intent.process.maia': annotateMaiaConfig(
			raw17,
			'quickjs/intent/intent.process.maia',
		),
	},

	interfaces: {
		'quickjs/add-form/interface.maia': annotateMaiaConfig(raw2, 'quickjs/add-form/interface.maia'),
		'quickjs/deps-list-detail/interface.maia': annotateMaiaConfig(
			raw7,
			'quickjs/deps-list-detail/interface.maia',
		),
		'quickjs/deps-list/interface.maia': annotateMaiaConfig(raw11, 'quickjs/deps-list/interface.maia'),
		'quickjs/layout-quickjs/interface.maia': annotateMaiaConfig(
			raw21,
			'quickjs/layout-quickjs/interface.maia',
		),
	},
}
