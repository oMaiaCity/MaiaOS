/**
 * Moai server bundle entry.
 * Single entry point: @MaiaOS/core (like client).
 * Core re-exports db, operations, self internally.
 */
export {
	CoJSONBackend,
	DBEngine,
	loadOrCreateAgentAccount,
	waitForStoreReady,
} from '@MaiaOS/core'
