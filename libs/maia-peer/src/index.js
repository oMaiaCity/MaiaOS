/**
 * @MaiaOS/peer - MaiaPeer
 *
 * P2P layer: node + account + sync.
 * setupSyncPeers, subscribeSyncState - client-side sync peer configuration.
 * createAccountWithSecret, loadAccount - account primitives (migration/seed injectable).
 */

export { createAccountWithSecret, loadAccount } from './coID.js'
export {
	setupJazzCloudPeer,
	setupSyncPeers,
	subscribeSyncState,
	updateSyncState,
} from './sync-peers.js'
export { getSyncHttpBaseUrl, getSyncWebSocketUrl } from './sync-urls.js'
