/**
 * Tools Registry - Central export for all tool definitions and functions
 */

import aiFn from './ai/ai.tool.js'
import aiDef from './ai/ai.tool.maia'
import computeMessageNamesFn from './core/computeMessageNames.tool.js'
import computeMessageNamesDef from './core/computeMessageNames.tool.maia'
import publishMessageFn from './core/publishMessage.tool.js'
import publishMessageDef from './core/publishMessage.tool.maia'
import dbFn from './db/db.tool.js'
import dbDef from './db/db.tool.maia'
import sparksFn from './sparks/sparks.tool.js'
import sparksDef from './sparks/sparks.tool.maia'

export const TOOLS = {
	'core/publishMessage': { definition: publishMessageDef, function: publishMessageFn },
	'core/computeMessageNames': {
		definition: computeMessageNamesDef,
		function: computeMessageNamesFn,
	},
	'ai/chat': { definition: aiDef, function: aiFn },
	'sparks/sparks': { definition: sparksDef, function: sparksFn },
	'db/db': { definition: dbDef, function: dbFn },
}

export function getTool(namespacePath) {
	return TOOLS[namespacePath] || null
}

export function getAllToolDefinitions() {
	const definitions = {}
	for (const [path, tool] of Object.entries(TOOLS)) {
		definitions[path] = tool.definition
	}
	return definitions
}
