/** Actor `.json` definitions only — no `function.js` implementations (shallow import graph for seed/config). */
import aiChatDef from './services/ai/actor.json'
import dbDef from './services/db/actor.json'
import computeMessageNamesDef from './services/names/actor.json'
import paperDef from './services/paper/actor.json'
import profileImageDef from './services/profile-image/actor.json'
import todosDef from './services/todos/actor.json'
import updateWasmCodeDef from './services/update-wasm-code/actor.json'
import profileImageViewDef from './views/profile-image/actor.json'

export const ACTOR_DEFINITIONS = {
	'maia/services/ai': aiChatDef,
	'maia/services/names': computeMessageNamesDef,
	'maia/services/paper': paperDef,
	'maia/services/update-wasm-code': updateWasmCodeDef,
	'maia/services/profile-image': profileImageDef,
	'maia/views/profile-image': profileImageViewDef,
	'maia/services/todos': todosDef,
	'maia/services/db': dbDef,
}
