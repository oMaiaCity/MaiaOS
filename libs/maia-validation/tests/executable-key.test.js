import { ACTOR_NANOID_TO_EXECUTABLE_KEY } from '@MaiaOS/universe/generated/registry.js'
import { describe, expect, test } from 'bun:test'
import { executableKeyFromMaiaPath, maiaIdentity } from '../src/identity-from-maia-path.js'

describe('executableKeyFromMaiaPath', () => {
	test('intent.actor.maia → vibe/intent', () => {
		expect(executableKeyFromMaiaPath('°maia/todos/intent/intent.actor.maia')).toBe('todos/intent')
	})

	test('dotted actor file → maia/.../stem', () => {
		expect(executableKeyFromMaiaPath('°maia/views/input/for-list.actor.maia')).toBe(
			'maia/views/input/for-list',
		)
	})

	test('services/.../actor.maia → maia/services/...', () => {
		expect(executableKeyFromMaiaPath('°maia/services/db/actor.maia')).toBe('maia/services/db')
	})

	test('non-file logical path passes through normalized', () => {
		expect(executableKeyFromMaiaPath('°maia/chat/actor/intent')).toBe('maia/chat/actor/intent')
	})
})

describe('ACTOR_NANOID_TO_EXECUTABLE_KEY', () => {
	test('matches maiaIdentity executableKey for a native actor file', () => {
		const pathKey = 'services/ai/actor.maia'
		const { $nanoid, executableKey: ex } = maiaIdentity(pathKey)
		expect(ex).toBe('maia/services/ai')
		expect(ACTOR_NANOID_TO_EXECUTABLE_KEY[$nanoid]).toBe(ex)
	})

	test('matches maiaIdentity for intent actor', () => {
		const pathKey = 'todos/intent/intent.actor.maia'
		const { $nanoid, executableKey: ex } = maiaIdentity(pathKey)
		expect(ex).toBe('todos/intent')
		expect(ACTOR_NANOID_TO_EXECUTABLE_KEY[$nanoid]).toBe(ex)
	})
})
