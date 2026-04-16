#!/usr/bin/env bun
import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'

bootstrapNodeLogging()
const log = createLogger('dev')

export function bootHeader() {
	log.log('')
	log.log('╔════════════════════════════════════════╗')
	log.log('║  MaiaOS Development Server  ║')
	log.log('╚════════════════════════════════════════╝')
	log.log('')
}

export function bootFooter() {
	log.log('')
	log.log('✓ All services ready!')
	log.log('Press Ctrl+C to stop')
	log.log('')
}
