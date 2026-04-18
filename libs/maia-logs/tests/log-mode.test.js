import { describe, expect, test } from 'bun:test'
import {
	isDebugChannelEnabled,
	isDevVerboseEnabled,
	isOpsInfoEnabled,
	isPerfChannelEnabled,
	isTraceEnabledFromConfig,
} from '../src/log-config.js'
import { applyLogModeFromEnv, resolveMaiaLogMode } from '../src/log-mode.js'

describe('applyLogModeFromEnv', () => {
	test('empty string disables perf, debug, trace', () => {
		applyLogModeFromEnv('')
		expect(isPerfChannelEnabled('engines', 'pipeline')).toBe(false)
		expect(isDebugChannelEnabled('app', 'maia-db')).toBe(false)
		expect(isTraceEnabledFromConfig()).toBe(false)
	})

	test('perf.all enables a known perf channel', () => {
		applyLogModeFromEnv('perf.all')
		expect(isPerfChannelEnabled('engines', 'pipeline')).toBe(true)
	})

	test('empty disables ops info and dev.verbose in test env', () => {
		applyLogModeFromEnv('')
		expect(isOpsInfoEnabled('sync')).toBe(false)
		expect(isDevVerboseEnabled()).toBe(false)
	})

	test('empty LOG_MODE on Node development enables default OPS info', () => {
		const prev = process.env.NODE_ENV
		process.env.NODE_ENV = 'development'
		applyLogModeFromEnv('')
		expect(isOpsInfoEnabled('sync')).toBe(true)
		process.env.NODE_ENV = prev
	})

	test('ops.sync enables sync ops info', () => {
		applyLogModeFromEnv('ops.sync')
		expect(isOpsInfoEnabled('sync')).toBe(true)
		expect(isOpsInfoEnabled('llm')).toBe(false)
	})

	test('ops.all enables any ops subsystem', () => {
		applyLogModeFromEnv('ops.all')
		expect(isOpsInfoEnabled('sync')).toBe(true)
		expect(isOpsInfoEnabled('Storage')).toBe(true)
	})

	test('dev.verbose enables orchestrator flag and OPS (for child Listening lines)', () => {
		applyLogModeFromEnv('dev.verbose')
		expect(isDevVerboseEnabled()).toBe(true)
		expect(isOpsInfoEnabled('sync')).toBe(true)
	})
})

describe('resolveMaiaLogMode', () => {
	test('without window uses import.meta.env.LOG_MODE', () => {
		const v = resolveMaiaLogMode()
		expect(typeof v).toBe('string')
	})
})
