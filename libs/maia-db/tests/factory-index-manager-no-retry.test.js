import { describe, expect, test } from 'bun:test'
import { readHeaderAndContent } from '../src/modules/cojson-impl.js'

describe('readHeaderAndContent (no verified-state retry path)', () => {
	test('returns null content when getCurrentContent would be unsafe (not verified)', () => {
		const core = {
			id: 'co_zx',
			hasVerifiedContent: () => false,
		}
		const peer = {
			getHeader: () => ({ meta: { $factory: 'co_z1' } }),
			getCurrentContent: () => {
				throw new Error('getCurrentContent called on coValue without verified state')
			},
		}
		const { content, header } = readHeaderAndContent(peer, core)
		expect(content).toBe(null)
		expect(header?.meta?.$factory).toBe('co_z1')
	})
})
