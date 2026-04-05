/**
 * Actors Registry - Central export for actor definitions and executable functions
 * Service actors: definition (actor.maia with interface ref) + function.execute(actor, payload)
 * Interface schemas define accepted events; execution in .function.js
 */

import aiChatDef from './maia/os/ai/actor.maia'
import aiChatFn from './maia/os/ai/function.js'
import dbDef from './maia/os/db/actor.maia'
import dbFn from './maia/os/db/function.js'
import computeMessageNamesDef from './maia/services/names/actor.maia'
import computeMessageNamesFn from './maia/services/names/function.js'
import paperDef from './maia/services/paper/actor.maia'
import paperFn from './maia/services/paper/function.js'
import profileImageDef from './maia/services/profile-image/actor.maia'
import profileImageFn from './maia/services/profile-image/function.js'
import todosDef from './maia/services/todos/actor.maia'
import updateWasmCodeDef from './maia/services/update-wasm-code/actor.maia'
import updateWasmCodeFn from './maia/services/update-wasm-code/function.js'
import profileImageViewDef from './maia/views/profile-image/actor.maia'
import profileImageViewFn from './maia/views/profile-image/function.js'

export const ACTORS = {
	'maia/os/ai': { definition: aiChatDef, function: aiChatFn },
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
	'maia/os/db': { definition: dbDef, function: dbFn },
}

export function getActor(namespacePath) {
	let mod = ACTORS[namespacePath]
	if (mod) return mod
	if (namespacePath && !namespacePath.includes('/')) {
		mod = ACTORS[`maia/os/${namespacePath}`]
		if (mod) return mod
	}
	return null
}

export function getAllActorDefinitions() {
	const definitions = {}
	for (const [path, actor] of Object.entries(ACTORS)) {
		definitions[path] = actor.definition
	}
	return definitions
}

export { ACTOR_ID_TO_EVENT_TYPE, resolveServiceActorCoId } from './maia/actor-service-refs.js'

if (import.meta.hot) {
	import.meta.hot.accept()
}
