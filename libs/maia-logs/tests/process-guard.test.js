import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { bootstrapNodeLogging } from '../src/logger.js'

describe('bootstrapNodeLogging process guards', () => {
	const exitMock = mock(() => {})
	let originalExit = process.exit

	beforeAll(() => {
		originalExit = process.exit
		process.exit = exitMock
		bootstrapNodeLogging()
		bootstrapNodeLogging()
	})

	afterAll(() => {
		process.exit = originalExit
	})

	test('registers uncaughtException listener only once when bootstrap called twice', () => {
		expect(process.listenerCount('uncaughtException')).toBe(1)
		expect(process.listenerCount('unhandledRejection')).toBe(1)
	})

	test('benign ERR_POSTGRES_IDLE_TIMEOUT on uncaughtException does not exit', () => {
		exitMock.mockClear()
		const err = Object.assign(new Error('idle'), { code: 'ERR_POSTGRES_IDLE_TIMEOUT' })
		process.emit('uncaughtException', err)
		expect(exitMock).not.toHaveBeenCalled()
	})

	test('benign ERR_POSTGRES_CONNECTION_CLOSED on unhandledRejection does not exit', () => {
		exitMock.mockClear()
		const err = Object.assign(new Error('closed'), { code: 'ERR_POSTGRES_CONNECTION_CLOSED' })
		process.emit('unhandledRejection', err)
		expect(exitMock).not.toHaveBeenCalled()
	})

	test('fatal uncaughtException invokes process.exit(1)', () => {
		exitMock.mockClear()
		process.emit('uncaughtException', new TypeError('boom'))
		expect(exitMock).toHaveBeenCalledWith(1)
	})
})
