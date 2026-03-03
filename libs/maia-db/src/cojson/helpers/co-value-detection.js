/**
 * Universal Co-Value Detection Helper
 *
 * Single source of truth for detecting account/group/profile co-values and extracting schemas.
 * Eliminates duplication across storage hooks, validation hooks, and CRUD operations.
 */

import { isExceptionSchema } from '../../schemas/registry.js'

/**
 * Detect if a co-value is an account, group, or profile
 * Consolidates all detection logic from storage-hook-wrapper.js and validation-hook-wrapper.js
 *
 * @param {Object} msg - Message object with header (from storage/sync)
 * @param {Object} peer - Backend instance (for account detection)
 * @param {string} coId - Co-value ID
 * @returns {{isAccount: boolean, isGroup: boolean, isProfile: boolean, isException: boolean}}
 */
export function isAccountGroupOrProfile(msg, peer, coId) {
	// CRITICAL: Check peer.account.id FIRST - most definitive account detection
	// This works even if header structure is incomplete during account creation
	const isAccountById = peer?.account && peer.account.id === coId

	// Check if this is the profile co-value (referenced by account.profile)
	// During account creation, profile might be stored with header: null
	const isProfile = peer?.account?.get && peer.account.get('profile') === coId

	// Also check for account by meta.type (if meta exists)
	const isAccountByMeta = msg.header?.meta?.type === 'account'

	// Check ruleset.type - groups and accounts both have ruleset.type === 'group'
	// Check ruleset in header (primary location) - but header might be null during creation
	const ruleset = msg.header?.ruleset
	const isGroupOrAccount = ruleset?.type === 'group'

	// ROOT CAUSE: During account creation, header might be null for some co-values
	// If header is null but this is account creation (peer.account exists), allow it to pass
	// The header will be set in a later transaction
	const isAccountCreation = peer?.account && !msg.header

	// Determine types
	// Accounts: identified by ID, meta.type, or account creation context (when header is null)
	// Groups: have ruleset.type === 'group' but are NOT accounts
	// Profile: identified by account.profile reference
	const isAccount = isAccountById || isAccountByMeta || isAccountCreation
	const isGroup = isGroupOrAccount && !isAccountById && !isAccountByMeta && !isAccountCreation

	// Check if schema is an exception schema (only if schema exists)
	const schema = msg.header?.meta?.$schema
	const isException = schema ? isExceptionSchema(schema) : false

	return {
		isAccount,
		isGroup,
		isProfile,
		isException,
	}
}

/**
 * Extract schema co-id from message header
 * Universal schema extraction function - consolidates logic from multiple files
 *
 * @param {Object} msg - Message object with header (from storage/sync)
 * @returns {string|null} Schema co-id or null if not found
 */
export function extractSchemaFromMessage(msg) {
	if (!msg || !msg.header || !msg.header.meta) {
		return null
	}
	return msg.header.meta.$schema || null
}

/**
 * Determine if validation/indexing should be skipped for a co-value
 * Uses isAccountGroupOrProfile() + isExceptionSchema() to determine skip logic
 *
 * @param {Object} msg - Message object with header (from storage/sync)
 * @param {Object} peer - Backend instance (for account detection)
 * @param {string} coId - Co-value ID
 * @returns {boolean} True if validation/indexing should be skipped
 */
export function shouldSkipValidation(msg, peer, coId) {
	const detection = isAccountGroupOrProfile(msg, peer, coId)

	// Skip for accounts, groups, profiles, or exception schemas
	return detection.isAccount || detection.isGroup || detection.isProfile || detection.isException
}
