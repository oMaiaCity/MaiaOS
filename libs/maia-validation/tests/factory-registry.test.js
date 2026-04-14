import { describe, expect, test } from 'bun:test'
import { ensureFactoriesLoaded, getFactory } from '../src/factory-registry.js'

describe('factory-registry (FACTORY_SCHEMAS)', () => {
	test('ensureFactoriesLoaded + getFactory resolves renamed note/todo factories', async () => {
		await ensureFactoriesLoaded()
		const note = getFactory('°maia/factory/note.factory.maia')
		const todo = getFactory('°maia/factory/todo.factory.maia')
		expect(note && typeof note === 'object').toBe(true)
		expect(todo && typeof todo === 'object').toBe(true)
	})
})
