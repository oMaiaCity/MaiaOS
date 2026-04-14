import { identityFromMaiaPath } from '@MaiaOS/factories/identity-from-maia-path.js'
import { MAIA_SPARK_REGISTRY } from '@MaiaOS/universe'
import { describe, expect, test } from 'bun:test'
import { getSeedConfig } from '../src/build-seed-config.js'

describe('getSeedConfig profile-image', () => {
	test('seeds the views context referenced by services/profile-image actor (not services/context stub)', () => {
		const { contexts } = getSeedConfig()
		const viewCtx =
			MAIA_SPARK_REGISTRY[identityFromMaiaPath('views/profile-image/context.maia').$nanoid]
		expect(viewCtx?.$label).toBeTruthy()
		expect(contexts['views/profile-image/context.maia']).toEqual(viewCtx)
	})
})
