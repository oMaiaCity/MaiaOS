#!/usr/bin/env bun

/** Unified logging for MaiaOS boot - colored, compact service prefixes */

const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
}

const serviceColors = {
	dev: colors.cyan,
	favicons: colors.magenta,
	assets: colors.blue,
	brand: colors.blue,
	docs: colors.yellow,
	api: colors.green,
	sync: colors.green,
	server: colors.cyan,
	app: colors.bright + colors.cyan,
	kernel: colors.dim + colors.cyan,
	vibes: colors.dim + colors.cyan,
}

const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' }

function formatLog(service, message, icon = null) {
	const color = serviceColors[service] || colors.white
	const prefix = `${colors.dim}[${color}${service}${colors.reset}${colors.dim}]${colors.reset}`
	return `${prefix} ${icon ? `${icon} ` : ''}${message}`
}

export class Logger {
	constructor(service) {
		this.service = service
	}

	success(message) {
		console.log(formatLog(this.service, message, icons.success))
	}

	error(message) {
		console.log(formatLog(this.service, message, icons.error))
	}

	warn(message) {
		console.log(formatLog(this.service, message, icons.warning))
	}

	info(message) {
		console.log(formatLog(this.service, message, icons.info))
	}

	log(message) {
		console.log(formatLog(this.service, message))
	}
}

export function createLogger(service) {
	return new Logger(service)
}

export function bootHeader() {
	console.log()
	console.log(
		`${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`,
	)
	console.log(
		`${colors.bright}${colors.cyan}║${colors.reset}  ${colors.bright}MaiaOS Development Server${colors.reset}  ${colors.bright}${colors.cyan}║${colors.reset}`,
	)
	console.log(
		`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}`,
	)
	console.log()
}

export function bootFooter() {
	console.log()
	console.log(
		`${colors.dim}${colors.green}✓${colors.reset} ${colors.green}${colors.bright}All services ready!${colors.reset}`,
	)
	console.log(`${colors.dim}Press Ctrl+C to stop${colors.reset}`)
	console.log()
}
