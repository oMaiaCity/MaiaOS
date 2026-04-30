/**
 * MaiaDB core, system spark, spark.os infra (surface module).
 */

export { MaiaDB, SYSTEM_SPARK_REGISTRY_KEY } from '../cojson/core/MaiaDB.js'
export { loadInfraFromSparkOs } from '../cojson/factory/infra-from-spark-os.js'
export { INFRA_SLOTS } from '../cojson/infra-slot-manifest.js'
export {
	ensureIdentity,
	listAccountIdsFromIdentityIndex,
} from '../cojson/registry/ensure-identity.js'
export { SPARK_OS_META_FACTORY_CO_ID_KEY } from '../cojson/spark-os-keys.js'
