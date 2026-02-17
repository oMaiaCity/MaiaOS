/**
 * Moai server bundle entry.
 * Single entry point: @MaiaOS/loader (like client).
 * Core re-exports db, operations, self internally.
 */
export {
	DataEngine,
	loadOrCreateAgentAccount,
	MaiaDB,
	waitForStoreReady,
} from '@MaiaOS/loader'
