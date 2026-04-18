/**
 * @MaiaOS/peer - MaiaPeer
 *
 * P2P layer: node + account + sync.
 * setupSyncPeers, subscribeSyncState - client-side sync peer configuration.
 * createAccountWithSecret, loadAccount - account primitives (migration/seed injectable).
 * bootstrapAccountHandshake - single POST /bootstrap: sets account.sparks (trusting) + triggers server-side identity indexing.
 */

export { bootstrapAccountHandshake } from './bootstrap-handshake.js'
export {
	BOOTSTRAP_PHASES,
	BootstrapError,
	getBootstrapPhase,
	resetBootstrapPhase,
	setBootstrapPhase,
	subscribeBootstrapPhase,
} from './bootstrap-phase.js'
export { createAccountWithSecret, loadAccount, recoverAccountWithMissingProfile } from './coID.js'
export {
	setupJazzCloudPeer,
	setupSyncPeers,
	subscribeSyncState,
	updateSyncState,
} from './sync-peers.js'
export { getSyncHttpBaseUrl, getSyncWebSocketUrl } from './sync-urls.js'
export {
	TIMEOUT_COVALUE_LOAD,
	TIMEOUT_HTTP,
	TIMEOUT_STORAGE_PERSIST,
	TIMEOUT_WS_CONNECT,
} from './timeouts.js'
