import { describe, expect, test } from 'bun:test'
import { executableKeyFromMaiaPath, maiaIdentity } from '../src/identity-from-maia-path.js'

describe('executableKeyFromMaiaPath', () => {
	test('intent.actor.json → vibe/intent', () => {
		expect(executableKeyFromMaiaPath('°maia/todos/intent/intent.actor.json')).toBe('todos/intent')
	})

	test('dotted actor file → maia/.../stem', () => {
		expect(executableKeyFromMaiaPath('°maia/views/input/for-list.actor.json')).toBe(
			'maia/views/input/for-list',
		)
	})

	test('services/.../actor.json → maia/services/...', () => {
		expect(executableKeyFromMaiaPath('°maia/services/db/actor.json')).toBe('maia/services/db')
	})

	test('non-file logical path passes through normalized', () => {
		expect(executableKeyFromMaiaPath('°maia/chat/actor/intent')).toBe('maia/chat/actor/intent')
	})
})

describe('maiaIdentity executableKey', () => {
	test('native actor file aligns with executableKeyFromMaiaPath', () => {
		const pathKey = 'services/ai/actor.json'
		const { $label, executableKey: ex } = maiaIdentity(pathKey)
		expect(ex).toBe('maia/services/ai')
		expect(executableKeyFromMaiaPath($label)).toBe(ex)
	})

	test('intent actor aligns with executableKeyFromMaiaPath', () => {
		const pathKey = 'todos/intent/intent.actor.json'
		const { $label, executableKey: ex } = maiaIdentity(pathKey)
		expect(ex).toBe('todos/intent')
		expect(executableKeyFromMaiaPath($label)).toBe(ex)
	})
})
