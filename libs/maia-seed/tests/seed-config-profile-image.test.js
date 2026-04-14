import { MAIA_SPARK_REGISTRY } from '@MaiaOS/universe'
import { getSeedConfig } from '@MaiaOS/universe/config/build-seed-config.js'
import { maiaIdentity } from '@MaiaOS/universe/helpers/identity-from-maia-path.js'
import { describe, expect, test } from 'bun:test'

describe('getSeedConfig profile-image', () => {
	test('seeds the views context referenced by services/profile-image actor (not services/context stub)', () => {
		const { contexts } = getSeedConfig()
		const viewCtx = MAIA_SPARK_REGISTRY[maiaIdentity('views/profile-image/context.maia').$nanoid]
		expect(viewCtx?.$label).toBeTruthy()
		expect(contexts['views/profile-image/context.maia']).toEqual(viewCtx)
	})
})
