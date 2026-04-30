/**
 * @MaiaOS/db — public facade. Layering: ./primitives → ./cojson (implementation) → ./modules (grouped surface).
 */

export { setupSyncPeers, subscribeSyncState, updateSyncState } from '@MaiaOS/peer'

export * from './modules/crud.js'
export * from './modules/groups.js'
export * from './modules/indexing.js'
export * from './modules/spark.js'

export { ensureProfileForNewAccount } from './profile-bootstrap.js'
export { generateRegistryName } from './utils/registry-name-generator.js'
