/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '../../../../helpers/annotate-maia.js'
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

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(quickjsVibe, 'quickjs/manifest.vibe.maia')

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
	'quickjs/deps-list/context.dynamic.maia',
)

export const QuickjsVibeRegistry = {
	vibe,

	styles: {
		kIIgf0iCfbAU: brand,
		ZCpUzlYVunuN: annotateMaiaConfig(raw13, 'quickjs/deps-list/style.maia'),
	},

	actors: {
		GqBpurTHeBSA: annotateMaiaConfig(raw0, 'quickjs/add-form/actor.maia'),
		NYVUUdK9v783: annotateMaiaConfig(raw5, 'quickjs/deps-list-detail/actor.maia'),
		Grpymj3Oj5R1: annotateMaiaConfig(raw10, 'quickjs/deps-list/actor.maia'),
		XV1ARTtfudRM: annotateMaiaConfig(raw15, 'quickjs/intent/intent.actor.maia'),
		'2gVESpVjSjnn': annotateMaiaConfig(raw19, 'quickjs/layout-quickjs/actor.maia'),
	},

	views: {
		yYVLCY44Dc8J: annotateMaiaConfig(raw4, 'quickjs/add-form/view.maia'),
		W0QaHbPA2tDZ: annotateMaiaConfig(raw9, 'quickjs/deps-list-detail/view.maia'),
		cFB70xEjB4fk: annotateMaiaConfig(raw14, 'quickjs/deps-list/view.maia'),
		'49OFyUsKeVOM': annotateMaiaConfig(raw18, 'quickjs/intent/intent.view.maia'),
	},

	contexts: {
		PNtp1Sh3X9uz: annotateMaiaConfig(raw1, 'quickjs/add-form/context.maia'),
		IhvLzZmyXyU3: annotateMaiaConfig(raw6, 'quickjs/deps-list-detail/context.maia'),
		'5tBQe39jkMAG': annotateMaiaConfig(raw16, 'quickjs/intent/intent.context.maia'),
		HgVyMuPMjjXf: annotateMaiaConfig(raw20, 'quickjs/layout-quickjs/context.maia'),
		LTRLNKm2zgEl: depsListContext,
	},

	processes: {
		i7ZIOCbuLlCZ: annotateMaiaConfig(raw3, 'quickjs/add-form/process.maia'),
		QK0Mho2ETiZ7: annotateMaiaConfig(raw8, 'quickjs/deps-list-detail/process.maia'),
		i83Hy1P8q2hu: annotateMaiaConfig(raw12, 'quickjs/deps-list/process.maia'),
		vpfwDs7jV9WS: annotateMaiaConfig(raw17, 'quickjs/intent/intent.process.maia'),
	},

	interfaces: {
		f4RcjFf8QWIb: annotateMaiaConfig(raw2, 'quickjs/add-form/interface.maia'),
		'0Fgi5h1rpLCF': annotateMaiaConfig(raw7, 'quickjs/deps-list-detail/interface.maia'),
		bea6hRfoH6c0: annotateMaiaConfig(raw11, 'quickjs/deps-list/interface.maia'),
		Q8EVlYmS4Ya9: annotateMaiaConfig(raw21, 'quickjs/layout-quickjs/interface.maia'),
	},
}
