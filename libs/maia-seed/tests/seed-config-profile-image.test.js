import { annotateMaiaByActorsPath } from '@MaiaOS/universe'
import { describe, expect, test } from 'bun:test'
import { getSeedConfig } from '../src/build-seed-config.js'

describe('getSeedConfig profile-image', () => {
	test('seeds the views context referenced by services/profile-image actor (not services/context stub)', () => {
		const { contexts } = getSeedConfig()
		const viewCtx = annotateMaiaByActorsPath['views/profile-image/context.maia']
		expect(viewCtx?.$label).toBeTruthy()
		expect(contexts['views/profile-image/context.maia']).toEqual(viewCtx)
	})
})
