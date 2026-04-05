import { describe, expect, test } from 'bun:test'
import { nanoidFromPath, normalizeMaiaPathKey } from '../src/nanoid.js'

describe('nanoidFromPath', () => {
	test('same nano id for case variants', () => {
		const a = nanoidFromPath('maia/chat/intent/intent.actor.maia')
		const b = nanoidFromPath('Maia/Chat/Intent/intent.actor.maia')
		const c = nanoidFromPath('MAIA/CHAT/INTENT/INTENT.ACTOR.MAIA')
		expect(a).toBe(b)
		expect(b).toBe(c)
		expect(a.length).toBe(12)
	})

	test('normalizes slashes', () => {
		expect(normalizeMaiaPathKey('Maia/X/y.maia')).toBe('maia/x/y.maia')
	})
})
