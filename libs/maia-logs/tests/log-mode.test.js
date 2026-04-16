import { describe, expect, test } from 'bun:test'
import {
	isDebugChannelEnabled,
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
})

describe('resolveMaiaLogMode', () => {
	test('without window uses import.meta.env.LOG_MODE', () => {
		const v = resolveMaiaLogMode()
		expect(typeof v).toBe('string')
	})
})
