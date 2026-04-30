/** Executable actor implementations — may import `@MaiaOS/db` and other heavy deps. */
import aiChatFn from './services/ai/function.js'
import dbFn from './services/db/function.js'
import computeMessageNamesFn from './services/names/function.js'
import paperFn from './services/paper/function.js'
import profileImageFn from './services/profile-image/function.js'
import updateWasmCodeFn from './services/update-wasm-code/function.js'
import profileImageViewFn from './views/profile-image/function.js'

export const ACTOR_FUNCTIONS = {
	'maia/services/ai': aiChatFn,
	'maia/services/names': computeMessageNamesFn,
	'maia/services/paper': paperFn,
	'maia/services/update-wasm-code': updateWasmCodeFn,
	'maia/services/profile-image': profileImageFn,
	'maia/views/profile-image': profileImageViewFn,
	'maia/services/todos': null,
	'maia/services/db': dbFn,
}
