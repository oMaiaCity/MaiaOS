/**
 * Actors Registry - Central export for all actor definitions and functions
 * Service actors: definition (actor.maia + tool.maia merged) + function.execute(actor, payload)
 * Tool descriptor in tool.maia; execution in .function.js
 */

import aiChatDef from './os/ai/actor.maia'
import aiChatFn from './os/ai/function.js'
import aiChatTool from './os/ai/tool.maia'
import dbDef from './os/db/actor.maia'
import dbFn from './os/db/function.js'
import dbTool from './os/db/tool.maia'
import computeMessageNamesDef from './os/names/actor.maia'
import computeMessageNamesFn from './os/names/function.js'
import computeMessageNamesTool from './os/names/tool.maia'
import paperDef from './services/paper/actor.maia'
import paperFn from './services/paper/function.js'
import paperTool from './services/paper/tool.maia'

/** Merge actor def + tool def for consumers that expect definition.function (tool descriptor) */
function withTool(actorDef, toolDef) {
	if (!toolDef) return actorDef
	return { ...actorDef, function: toolDef }
}

export const ACTORS = {
	'maia/actor/os/ai': { definition: withTool(aiChatDef, aiChatTool), function: aiChatFn },
	'maia/actor/os/names': {
		definition: withTool(computeMessageNamesDef, computeMessageNamesTool),
		function: computeMessageNamesFn,
	},
	'maia/actor/services/paper': {
		definition: withTool(paperDef, paperTool),
		function: paperFn,
	},
	'maia/actor/os/db': { definition: withTool(dbDef, dbTool), function: dbFn },
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
