/**
 * Static regression contract: ensures reactive read paths keep critical calls
 * (wireItemSubscription → updateStore, *Loading flags in createUnifiedStore).
 *
 * Run from repo root: `bun run test:db-contract` (or `cd libs/maia-db && bun test`).
 * Avoid `bun test libs/maia-db/...` from root — unreliable with workspaces and can fail with EMFILE.
 */
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const crudDir = join(import.meta.dirname, '../../../src/cojson/crud')
const readContractSources = [
	'read-helpers.js',
	'read-single-and-sparks.js',
	'read-collection.js',
	'read-all-covalues.js',
	'read.js',
].map((f) => readFileSync(join(crudDir, f), 'utf8'))
const readJs = readContractSources.join('\n')

test('wireItemSubscription invokes updateStore after subscribe', () => {
	const i = readJs.indexOf('const wireItemSubscription')
	expect(i).toBeGreaterThan(-1)
	const block = readJs.slice(i, i + 400)
	expect(block).toContain('updateStore().catch')
})

test('createUnifiedStore sets keyLoading false for wired query keys', () => {
	expect(readJs).toMatch(/\$\{key\}Loading.*=\s*false/)
})

test('createUnifiedStore sets keyLoading true for unwired query objects', () => {
	expect(readJs).toMatch(/mergedValue\[[^\]]*Loading[^\]]*\]\s*=\s*true/)
})

test('readCollection updateStore ends with store._set', () => {
	const i = readJs.indexOf('const runUpdateStore = async () =>')
	expect(i).toBeGreaterThan(-1)
	const j = readJs.indexOf('updateStore = async () => {', i)
	expect(j).toBeGreaterThan(i)
	const body = readJs.slice(i, j)
	expect(body).toContain('store._set(results)')
})

test('createUnifiedStore flushUpdate always unifiedStore._set (no JSON stringify dedup)', () => {
	expect(readJs).not.toMatch(/currentValueStr !== lastValueStr/)
	expect(readJs).not.toContain('lastUnifiedValue')
	const i = readJs.indexOf('const flushUpdate = () => {')
	expect(i).toBeGreaterThan(-1)
	const block = readJs.slice(i, i + 4500)
	expect(block).toContain('unifiedStore._set(mergedValue)')
})

test('readCollection single colist uses observeCoValue before unavailable branch', () => {
	expect(readJs).toContain('Single colist subscription')
	expect(readJs).toContain('observeCoValue(peer, coListId).subscribe')
})

test('read single, collection items, and read-all share observeCoValue (independent listeners)', () => {
	expect(readJs).toContain('observeCoValue(peer, coId).subscribe')
	expect(readJs).toContain('observeCoValue(peer, id).subscribe')
	expect(readJs).toContain('observeCoValue(peer, coListId).subscribe')
})

test('readCollection store teardown clears derived-store live flag so cache can re-wire', () => {
	expect(readJs).toContain('setMaiaReadDerivedStoreLive(store, false)')
})

test('createUnifiedStore serializes query resolution (promise chain + skipInitial)', () => {
	expect(readJs).toContain('resolveChain')
	expect(readJs).toContain('scheduleResolve')
	expect(readJs).toContain('skipInitial')
})

test('createUnifiedStore preserves last committed query merge when query not yet wired', () => {
	expect(readJs).toContain('lastCommittedQueryMerge')
})

test('readSingleCoValue rejects dead cached readStore and evicts entry', () => {
	expect(readJs).toContain('_maiaReadReactiveDead')
	expect(readJs).toContain('cache.evict(storeCacheKey)')
})

test('makeSingleCoCleanup evicts readStore cache key on teardown', () => {
	expect(readJs).toContain('subscriptionCache.evict(readStoreCacheKey)')
})

test('cached derived stores use ensureDerivedLifecycle', () => {
	expect(readJs).toContain('ensureDerivedLifecycle')
	expect(readJs).toContain('._lifecycle')
})

test('subscribeToResolvedRef uses observeCoValue hub', () => {
	const i = readJs.indexOf('const subscribeToResolvedRef')
	expect(i).toBeGreaterThan(-1)
	const block = readJs.slice(i, i + 900)
	expect(block).toContain('observeCoValue(peer, refCoId)')
})
