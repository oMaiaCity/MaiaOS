/**
 * Schema Registry — re-exports peer-backed metaschema from @MaiaOS/validation + account resolver hook from db.
 */

export * from '@MaiaOS/validation/peer-factory-registry'
export { loadFactoriesFromAccount } from '../cojson/factory/resolver.js'
