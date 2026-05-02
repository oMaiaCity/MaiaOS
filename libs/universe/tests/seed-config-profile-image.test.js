import { describe, expect, test } from 'bun:test'
import { maiaIdentity } from '../src/avens/maia/helpers/identity-from-maia-path.js'
import { getSeedConfig } from '../src/avens/maia/helpers/seed/build-seed-config.js'
import { MAIA_SPARK_REGISTRY } from '../src/avens/maia/helpers/seed/registry-merge.js'

describe('getSeedConfig profile-image', () => {
	test('seeds the views context referenced by services/profile-image actor (not services/context stub)', () => {
		const { contexts } = getSeedConfig()
		const viewCtx = MAIA_SPARK_REGISTRY[maiaIdentity('views/profile-image/context.json').$nanoid]
		expect(viewCtx?.$label).toBeTruthy()
		expect(contexts['views/profile-image/context.json']).toEqual(viewCtx)
	})
})
