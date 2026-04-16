import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
	emitLog,
	getRecentLogs,
	normalizeLevel,
	redact,
	resolveLevel,
	resolveMode,
	setLoggingRuntime,
	setTransport,
	shouldLog,
} from '../src/core.js'
import { createNoopTransport } from '../src/transports/noop.js'

describe('normalizeLevel', () => {
	test('accepts known levels', () => {
		expect(normalizeLevel('WARN')).toBe('warn')
		expect(normalizeLevel('debug')).toBe('debug')
	})
	test('unknown returns empty string', () => {
		expect(normalizeLevel('verbose')).toBe('')
	})
})

describe('resolveLevel', () => {
	test('uses explicit env when valid', () => {
		expect(resolveLevel('error', 'development')).toBe('error')
	})
	test('defaults by mode', () => {
		expect(resolveLevel('', 'test')).toBe('silent')
		expect(resolveLevel('', 'production')).toBe('warn')
		expect(resolveLevel('', 'development')).toBe('debug')
	})
})

describe('redact', () => {
	test('redacts Bearer tokens in strings', () => {
		const out = redact(['Authorization: Bearer abc123.secret', 'ok'])
		expect(out[0]).toContain('[redacted]')
		expect(out[0]).not.toContain('abc123')
		expect(out[1]).toBe('ok')
	})
})

describe('shouldLog + emitLog', () => {
	beforeEach(() => {
		setTransport(createNoopTransport())
		setLoggingRuntime({ mode: 'development', level: 'warn' })
	})

	test('shouldLog respects current level', () => {
		expect(shouldLog('error')).toBe(true)
		expect(shouldLog('debug')).toBe(false)
	})

	test('emitLog with level gate skips debug when level is warn', () => {
		const before = getRecentLogs().length
		emitLog('debug', 't', ['x'], { applyLevelGate: true })
		expect(getRecentLogs().length).toBe(before)
	})

	test('emitLog with applyLevelGate false records', () => {
		const before = getRecentLogs().length
		emitLog('debug', 't', ['y'], { applyLevelGate: false })
		expect(getRecentLogs().length).toBe(before + 1)
	})
})

describe('pluggable transport', () => {
	test('write receives redacted parts', () => {
		const writes = []
		setTransport({
			write(level, subsystem, parts) {
				writes.push({ level, subsystem, parts })
			},
		})
		setLoggingRuntime({ mode: 'development', level: 'log' })
		emitLog('log', 'sub', ['Bearer secret-token'], { applyLevelGate: true })
		expect(writes.length).toBe(1)
		expect(String(writes[0].parts[0])).toContain('[redacted]')
		setTransport(createNoopTransport())
	})
})

describe('resolveMode', () => {
	const orig = process.env.NODE_ENV
	afterEach(() => {
		if (orig === undefined) delete process.env.NODE_ENV
		else process.env.NODE_ENV = orig
	})

	test('test when NODE_ENV=test', () => {
		process.env.NODE_ENV = 'test'
		expect(resolveMode()).toBe('test')
	})
})
