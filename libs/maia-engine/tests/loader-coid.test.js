import { describe, expect, test } from 'bun:test'

describe('MaiaOS.loadVibe', () => {
	test('rejects non-co_z vibe id', async () => {
		const { MaiaOS } = await import('../src/index.js')
		const os = new MaiaOS()
		await expect(os.loadVibe('todos', null)).rejects.toThrow(/co-id \(co_z\.\.\.\)/)
	})
})
