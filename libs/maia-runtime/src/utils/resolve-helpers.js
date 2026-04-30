/**
 * Re-export from @MaiaOS/db — canonical implementation lives there so universe does not depend on runtime.
 * @MaiaOS/runtime/utils/* export path preserved for existing imports.
 */
export {
	loadContextStore,
	readStore,
	resolveSchemaFromCoValue,
	resolveToCoId,
} from '@MaiaOS/db/resolve-helpers'
