/**
 * Actors Registry - Central export for all actor definitions and functions
 * Service actors: definition (actor.maia + tool.maia merged) + function.execute(actor, payload)
 * Tool descriptor in tool.maia; execution in .function.js
 */

import aiChatDef from './aiChat/aiChat.actor.maia'
import aiChatFn from './aiChat/aiChat.function.js'
import aiChatTool from './aiChat/aiChat.tool.maia'
import computeMessageNamesDef from './computeMessageNames/computeMessageNames.actor.maia'
import computeMessageNamesFn from './computeMessageNames/computeMessageNames.function.js'
import computeMessageNamesTool from './computeMessageNames/computeMessageNames.tool.maia'
import dbDef from './db/db.actor.maia'
import dbFn from './db/db.function.js'
import dbTool from './db/db.tool.maia'
import sparksDef from './sparks/sparks.actor.maia'
import sparksFn from './sparks/sparks.function.js'
import sparksTool from './sparks/sparks.tool.maia'
import updatePaperContentDef from './updatePaperContent/updatePaperContent.actor.maia'
import updatePaperContentFn from './updatePaperContent/updatePaperContent.function.js'
import updatePaperContentTool from './updatePaperContent/updatePaperContent.tool.maia'

/** Merge actor def + tool def for consumers that expect definition.function (tool descriptor) */
function withTool(actorDef, toolDef) {
	if (!toolDef) return actorDef
	return { ...actorDef, function: toolDef }
}

export const ACTORS = {
	'ai/chat': { definition: withTool(aiChatDef, aiChatTool), function: aiChatFn },
	'core/computeMessageNames': {
		definition: withTool(computeMessageNamesDef, computeMessageNamesTool),
		function: computeMessageNamesFn,
	},
	'core/updatePaperContent': {
		definition: withTool(updatePaperContentDef, updatePaperContentTool),
		function: updatePaperContentFn,
	},
	'db/db': { definition: withTool(dbDef, dbTool), function: dbFn },
	'sparks/sparks': { definition: withTool(sparksDef, sparksTool), function: sparksFn },
}

export function getActor(namespacePath) {
	let mod = ACTORS[namespacePath]
	if (mod) return mod
	// Fallback: role @sparks → "sparks" but ACTORS key is "sparks/sparks"
	if (namespacePath && !namespacePath.includes('/')) {
		mod = ACTORS[`${namespacePath}/${namespacePath}`]
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
