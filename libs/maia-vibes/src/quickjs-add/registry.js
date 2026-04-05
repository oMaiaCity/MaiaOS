/**
 * QuickJS Add Aven Registry
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import addFormActor from './add-form/actor.maia'
import addFormContext from './add-form/context.maia'
import addFormInterface from './add-form/interface.maia'
import addFormProcess from './add-form/process.maia'
import addFormView from './add-form/view.maia'
import depsListActor from './deps-list/actor.maia'
import depsListInterface from './deps-list/interface.maia'
import depsListProcess from './deps-list/process.maia'
import depsListStyle from './deps-list/style.maia'
import depsListView from './deps-list/view.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import layoutQuickjsAddActor from './layout-quickjs-add/actor.maia'
import layoutQuickjsAddContext from './layout-quickjs-add/context.maia'
import layoutQuickjsAddInterface from './layout-quickjs-add/interface.maia'
import quickjsAddVibe from './manifest.vibe.maia'

const depsListStyleMerged = depsListStyle

const depsListContext = {
	$factory: '°Maia/factory/context',
	$id: '°Maia/quickjs-add/context/deps-list',
	title: 'Dependency actors',
	listItems: (quickjsAddVibe.dependencies || []).map((id) => ({
		id,
		label: id.replace(/^°Maia\//, ''),
	})),
	hasSelection: false,
	selectedActorRef: null,
	selectedCodeCoId: null,
	selectedWasmCode: {
		factory: '°Maia/factory/os/cotext',
		filter: { id: '$selectedCodeCoId' },
		map: { items: 'items' },
	},
	selectedItem: { id: '', label: '' },
}

export const QuickjsAddVibeRegistry = {
	vibe: quickjsAddVibe,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
		'°Maia/quickjs-add/style/deps-list': depsListStyleMerged,
	},

	actors: {
		'°Maia/quickjs-add/actor/intent': intentActor,
		'°Maia/quickjs-add/actor/add-form': addFormActor,
		'°Maia/quickjs-add/actor/layout-quickjs-add': layoutQuickjsAddActor,
		'°Maia/quickjs-add/actor/deps-list': depsListActor,
	},

	views: {
		'°Maia/quickjs-add/view/intent': intentView,
		'°Maia/quickjs-add/add-form/view': addFormView,
		'°Maia/quickjs-add/view/deps-list': depsListView,
	},

	contexts: {
		'°Maia/quickjs-add/context/intent': intentContext,
		'°Maia/quickjs-add/context/add-form': addFormContext,
		'°Maia/quickjs-add/context/layout-quickjs-add': layoutQuickjsAddContext,
		'°Maia/quickjs-add/context/deps-list': depsListContext,
	},

	processes: {
		'°Maia/quickjs-add/process/intent': intentProcess,
		'°Maia/quickjs-add/process/add-form': addFormProcess,
		'°Maia/quickjs-add/process/deps-list': depsListProcess,
	},

	interfaces: {
		'°Maia/quickjs-add/add-form/interface': addFormInterface,
		'°Maia/quickjs-add/interface/layout-quickjs-add': layoutQuickjsAddInterface,
		'°Maia/quickjs-add/interface/deps-list': depsListInterface,
	},
}
