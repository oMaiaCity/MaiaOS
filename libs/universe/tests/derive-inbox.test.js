import { describe, expect, test } from 'bun:test'
import { deriveInboxId } from '../src/avens/maia/helpers/seed/derive-inbox.js'

describe('deriveInboxId', () => {
	test('intent.actor.json -> inbox.json sibling', () => {
		expect(deriveInboxId('todos/intent/intent.actor.json')).toBe('todos/intent/inbox.json')
	})

	test('other *.actor.json -> sibling inbox.json', () => {
		expect(deriveInboxId('views/input/for-list.actor.json')).toBe('views/input/inbox.json')
	})

	test('literal actor.json filename -> sibling inbox.json', () => {
		expect(deriveInboxId('quickjs/add-form/actor.json')).toBe('quickjs/add-form/inbox.json')
	})

	test('non-actor paths return null', () => {
		expect(deriveInboxId('todos/intent/inbox.json')).toBe(null)
		expect(deriveInboxId('legacy/todos/actor/intent')).toBe(null)
	})
})
