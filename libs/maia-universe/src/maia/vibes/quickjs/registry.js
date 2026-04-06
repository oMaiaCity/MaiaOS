/**
 * QuickJS vibe registry
 */

import { annotateMaiaConfig } from '@MaiaOS/factories/annotate-maia'
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
import layoutQuickjsActor from './layout-quickjs/actor.maia'
import layoutQuickjsContext from './layout-quickjs/context.maia'
import layoutQuickjsInterface from './layout-quickjs/interface.maia'
import quickjsVibe from './manifest.vibe.maia'

const base = 'quickjs'
const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(quickjsVibe, `${base}/manifest.vibe.maia`)
const addFormActorA = annotateMaiaConfig(addFormActor, `${base}/add-form/actor.maia`)
const addFormContextA = annotateMaiaConfig(addFormContext, `${base}/add-form/context.maia`)
const addFormInterfaceA = annotateMaiaConfig(addFormInterface, `${base}/add-form/interface.maia`)
const addFormProcessA = annotateMaiaConfig(addFormProcess, `${base}/add-form/process.maia`)
const addFormViewA = annotateMaiaConfig(addFormView, `${base}/add-form/view.maia`)
const depsListActorA = annotateMaiaConfig(depsListActor, `${base}/deps-list/actor.maia`)
const depsListInterfaceA = annotateMaiaConfig(depsListInterface, `${base}/deps-list/interface.maia`)
const depsListProcessA = annotateMaiaConfig(depsListProcess, `${base}/deps-list/process.maia`)
const depsListStyleMerged = annotateMaiaConfig(depsListStyle, `${base}/deps-list/style.maia`)
const depsListViewA = annotateMaiaConfig(depsListView, `${base}/deps-list/view.maia`)
const intentActorA = annotateMaiaConfig(intentActor, `${base}/intent/intent.actor.maia`)
const intentContextA = annotateMaiaConfig(intentContext, `${base}/intent/intent.context.maia`)
const intentProcessA = annotateMaiaConfig(intentProcess, `${base}/intent/intent.process.maia`)
const intentViewA = annotateMaiaConfig(intentView, `${base}/intent/intent.view.maia`)
const layoutQuickjsActorA = annotateMaiaConfig(
	layoutQuickjsActor,
	`${base}/layout-quickjs/actor.maia`,
)
const layoutQuickjsContextA = annotateMaiaConfig(
	layoutQuickjsContext,
	`${base}/layout-quickjs/context.maia`,
)
const layoutQuickjsInterfaceA = annotateMaiaConfig(
	layoutQuickjsInterface,
	`${base}/layout-quickjs/interface.maia`,
)

const depsListContext = annotateMaiaConfig(
	{
		$factory: '°maia/factory/context',
		title: 'Dependency actors',
		listItems: (quickjsVibe.dependencies || []).map((id) => ({
			id,
			label: id.replace(/^°maia\//, ''),
		})),
		hasSelection: false,
		selectedActorRef: null,
		selectedCodeCoId: null,
		selectedWasmCode: {
			factory: '°maia/factory/os/cotext',
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
		[brand.$id]: brand,
		[depsListStyleMerged.$id]: depsListStyleMerged,
	},

	actors: {
		[intentActorA.$id]: intentActorA,
		[addFormActorA.$id]: addFormActorA,
		[layoutQuickjsActorA.$id]: layoutQuickjsActorA,
		[depsListActorA.$id]: depsListActorA,
	},

	views: {
		[intentViewA.$id]: intentViewA,
		[addFormViewA.$id]: addFormViewA,
		[depsListViewA.$id]: depsListViewA,
	},

	contexts: {
		[intentContextA.$id]: intentContextA,
		[addFormContextA.$id]: addFormContextA,
		[layoutQuickjsContextA.$id]: layoutQuickjsContextA,
		[depsListContext.$id]: depsListContext,
	},

	processes: {
		[intentProcessA.$id]: intentProcessA,
		[addFormProcessA.$id]: addFormProcessA,
		[depsListProcessA.$id]: depsListProcessA,
	},

	interfaces: {
		[addFormInterfaceA.$id]: addFormInterfaceA,
		[layoutQuickjsInterfaceA.$id]: layoutQuickjsInterfaceA,
		[depsListInterfaceA.$id]: depsListInterfaceA,
	},
}
