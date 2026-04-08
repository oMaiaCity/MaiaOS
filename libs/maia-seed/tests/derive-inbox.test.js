import { describe, expect, test } from 'bun:test'
import { deriveInboxId } from '../src/derive-inbox.js'

describe('deriveInboxId', () => {
	test('intent.actor.maia -> inbox.maia sibling', () => {
		expect(deriveInboxId('°maia/todos/intent/intent.actor.maia')).toBe(
			'°maia/todos/intent/inbox.maia',
		)
	})

	test('other *.actor.maia -> sibling inbox.maia', () => {
		expect(deriveInboxId('°maia/views/input/for-list.actor.maia')).toBe(
			'°maia/views/input/inbox.maia',
		)
	})

	test('literal actor.maia filename -> sibling inbox.maia', () => {
		expect(deriveInboxId('°maia/quickjs/add-form/actor.maia')).toBe(
			'°maia/quickjs/add-form/inbox.maia',
		)
	})

	test('non-actor paths return null', () => {
		expect(deriveInboxId('°maia/todos/intent/inbox.maia')).toBe(null)
		expect(deriveInboxId('°maia/legacy/todos/actor/intent')).toBe(null)
	})
})
