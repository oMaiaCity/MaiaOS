#!/usr/bin/env bun
import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'

bootstrapNodeLogging()
const log = createLogger('dev')

export function bootHeader() {
	log.log('')
	log.log('  \x1b[1m▗▖  ▗▖ ▗▄▖ ▗▄▄▄▖ ▗▄▖      ▗▄▖  ▗▄▄▖\x1b[0m')
	log.log('  \x1b[1m▐▛▚▞▜▌▐▌ ▐▌  █  ▐▌ ▐▌    ▐▌ ▐▌▐▌   \x1b[0m')
	log.log('  \x1b[1m▐▌  ▐▌▐▛▀▜▌  █  ▐▛▀▜▌    ▐▌ ▐▌ ▝▀▚▖\x1b[0m')
	log.log('  \x1b[1m▐▌  ▐▌▐▌ ▐▌▗▄█▄▖▐▌ ▐▌    ▝▚▄▞▘▗▄▄▞▘\x1b[0m')
	log.log('')
	log.log('  \x1b[37mown your avens — own your sparks — own your life\x1b[0m')
	log.log('')
	log.log('  \x1b[34m\x1b]8;;https://maia.city\x1b\\https://maia.city\x1b]8;;\x1b\\\x1b[0m')
	log.log('')
}
