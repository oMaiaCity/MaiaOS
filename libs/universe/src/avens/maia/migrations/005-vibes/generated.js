/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-migrate-registries.mjs
 */

import { annotateMaiaConfig } from '../../helpers/identity-from-maia-path.js'
import { getVibeKey } from '../../helpers/vibe-keys.js'

import vb_49 from '../../seed/brand/maiacity.style.json'
import sd_1 from '../../seed/data/icons.data.json'
import sd_0 from '../../seed/data/notes.data.json'
import sd_2 from '../../seed/data/todos.data.json'
import vb_1 from '../../seed/vibes/chat/intent/intent.actor.json'
import vb_3 from '../../seed/vibes/chat/intent/intent.context.json'
import vb_4 from '../../seed/vibes/chat/intent/intent.process.json'
import vb_2 from '../../seed/vibes/chat/intent/intent.view.json'
import vb_0 from '../../seed/vibes/chat/manifest.vibe.json'
import vb_6 from '../../seed/vibes/humans/intent/intent.actor.json'
import vb_8 from '../../seed/vibes/humans/intent/intent.context.json'
import vb_9 from '../../seed/vibes/humans/intent/intent.process.json'
import vb_7 from '../../seed/vibes/humans/intent/intent.view.json'
import vb_5 from '../../seed/vibes/humans/manifest.vibe.json'
import vb_10 from '../../seed/vibes/paper/manifest.vibe.json'
import vb_12 from '../../seed/vibes/profile/intent/intent.actor.json'
import vb_14 from '../../seed/vibes/profile/intent/intent.context.json'
import vb_15 from '../../seed/vibes/profile/intent/intent.process.json'
import vb_13 from '../../seed/vibes/profile/intent/intent.view.json'
import vb_11 from '../../seed/vibes/profile/manifest.vibe.json'
import vb_35 from '../../seed/vibes/quickjs/add-form/actor.json'
import vb_36 from '../../seed/vibes/quickjs/add-form/context.json'
import vb_38 from '../../seed/vibes/quickjs/add-form/interface.json'
import vb_37 from '../../seed/vibes/quickjs/add-form/process.json'
import vb_34 from '../../seed/vibes/quickjs/add-form/view.json'
import vb_21 from '../../seed/vibes/quickjs/deps-list/actor.json'
import vb_24 from '../../seed/vibes/quickjs/deps-list/interface.json'
import vb_23 from '../../seed/vibes/quickjs/deps-list/process.json'
import vb_22 from '../../seed/vibes/quickjs/deps-list/style.json'
import vb_20 from '../../seed/vibes/quickjs/deps-list/view.json'
import vb_30 from '../../seed/vibes/quickjs/deps-list-detail/actor.json'
import vb_31 from '../../seed/vibes/quickjs/deps-list-detail/context.json'
import vb_33 from '../../seed/vibes/quickjs/deps-list-detail/interface.json'
import vb_32 from '../../seed/vibes/quickjs/deps-list-detail/process.json'
import vb_29 from '../../seed/vibes/quickjs/deps-list-detail/view.json'
import vb_25 from '../../seed/vibes/quickjs/intent/intent.actor.json'
import vb_27 from '../../seed/vibes/quickjs/intent/intent.context.json'
import vb_28 from '../../seed/vibes/quickjs/intent/intent.process.json'
import vb_26 from '../../seed/vibes/quickjs/intent/intent.view.json'
import vb_17 from '../../seed/vibes/quickjs/layout-quickjs/actor.json'
import vb_18 from '../../seed/vibes/quickjs/layout-quickjs/context.json'
import vb_19 from '../../seed/vibes/quickjs/layout-quickjs/interface.json'
import vb_16 from '../../seed/vibes/quickjs/manifest.vibe.json'
import vb_40 from '../../seed/vibes/sparks/intent/intent.actor.json'
import vb_42 from '../../seed/vibes/sparks/intent/intent.context.json'
import vb_43 from '../../seed/vibes/sparks/intent/intent.process.json'
import vb_41 from '../../seed/vibes/sparks/intent/intent.view.json'
import vb_39 from '../../seed/vibes/sparks/manifest.vibe.json'
import vb_45 from '../../seed/vibes/todos/intent/intent.actor.json'
import vb_47 from '../../seed/vibes/todos/intent/intent.context.json'
import vb_48 from '../../seed/vibes/todos/intent/intent.process.json'
import vb_46 from '../../seed/vibes/todos/intent/intent.view.json'
import vb_44 from '../../seed/vibes/todos/manifest.vibe.json'

export const SEED_DATA = Object.freeze({
	notes: sd_0,
	todos: sd_2,
	icons: sd_1,
})

export const MAIA_SPARK_REGISTRY = Object.freeze({
	'6y7gXqCFktN6': annotateMaiaConfig(vb_1, 'chat/intent/intent.actor.json'),
	g9JOS1j3LpsN: annotateMaiaConfig(vb_3, 'chat/intent/intent.context.json'),
	JUlIutst6DQF: annotateMaiaConfig(vb_4, 'chat/intent/intent.process.json'),
	KUHiZYiNbKA1: annotateMaiaConfig(vb_2, 'chat/intent/intent.view.json'),
	DT75BQ6seOPS: annotateMaiaConfig(vb_0, 'chat/manifest.vibe.json'),
	dS021St4lkMK: annotateMaiaConfig(vb_6, 'humans/intent/intent.actor.json'),
	RTPH2a4lIju8: annotateMaiaConfig(vb_8, 'humans/intent/intent.context.json'),
	YyyQDaY7qo4D: annotateMaiaConfig(vb_9, 'humans/intent/intent.process.json'),
	dfxHJ7PEs2u7: annotateMaiaConfig(vb_7, 'humans/intent/intent.view.json'),
	U5MRFD01LSgK: annotateMaiaConfig(vb_5, 'humans/manifest.vibe.json'),
	FSAAiqEjzXLv: annotateMaiaConfig(vb_10, 'paper/manifest.vibe.json'),
	gnO6SLslE1cE: annotateMaiaConfig(vb_12, 'profile/intent/intent.actor.json'),
	'1jxv3DrxhfAb': annotateMaiaConfig(vb_14, 'profile/intent/intent.context.json'),
	LdNi93VFILuz: annotateMaiaConfig(vb_15, 'profile/intent/intent.process.json'),
	KY23oIo0bqxg: annotateMaiaConfig(vb_13, 'profile/intent/intent.view.json'),
	JhinmgjzUcgV: annotateMaiaConfig(vb_11, 'profile/manifest.vibe.json'),
	NKQhxMAM0vVM: annotateMaiaConfig(vb_35, 'quickjs/add-form/actor.json'),
	TZTGP3SsZXTB: annotateMaiaConfig(vb_36, 'quickjs/add-form/context.json'),
	XcB8mmBCLXjm: annotateMaiaConfig(vb_38, 'quickjs/add-form/interface.json'),
	'5QO1rB8Idldo': annotateMaiaConfig(vb_37, 'quickjs/add-form/process.json'),
	NwmECpkONY6j: annotateMaiaConfig(vb_34, 'quickjs/add-form/view.json'),
	k1AmTfy7qJOy: annotateMaiaConfig(vb_30, 'quickjs/deps-list-detail/actor.json'),
	bckU4P9Qv1VW: annotateMaiaConfig(vb_31, 'quickjs/deps-list-detail/context.json'),
	OybPgezlcIZK: annotateMaiaConfig(vb_33, 'quickjs/deps-list-detail/interface.json'),
	VD5EljpKKOov: annotateMaiaConfig(vb_32, 'quickjs/deps-list-detail/process.json'),
	EcoYA2YLJu7S: annotateMaiaConfig(vb_29, 'quickjs/deps-list-detail/view.json'),
	wLgERoebOKfB: annotateMaiaConfig(vb_21, 'quickjs/deps-list/actor.json'),
	Bw7GzwSliTGM: annotateMaiaConfig(vb_24, 'quickjs/deps-list/interface.json'),
	'4vDa5j4wyor9': annotateMaiaConfig(vb_23, 'quickjs/deps-list/process.json'),
	wFYys7YO5vn3: annotateMaiaConfig(vb_22, 'quickjs/deps-list/style.json'),
	i2qeu1YUmXNX: annotateMaiaConfig(vb_20, 'quickjs/deps-list/view.json'),
	AJIeKRGebbf8: annotateMaiaConfig(vb_25, 'quickjs/intent/intent.actor.json'),
	gaYWB5xsaPDH: annotateMaiaConfig(vb_27, 'quickjs/intent/intent.context.json'),
	wbUzSftQzVkb: annotateMaiaConfig(vb_28, 'quickjs/intent/intent.process.json'),
	laOms4unA339: annotateMaiaConfig(vb_26, 'quickjs/intent/intent.view.json'),
	fqYdG1lXmkH0: annotateMaiaConfig(vb_17, 'quickjs/layout-quickjs/actor.json'),
	'7yROEMprTknc': annotateMaiaConfig(vb_18, 'quickjs/layout-quickjs/context.json'),
	s0IzWk5j45TD: annotateMaiaConfig(vb_19, 'quickjs/layout-quickjs/interface.json'),
	rxdB94En8FNB: annotateMaiaConfig(vb_16, 'quickjs/manifest.vibe.json'),
	ekqWUKQdpr1C: annotateMaiaConfig(vb_40, 'sparks/intent/intent.actor.json'),
	'1kFNNvODZ63f': annotateMaiaConfig(vb_42, 'sparks/intent/intent.context.json'),
	UyCuNeAh3UH2: annotateMaiaConfig(vb_43, 'sparks/intent/intent.process.json'),
	giu56FRFw1uR: annotateMaiaConfig(vb_41, 'sparks/intent/intent.view.json'),
	yVXpyoAqT2j6: annotateMaiaConfig(vb_39, 'sparks/manifest.vibe.json'),
	TzMx5mrOMhdC: annotateMaiaConfig(vb_45, 'todos/intent/intent.actor.json'),
	gM5j1mVbcVrM: annotateMaiaConfig(vb_47, 'todos/intent/intent.context.json'),
	JAdt8nLfhGJl: annotateMaiaConfig(vb_48, 'todos/intent/intent.process.json'),
	L3EwYFCGCLuC: annotateMaiaConfig(vb_46, 'todos/intent/intent.view.json'),
	'52l4jNGjPt43': annotateMaiaConfig(vb_44, 'todos/manifest.vibe.json'),
	JuCJ5s7LgcII: annotateMaiaConfig(vb_49, 'brand/maiacity.style.json'),
})

export const ChatVibeRegistry = {
	vibe: MAIA_SPARK_REGISTRY.DT75BQ6seOPS,
	styles: {
		JuCJ5s7LgcII: MAIA_SPARK_REGISTRY.JuCJ5s7LgcII,
	},
	actors: {
		'6y7gXqCFktN6': MAIA_SPARK_REGISTRY['6y7gXqCFktN6'],
	},
	views: {
		KUHiZYiNbKA1: MAIA_SPARK_REGISTRY.KUHiZYiNbKA1,
	},
	contexts: {
		g9JOS1j3LpsN: MAIA_SPARK_REGISTRY.g9JOS1j3LpsN,
	},
	processes: {
		JUlIutst6DQF: MAIA_SPARK_REGISTRY.JUlIutst6DQF,
	},
	interfaces: {},
	data: {
		chat: [],
	},
}
export const RegistriesVibeRegistry = {
	vibe: MAIA_SPARK_REGISTRY.U5MRFD01LSgK,
	styles: {
		JuCJ5s7LgcII: MAIA_SPARK_REGISTRY.JuCJ5s7LgcII,
	},
	actors: {
		dS021St4lkMK: MAIA_SPARK_REGISTRY.dS021St4lkMK,
	},
	views: {
		dfxHJ7PEs2u7: MAIA_SPARK_REGISTRY.dfxHJ7PEs2u7,
	},
	contexts: {
		RTPH2a4lIju8: MAIA_SPARK_REGISTRY.RTPH2a4lIju8,
	},
	processes: {
		YyyQDaY7qo4D: MAIA_SPARK_REGISTRY.YyyQDaY7qo4D,
	},
	interfaces: {},
}
export const PaperVibeRegistry = {
	vibe: MAIA_SPARK_REGISTRY.FSAAiqEjzXLv,
	styles: {
		JuCJ5s7LgcII: MAIA_SPARK_REGISTRY.JuCJ5s7LgcII,
	},
	actors: {},
	views: {},
	contexts: {},
	processes: {},
	interfaces: {},
	data: {
		notes: SEED_DATA.notes,
	},
}
export const ProfileVibeRegistry = {
	vibe: MAIA_SPARK_REGISTRY.JhinmgjzUcgV,
	styles: {
		JuCJ5s7LgcII: MAIA_SPARK_REGISTRY.JuCJ5s7LgcII,
	},
	actors: {
		gnO6SLslE1cE: MAIA_SPARK_REGISTRY.gnO6SLslE1cE,
	},
	views: {
		KY23oIo0bqxg: MAIA_SPARK_REGISTRY.KY23oIo0bqxg,
	},
	contexts: {
		'1jxv3DrxhfAb': MAIA_SPARK_REGISTRY['1jxv3DrxhfAb'],
	},
	processes: {
		LdNi93VFILuz: MAIA_SPARK_REGISTRY.LdNi93VFILuz,
	},
	interfaces: {},
}
const quickjsManifest = MAIA_SPARK_REGISTRY.rxdB94En8FNB

export const QuickjsVibeRegistry = {
	vibe: MAIA_SPARK_REGISTRY.rxdB94En8FNB,
	styles: {
		JuCJ5s7LgcII: MAIA_SPARK_REGISTRY.JuCJ5s7LgcII,
		wFYys7YO5vn3: MAIA_SPARK_REGISTRY.wFYys7YO5vn3,
	},
	actors: {
		AJIeKRGebbf8: MAIA_SPARK_REGISTRY.AJIeKRGebbf8,
		fqYdG1lXmkH0: MAIA_SPARK_REGISTRY.fqYdG1lXmkH0,
		k1AmTfy7qJOy: MAIA_SPARK_REGISTRY.k1AmTfy7qJOy,
		NKQhxMAM0vVM: MAIA_SPARK_REGISTRY.NKQhxMAM0vVM,
		wLgERoebOKfB: MAIA_SPARK_REGISTRY.wLgERoebOKfB,
	},
	views: {
		EcoYA2YLJu7S: MAIA_SPARK_REGISTRY.EcoYA2YLJu7S,
		i2qeu1YUmXNX: MAIA_SPARK_REGISTRY.i2qeu1YUmXNX,
		laOms4unA339: MAIA_SPARK_REGISTRY.laOms4unA339,
		NwmECpkONY6j: MAIA_SPARK_REGISTRY.NwmECpkONY6j,
	},
	contexts: {
		'7yROEMprTknc': MAIA_SPARK_REGISTRY['7yROEMprTknc'],
		bckU4P9Qv1VW: MAIA_SPARK_REGISTRY.bckU4P9Qv1VW,
		gaYWB5xsaPDH: MAIA_SPARK_REGISTRY.gaYWB5xsaPDH,
		TZTGP3SsZXTB: MAIA_SPARK_REGISTRY.TZTGP3SsZXTB,
		u8MbgQ8E9pzV: annotateMaiaConfig(
			{
				$factory: '°maia/factory/context.factory.json',
				title: 'Dependency actors',
				listItems: (quickjsManifest.dependencies || []).map((id) => ({
					id,
					label: id.replace(/^°maia\//, ''),
				})),
				hasSelection: false,
				selectedActorRef: null,
				selectedCodeCoId: null,
				selectedWasmCode: {
					factory: '°maia/factory/cotext.factory.json',
					options: {
						filter: { id: '$selectedCodeCoId' },
						map: { items: 'items' },
					},
				},
				selectedItem: { id: '', label: '' },
			},
			'quickjs/deps-list/context.dynamic.json',
		),
	},
	processes: {
		'4vDa5j4wyor9': MAIA_SPARK_REGISTRY['4vDa5j4wyor9'],
		'5QO1rB8Idldo': MAIA_SPARK_REGISTRY['5QO1rB8Idldo'],
		VD5EljpKKOov: MAIA_SPARK_REGISTRY.VD5EljpKKOov,
		wbUzSftQzVkb: MAIA_SPARK_REGISTRY.wbUzSftQzVkb,
	},
	interfaces: {
		Bw7GzwSliTGM: MAIA_SPARK_REGISTRY.Bw7GzwSliTGM,
		OybPgezlcIZK: MAIA_SPARK_REGISTRY.OybPgezlcIZK,
		s0IzWk5j45TD: MAIA_SPARK_REGISTRY.s0IzWk5j45TD,
		XcB8mmBCLXjm: MAIA_SPARK_REGISTRY.XcB8mmBCLXjm,
	},
}
export const SparksVibeRegistry = {
	vibe: MAIA_SPARK_REGISTRY.yVXpyoAqT2j6,
	styles: {
		JuCJ5s7LgcII: MAIA_SPARK_REGISTRY.JuCJ5s7LgcII,
	},
	actors: {
		ekqWUKQdpr1C: MAIA_SPARK_REGISTRY.ekqWUKQdpr1C,
	},
	views: {
		giu56FRFw1uR: MAIA_SPARK_REGISTRY.giu56FRFw1uR,
	},
	contexts: {
		'1kFNNvODZ63f': MAIA_SPARK_REGISTRY['1kFNNvODZ63f'],
	},
	processes: {
		UyCuNeAh3UH2: MAIA_SPARK_REGISTRY.UyCuNeAh3UH2,
	},
	interfaces: {},
}
export const TodosVibeRegistry = {
	vibe: MAIA_SPARK_REGISTRY['52l4jNGjPt43'],
	styles: {
		JuCJ5s7LgcII: MAIA_SPARK_REGISTRY.JuCJ5s7LgcII,
	},
	actors: {
		TzMx5mrOMhdC: MAIA_SPARK_REGISTRY.TzMx5mrOMhdC,
	},
	views: {
		L3EwYFCGCLuC: MAIA_SPARK_REGISTRY.L3EwYFCGCLuC,
	},
	contexts: {
		gM5j1mVbcVrM: MAIA_SPARK_REGISTRY.gM5j1mVbcVrM,
	},
	processes: {
		JAdt8nLfhGJl: MAIA_SPARK_REGISTRY.JAdt8nLfhGJl,
	},
	interfaces: {},
	data: {
		todos: SEED_DATA.todos,
	},
}

const collected = [
	ChatVibeRegistry,
	RegistriesVibeRegistry,
	PaperVibeRegistry,
	ProfileVibeRegistry,
	QuickjsVibeRegistry,
	SparksVibeRegistry,
	TodosVibeRegistry,
]
collected.sort((a, b) => (getVibeKey(a.vibe) || '').localeCompare(getVibeKey(b.vibe) || ''))
export const ALL_VIBE_REGISTRIES = collected
export async function getAllVibeRegistries() {
	return ALL_VIBE_REGISTRIES.filter((R) => R?.vibe)
}
export { ChatVibeRegistry as ChatAvenRegistry, PaperVibeRegistry as PaperAvenRegistry }
