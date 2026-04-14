/**
 * Actors Registry - Central export for actor definitions and executable functions
 * Service actors: definition (actor.maia with interface ref) + function.execute(actor, payload)
 * Interface schemas define accepted events; execution in .function.js
 */

import aiChatDef from './services/ai/actor.maia'
import aiChatFn from './services/ai/function.js'
import dbDef from './services/db/actor.maia'
import dbFn from './services/db/function.js'
import computeMessageNamesDef from './services/names/actor.maia'
import computeMessageNamesFn from './services/names/function.js'
import paperDef from './services/paper/actor.maia'
import paperFn from './services/paper/function.js'
import profileImageDef from './services/profile-image/actor.maia'
import profileImageFn from './services/profile-image/function.js'
import todosDef from './services/todos/actor.maia'
import updateWasmCodeDef from './services/update-wasm-code/actor.maia'
import updateWasmCodeFn from './services/update-wasm-code/function.js'
import profileImageViewDef from './views/profile-image/actor.maia'
import profileImageViewFn from './views/profile-image/function.js'

export const ACTORS = {
	'maia/services/ai': { definition: aiChatDef, function: aiChatFn },
	'maia/services/names': {
		definition: computeMessageNamesDef,
		function: computeMessageNamesFn,
	},
	'maia/services/paper': {
		definition: paperDef,
		function: paperFn,
	},
	'maia/services/update-wasm-code': {
		definition: updateWasmCodeDef,
		function: updateWasmCodeFn,
	},
	'maia/services/profile-image': {
		definition: profileImageDef,
		function: profileImageFn,
	},
	'maia/views/profile-image': {
		definition: profileImageViewDef,
		function: profileImageViewFn,
	},
	'maia/services/todos': {
		definition: todosDef,
		function: null,
	},
	'maia/services/db': { definition: dbDef, function: dbFn },
}

export function getActor(namespacePath) {
	return ACTORS[namespacePath] ?? null
}

export function getAllActorDefinitions() {
	const definitions = {}
	for (const [path, actor] of Object.entries(ACTORS)) {
		definitions[path] = actor.definition
	}
	return definitions
}

export {
	ACTOR_ID_TO_EVENT_TYPE,
	isActorFilePathId,
	resolveServiceActorCoId,
} from './actor-service-refs.js'

if (import.meta.hot) {
	import.meta.hot.accept()
}
