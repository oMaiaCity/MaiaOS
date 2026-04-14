/**
 * Sync server bundle entry.
 * Single entry point: @MaiaOS/runtime (like client).
 * Core re-exports db, operations, self internally.
 */
export {
	DataEngine,
	loadOrCreateAgentAccount,
	MaiaDB,
	waitForStoreReady,
} from '@MaiaOS/runtime'
