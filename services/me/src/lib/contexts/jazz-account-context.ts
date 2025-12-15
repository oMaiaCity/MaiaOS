/**
 * Jazz Account Context
 * Provides global access to the Jazz account across the application
 */

import { setContext, getContext } from 'svelte'
import type { AccountCoState } from 'jazz-tools/svelte'

const JAZZ_ACCOUNT_CONTEXT_KEY = Symbol('jazz-account')

/**
 * Set the Jazz account in context (call from layout)
 */
export function setJazzAccountContext(account: AccountCoState<any>) {
	setContext(JAZZ_ACCOUNT_CONTEXT_KEY, account)
}

/**
 * Get the Jazz account from context (use in child components)
 */
export function getJazzAccountContext(): AccountCoState<any> | undefined {
	return getContext(JAZZ_ACCOUNT_CONTEXT_KEY)
}

