import { ACTOR_NANOID_TO_EXECUTABLE_KEY } from '@MaiaOS/universe'
import { describe, expect, test } from 'bun:test'
import { executableKeyFromMaiaPath } from '../src/executable-key-from-maia-path.js'
import { identityFromMaiaPath } from '../src/identity-from-maia-path.js'

describe('executableKeyFromMaiaPath', () => {
	test('intent actor file path', () => {
		expect(executableKeyFromMaiaPath('°maia/todos/intent/intent.actor.maia')).toBe('todos/intent')
	})

	test('dotted actor under maia/', () => {
		expect(executableKeyFromMaiaPath('°maia/views/input/for-list.actor.maia')).toBe(
			'maia/views/input/for-list',
		)
	})

	test('service actor.maia', () => {
		expect(executableKeyFromMaiaPath('°maia/os/db/actor.maia')).toBe('maia/os/db')
	})

	test('legacy logical paths are not supported', () => {
		expect(executableKeyFromMaiaPath('°maia/chat/actor/intent')).toBe('maia/chat/actor/intent')
	})
})

describe('ACTOR_NANOID_TO_EXECUTABLE_KEY', () => {
	test('matches identityFromMaiaPath + executableKeyFromMaiaPath for a native actor file', () => {
		const pathKey = 'os/ai/actor.maia'
		const { $label, $nanoid } = identityFromMaiaPath(pathKey)
		const ex = executableKeyFromMaiaPath($label)
		expect(ex).toBe('maia/os/ai')
		expect(ACTOR_NANOID_TO_EXECUTABLE_KEY[$nanoid]).toBe(ex)
	})

	test('includes vibe intent.actor paths (same pathKey as registry / seed)', () => {
		const pathKey = 'todos/intent/intent.actor.maia'
		const { $label, $nanoid } = identityFromMaiaPath(pathKey)
		const ex = executableKeyFromMaiaPath($label)
		expect(ex).toBe('todos/intent')
		expect(ACTOR_NANOID_TO_EXECUTABLE_KEY[$nanoid]).toBe(ex)
	})
})
