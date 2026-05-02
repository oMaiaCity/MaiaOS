import { describe, expect, test } from 'bun:test'
import { nanoidFromPath, normalizeMaiaPathKey } from '../src/nanoid.js'

describe('nanoidFromPath', () => {
	test('same nano id for case variants', () => {
		const a = nanoidFromPath('maia/chat/intent/intent.actor.json')
		const b = nanoidFromPath('Maia/Chat/Intent/intent.actor.json')
		const c = nanoidFromPath('MAIA/CHAT/INTENT/INTENT.ACTOR.JSON')
		expect(a).toBe(b)
		expect(b).toBe(c)
		expect(a.length).toBe(12)
	})

	test('normalizes slashes', () => {
		expect(normalizeMaiaPathKey('Maia/X/y.json')).toBe('maia/x/y.json')
	})
})
