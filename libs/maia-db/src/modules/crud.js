/**
 * CRUD + resolve + factory resolver + CoValue creation (surface over bundled cojson impl).
 */

export {
	CoCache,
	getGlobalCoCache,
	invalidateResolvedDataForMutatedCoValue,
	observeCoValue,
	resetGlobalCoCache,
} from '../primitives/co-cache.js'
export { extractCoValueData, normalizeCoValueData } from '../primitives/data-extraction.js'
export {
	createFactoryMeta,
	EXCEPTION_FACTORIES,
	getFactory,
	hasFactory,
} from '../primitives/factory-registry.js'
export { ReactiveStore } from '../primitives/reactive-store.js'
export {
	checkCotype,
	collectInboxMessageCoIds,
	createAndPushMessage,
	createCoList,
	createCoMap,
	createCoStream,
	createCoValueForSpark,
	ensureCoValueAvailable,
	ensureCoValueLoaded,
	findFirst,
	findNewSuccessFromTarget,
	getCoListId,
	getFactoryIndexColistId,
	loadContextStore,
	loadFactoriesFromAccount,
	processInbox,
	readStore,
	resolve,
	resolveCoValueReactive,
	resolveFactoryDefFromPeer,
	resolveFactoryFromCoValue,
	resolveFactoryReactive,
	resolveQueryReactive,
	resolveReactive,
	resolveToCoId,
	shouldProcessInboxMessageForSession,
	waitForReactiveResolution,
	waitForStoreReady,
} from './cojson-impl.js'
