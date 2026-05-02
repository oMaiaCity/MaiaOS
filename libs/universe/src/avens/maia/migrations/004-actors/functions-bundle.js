/** Executable actor implementations — may import `@MaiaOS/db` and other heavy deps. */
import aiChatFn from '../../seed/actors/services/ai/function.js'
import dbFn from '../../seed/actors/services/db/function.js'
import computeMessageNamesFn from '../../seed/actors/services/names/function.js'
import paperFn from '../../seed/actors/services/paper/function.js'
import profileImageFn from '../../seed/actors/services/profile-image/function.js'
import updateWasmCodeFn from '../../seed/actors/services/update-wasm-code/function.js'

export const ACTOR_FUNCTIONS = {
	'maia/services/ai': aiChatFn,
	'maia/services/names': computeMessageNamesFn,
	'maia/services/paper': paperFn,
	'maia/services/update-wasm-code': updateWasmCodeFn,
	'maia/services/profile-image': profileImageFn,
	'maia/views/profile-image': profileImageFn,
	'maia/services/todos': null,
	'maia/services/db': dbFn,
}
