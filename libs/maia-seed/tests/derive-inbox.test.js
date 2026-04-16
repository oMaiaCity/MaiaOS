import { deriveInboxId } from '@MaiaOS/universe/config/derive-inbox.js'
import { describe, expect, test } from 'bun:test'

describe('deriveInboxId', () => {
	test('intent.actor.maia -> inbox.maia sibling', () => {
		expect(deriveInboxId('todos/intent/intent.actor.maia')).toBe('todos/intent/inbox.maia')
	})

	test('other *.actor.maia -> sibling inbox.maia', () => {
		expect(deriveInboxId('views/input/for-list.actor.maia')).toBe('views/input/inbox.maia')
	})

	test('literal actor.maia filename -> sibling inbox.maia', () => {
		expect(deriveInboxId('quickjs/add-form/actor.maia')).toBe('quickjs/add-form/inbox.maia')
	})

	test('non-actor paths return null', () => {
		expect(deriveInboxId('todos/intent/inbox.maia')).toBe(null)
		expect(deriveInboxId('legacy/todos/actor/intent')).toBe(null)
	})
})
