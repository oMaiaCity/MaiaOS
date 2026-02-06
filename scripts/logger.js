#!/usr/bin/env bun

/**
 * Unified logging utility for MaiaOS boot process
 * Provides colored, structured, compact logs
 */

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	
	// Text colors
	black: '\x1b[30m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
	
	// Background colors
	bgBlack: '\x1b[40m',
	bgRed: '\x1b[41m',
	bgGreen: '\x1b[42m',
	bgYellow: '\x1b[43m',
	bgBlue: '\x1b[44m',
	bgMagenta: '\x1b[45m',
	bgCyan: '\x1b[46m',
	bgWhite: '\x1b[47m',
}

// Service color mapping
const serviceColors = {
	'dev': colors.cyan,
	'favicons': colors.magenta,
	'assets': colors.blue,
	'docs': colors.yellow,
	'api': colors.green,
	'server': colors.cyan,
	'maia-city': colors.bright + colors.cyan,
	'kernel': colors.dim + colors.cyan,
	'vibes': colors.dim + colors.cyan,
}

// Status icons
const icons = {
	success: '✓',
	error: '✗',
	warning: '⚠',
	info: 'ℹ',
	spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
}

/**
 * Format service name with color
 */
function formatService(service) {
	const color = serviceColors[service] || colors.white
	return `${color}${service}${colors.reset}`
}

/**
 * Format log line with service prefix
 */
function formatLog(service, message, icon = null) {
	const serviceName = formatService(service)
	const iconStr = icon ? `${icon} ` : ''
	return `${colors.dim}[${serviceName}${colors.dim}]${colors.reset} ${iconStr}${message}`
}

/**
 * Logger class
 */
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
	
	/**
	 * Compact status update (single line, no icon)
	 */
	status(message) {
		console.log(formatLog(this.service, message))
	}
}

/**
 * Create a logger instance for a service
 */
export function createLogger(service) {
	return new Logger(service)
}

/**
 * Format boot header
 */
export function bootHeader() {
	console.log()
	console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`)
	console.log(`${colors.bright}${colors.cyan}║${colors.reset}  ${colors.bright}MaiaOS Development Server${colors.reset}  ${colors.bright}${colors.cyan}║${colors.reset}`)
	console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}`)
	console.log()
}

/**
 * Format boot footer (when all services are ready)
 */
export function bootFooter() {
	console.log()
	console.log(`${colors.dim}${colors.green}✓${colors.reset} ${colors.green}${colors.bright}All services ready!${colors.reset}`)
	console.log(`${colors.dim}Press Ctrl+C to stop${colors.reset}`)
	console.log()
}

/**
 * Format service ready message
 */
export function serviceReady(service, port, endpoint = null) {
	const logger = createLogger(service)
	if (endpoint) {
		logger.success(`Ready on port ${port} → ${endpoint}`)
	} else {
		logger.success(`Ready on port ${port}`)
	}
}

/**
 * Format compact build progress
 */
export function buildProgress(service, message) {
	const logger = createLogger(service)
	logger.status(message)
}

/**
 * Format compact build complete
 */
export function buildComplete(service) {
	const logger = createLogger(service)
	logger.success('Build complete')
}
