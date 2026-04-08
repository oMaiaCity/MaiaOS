/**
 * Keys on spark.os CoMap (°maia spark).
 * - metaFactoryCoId: co_z of °maia/factory/meta (bootstrap anchor for catalog + resolution).
 * - instances: CoMap of instance path (°maia/.../*.maia, …) → instance co_z.
 * - indexes: CoMap keyed by schema co_z (definition catalog at key === metaFactoryCoId).
 */
export const SPARK_OS_META_FACTORY_CO_ID_KEY = 'metaFactoryCoId'
export const SPARK_OS_INSTANCES_KEY = 'instances'
