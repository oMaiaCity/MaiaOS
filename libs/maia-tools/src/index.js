/**
 * Tools Registry - Central export for all tool definitions and functions
 */

import publishMessageDef from './core/publishMessage.tool.maia';
import computeMessageNamesDef from './core/computeMessageNames.tool.maia';
import memoryDef from './memory/memory.tool.maia';
import aiDef from './ai/ai.tool.maia';
import sparksDef from './sparks/sparks.tool.maia';
import dbDef from './db/db.tool.maia';

import publishMessageFn from './core/publishMessage.tool.js';
import computeMessageNamesFn from './core/computeMessageNames.tool.js';
import memoryFn from './memory/memory.tool.js';
import aiFn from './ai/ai.tool.js';
import sparksFn from './sparks/sparks.tool.js';
import dbFn from './db/db.tool.js';

export const TOOLS = {
  'core/publishMessage': { definition: publishMessageDef, function: publishMessageFn },
  'core/computeMessageNames': { definition: computeMessageNamesDef, function: computeMessageNamesFn },
  'memory/memory': { definition: memoryDef, function: memoryFn },
  'ai/chat': { definition: aiDef, function: aiFn },
  'sparks/sparks': { definition: sparksDef, function: sparksFn },
  'db/db': { definition: dbDef, function: dbFn }
};

export function getTool(namespacePath) {
  return TOOLS[namespacePath] || null;
}

export function getAllToolDefinitions() {
  const definitions = {};
  for (const [path, tool] of Object.entries(TOOLS)) {
    definitions[path] = tool.definition;
  }
  return definitions;
}
