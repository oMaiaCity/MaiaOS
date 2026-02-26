/**
 * Actors Registry - Central export for actor definitions and executable functions
 * Service actors: definition (actor.maia with interface ref) + function.execute(actor, payload)
 * Interface schemas define accepted events; execution in .function.js
 */

import aiChatDef from './os/ai/actor.maia'
import aiChatFn from './os/ai/function.js'
import dbDef from './os/db/actor.maia'
import dbFn from './os/db/function.js'
import computeMessageNamesDef from './services/names/actor.maia'
import computeMessageNamesFn from './services/names/function.js'
import paperDef from './services/paper/actor.maia'
import paperFn from './services/paper/function.js'
import todosDef from './services/todos/actor.maia'

export const ACTORS = {
	'maia/actor/os/ai': { definition: aiChatDef, function: aiChatFn },
	'maia/actor/services/names': {
		definition: computeMessageNamesDef,
		function: computeMessageNamesFn,
	},
	'maia/actor/services/paper': {
		definition: paperDef,
		function: paperFn,
	},
	'maia/actor/services/todos': {
		definition: todosDef,
		function: null,
	},
	'maia/actor/os/db': { definition: dbDef, function: dbFn },
}

export function getActor(namespacePath) {
	let mod = ACTORS[namespacePath]
	if (mod) return mod
	// Fallback: role @db → "maia/actor/os/db" for single-part lookups
	if (namespacePath && !namespacePath.includes('/')) {
		mod = ACTORS[`maia/actor/os/${namespacePath}`]
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

export {
	ACTOR_ID_TO_EVENT_TYPE,
	getSeedConfig,
	ROLE_TO_FOLDER,
	resolveServiceActorCoId,
} from './seed-config.js'

if (import.meta.hot) {
	import.meta.hot.accept()
}
