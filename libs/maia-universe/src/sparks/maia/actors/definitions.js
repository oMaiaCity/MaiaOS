/** Actor `.maia` definitions only — no `function.js` implementations (shallow import graph for seed/config). */
import aiChatDef from './services/ai/actor.maia'
import dbDef from './services/db/actor.maia'
import computeMessageNamesDef from './services/names/actor.maia'
import paperDef from './services/paper/actor.maia'
import profileImageDef from './services/profile-image/actor.maia'
import todosDef from './services/todos/actor.maia'
import updateWasmCodeDef from './services/update-wasm-code/actor.maia'
import profileImageViewDef from './views/profile-image/actor.maia'

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
