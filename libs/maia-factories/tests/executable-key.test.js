import { describe, expect, test } from 'bun:test'
import { executableKeyFromMaiaPath } from '../src/executable-key-from-maia-path.js'

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
