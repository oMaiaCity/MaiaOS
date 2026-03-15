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
import quickjsAddAven from './manifest.aven.maia'

/** Fallback wasm.code for initial display (live code loads via GET_WASM_CODE on select) */
const WASM_CODE_BY_ACTOR = {
	'°Maia/actor/services/sandboxed-add': `({ execute: function(actor, payload) { var a = Number(payload.a) || 0; var b = Number(payload.b) || 0; return { ok: true, data: { result: a + b } }; } })`,
}

/** Hide placeholder when any dependency is selected (data-has-selection = dependency id) */
const placeholderHideWhenSelected = Object.fromEntries(
	(quickjsAddAven.dependencies || []).map((id) => [id, { display: 'none' }]),
)

const depsListStyleMerged = {
	...depsListStyle,
	components: {
		...(depsListStyle.components ?? {}),
		codeBlock: {
			display: 'block',
			fontFamily: 'monospace',
			fontSize: '0.75rem',
			whiteSpace: 'pre-wrap',
			wordBreak: 'break-all',
			padding: '{spacing.md}',
			background: 'rgba(255, 255, 255, 0.3)',
			borderRadius: '{radii.md}',
			border: '1px solid {colors.border}',
			overflow: 'auto',
			maxHeight: '50vh',
			resize: 'vertical',
			minHeight: '120px',
		},
		placeholderText: {
			...(depsListStyle.components?.placeholderText ?? {}),
			data: {
				hasSelection: {
					'': {},
					...placeholderHideWhenSelected,
				},
			},
		},
	},
}

const depsListContext = {
	$schema: '°Maia/schema/context',
	$id: '°Maia/quickjs-add/context/deps-list',
	title: 'Dependency actors',
	listItems: (quickjsAddAven.dependencies || []).map((id) => {
		const wasmCode = WASM_CODE_BY_ACTOR[id] ?? null
		return {
			id,
			label: id.replace(/^°Maia\//, ''),
			wasmCode,
			hasWasmCode: !!wasmCode,
		}
	}),
	selectedItem: { id: '', wasmCode: null, hasWasmCode: false },
}

export const QuickjsAddAvenRegistry = {
	aven: quickjsAddAven,

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
