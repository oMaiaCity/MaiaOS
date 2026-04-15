/**
 * @MaiaOS/schemata — JSON Schema documents + merged views for account/profile/metaschema.
 */

import account from './account.schema.json'
import coTypesDoc from './co-types.defs.json'
import metaschema from './metaschema.schema.json'
import profile from './profile.schema.json'

export const CO_TYPES_DEFS = coTypesDoc.$defs

export const raw = {
	coTypes: coTypesDoc,
	account,
	profile,
	metaschema,
}

/**
 * @param {object} schema
 */
export function withCoTypeDefs(schema) {
	return {
		...schema,
		$defs: { ...CO_TYPES_DEFS, ...(schema.$defs || {}) },
	}
}

export const accountSchema = withCoTypeDefs(account)
export const profileSchema = withCoTypeDefs(profile)
export const metaschemaSchema = withCoTypeDefs(metaschema)
