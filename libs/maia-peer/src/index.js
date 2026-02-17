/**
 * @MaiaOS/peer - MaiaPeer
 *
 * P2P layer: node + account + sync.
 * setupSyncPeers, subscribeSyncState - client-side sync peer configuration.
 * createAccountWithSecret, loadAccount - account primitives (migration/seed injectable).
 */

export { createAccountWithSecret, loadAccount } from './coID.js'
export { setupSyncPeers, subscribeSyncState } from './sync-peers.js'
