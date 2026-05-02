#!/usr/bin/env bun
import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'

bootstrapNodeLogging()
const log = createLogger('dev')

const WORDMARK = [
	' ▗▄▖ ▗▖  ▗▖▗▄▄▄▖▗▖  ▗▖     ▗▄▖  ▗▄▄▖',
	'▐▌ ▐▌▐▌  ▐▌▐▌   ▐▛▚▖▐▌    ▐▌ ▐▌▐▌   ',
	'▐▛▀▜▌▐▌  ▐▌▐▛▀▀▘▐▌ ▝▜▌    ▐▌ ▐▌ ▝▀▚▖',
	'▐▌ ▐▌ ▝▚▞▘ ▐▙▄▄▖▐▌  ▐▌    ▝▚▄▞▘▗▄▄▞▘',
]

export function bootHeader() {
	const b = '\x1b[1m'
	const r = '\x1b[0m'
	log.log('')
	for (const line of WORDMARK) {
		log.log(`  ${b}${line}${r}`)
	}
	log.log('')
	log.log('  \x1b[37mdiscover your sovereign self\x1b[0m')
	log.log('')
	log.log('  \x1b[34m\x1b]8;;https://aven.ceo\x1b\\https://aven.ceo\x1b]8;;\x1b\\\x1b[0m')
	log.log('')
}
