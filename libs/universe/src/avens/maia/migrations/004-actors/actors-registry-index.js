/**
 * Actors Registry — executable functions + defs for migrate step 004-actors and runtime dispatch.
 */

import { ACTOR_DEFINITIONS } from './definitions.js'
import { ACTOR_FUNCTIONS } from './functions-bundle.js'

export const ACTORS = Object.fromEntries(
	Object.keys(ACTOR_DEFINITIONS).map((path) => [
		path,
		{
			definition: ACTOR_DEFINITIONS[path],
			function: ACTOR_FUNCTIONS[path] ?? null,
		},
	]),
)

export function getActor(namespacePath) {
	return ACTORS[namespacePath] ?? null
}

export function getAllActorDefinitions() {
	return { ...ACTOR_DEFINITIONS }
}

export {
	ACTOR_ID_TO_EVENT_TYPE,
	isActorFilePathId,
	resolveServiceActorCoId,
} from './actor-service-refs.js'
