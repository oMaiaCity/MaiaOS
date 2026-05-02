/**
 * Actors Registry - Central export for actor definitions and executable functions
 * Service actors: definition (actor.json with interface ref) + function.execute(actor, payload)
 * Interface schemas define accepted events; execution in .function.js
 */

import { ACTOR_DEFINITIONS } from './definitions.js'
import { ACTOR_FUNCTIONS } from './functions.js'

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

if (import.meta.hot) {
	import.meta.hot.accept()
}
