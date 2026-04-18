/**
 * Default transport: stderr/stdout style via `console` (only file allowed to call `console.*` from app code — see biome override).
 * Pretty mode: ANSI colors for `[subsystem]` prefix when stdout is a TTY and `NO_COLOR` is unset.
 */

/** @typedef {{ write: (level: string, subsystem: string, parts: unknown[]) => void }} MaiaLogTransport */

const R = '\x1b[0m'

/** Subsystem segment (before `:`) → ANSI foreground (bright for readability on dark terminals). */
const SUBSYSTEM_COLOR = {
	sync: '\x1b[94m', // blue
	app: '\x1b[92m', // green
	dev: '\x1b[38;5;248m', // light grey (orchestrator / dev scripts)
	universe: '\x1b[93m', // yellow (maia-universe manifest)
	docs: '\x1b[33m', // yellow (distinct from `app` bright yellow)
	assets: '\x1b[33m',
	favicons: '\x1b[33m',
	peer: '\x1b[36m', // cyan
	seed: '\x1b[33m', // yellow
	storage: '\x1b[90m', // gray (Storage / STORAGE use same segment when lowercased)
	llm: '\x1b[35m', // magenta
	register: '\x1b[91m', // bright red
	validationhook: '\x1b[33m',
	actorengine: '\x1b[33m',
	viewengine: '\x1b[33m',
}

const DEFAULT_SUBSYSTEM = '\x1b[90m' // dim gray
const SUCCESS_MESSAGE = '\x1b[92m' // bright green — message body only (prefix keeps subsystem color)
const DEV_GREY = '\x1b[38;5;248m' // dev `.success()` — same tone as `[dev]` prefix

/**
 * Multi-line `...` booting spinners: one interval redraws all rows with CUU so each line can animate
 * (two `\r` timers would fight over the same terminal row).
 * @type {{ rows: { key: string, prefix: string, base: string }[], interval: ReturnType<typeof setInterval> | null } | null}
 */
let _booting = null

/** @type {number} */
let _dotPhase = 1

function finalizeBootingSpinners() {
	if (!_booting) return
	if (_booting.interval) {
		clearInterval(_booting.interval)
	}
	if (_booting.rows.length > 0) {
		process.stdout.write('\n')
	}
	_booting = null
}

function tickBooting() {
	if (!_booting || _booting.rows.length === 0) return
	_dotPhase = (_dotPhase % 3) + 1
	const d = '.'.repeat(_dotPhase).padEnd(3, ' ')
	const lines = _booting.rows.map(({ prefix, base }) => `${prefix} ${base} ${d}`)
	const n = _booting.rows.length
	if (n === 1) {
		process.stdout.write(`\r${lines[0]}`)
	} else {
		// Cursor is at end of the last line; move up (n - 1) rows to the first booting line, then redraw all.
		const up = n - 1
		process.stdout.write(`\x1b[${up}A\r${lines.join('\n')}`)
	}
}

/**
 * @param {string} key
 * @param {string} prefix
 * @param {string} base
 */
function addBootingRow(key, prefix, base) {
	if (!_booting) {
		_booting = { rows: [], interval: null }
	}
	if (_booting.rows.some((r) => r.key === key)) return

	_booting.rows.push({ key, prefix, base })

	if (_booting.interval) {
		clearInterval(_booting.interval)
		_booting.interval = null
	}

	const n = _booting.rows.length

	if (n === 1) {
		_dotPhase = 1
		process.stdout.write(`${prefix} ${base} .  `)
		_booting.interval = setInterval(tickBooting, 500)
	} else {
		process.stdout.write(`\n${prefix} ${base} .  `)
		_booting.interval = setInterval(tickBooting, 500)
	}
}

function useAnsiSubsystemColors() {
	if (typeof process === 'undefined') return false
	if (process.env?.NO_COLOR != null && String(process.env.NO_COLOR).trim() !== '') return false
	if (process.stdout?.isTTY !== true) return false
	return true
}

/**
 * @param {string} subsystem
 * @returns {string}
 */
function styledSubsystemPrefix(subsystem) {
	if (!useAnsiSubsystemColors() || !subsystem) {
		return subsystem ? `[${subsystem}]` : ''
	}
	const seg = String(subsystem).split(':')[0].toLowerCase()
	const open = SUBSYSTEM_COLOR[seg] ?? DEFAULT_SUBSYSTEM
	return `${open}[${subsystem}]${R}`
}

/**
 * `.success()`: `[subsystem]` keeps normal subsystem color; string args are green except `dev` (all grey).
 * Special handling for `Ready - http://localhost:…`: "Ready -" and URL in normal white; `[app]`/`[sync]` prefix keeps service color.
 * @param {string} subsystem
 * @param {unknown[]} parts
 * @returns {unknown[]}
 */
function formatSuccessParts(subsystem, parts) {
	const seg = String(subsystem).split(':')[0].toLowerCase()
	if (!useAnsiSubsystemColors()) {
		return parts
	}
	if (seg === 'dev') {
		return parts.map((p) => (typeof p === 'string' ? `${DEV_GREY}${p}${R}` : p))
	}

	return parts.map((p) => {
		if (typeof p !== 'string') return p
		// Special case: "Ready - http://localhost:4200" — localhost URL stays normal white
		if (p.startsWith('Ready - ')) {
			const url = p.replace('Ready - ', '')
			return `\x1b[37mReady - ${url}${R}`
		}
		// Special case: `[universe] manifested` — white message, yellow prefix
		if (seg === 'universe' && p === 'manifested') {
			return `\x1b[37m${p}\x1b[0m`
		}
		return `${SUCCESS_MESSAGE}${p}${R}`
	})
}

/**
 * @param {{ json?: boolean }} opts
 * @returns {MaiaLogTransport}
 */
export function createConsoleTransport(opts = {}) {
	const json = opts.json === true
	return {
		write(level, subsystem, parts) {
			if (json) {
				const line = JSON.stringify({
					ts: new Date().toISOString(),
					level,
					subsystem,
					parts,
				})
				console.log(line)
				return
			}

			const prefix = subsystem ? styledSubsystemPrefix(subsystem) : ''
			const isAnimation =
				parts.length === 1 && typeof parts[0] === 'string' && parts[0].endsWith(' ...')

			if (isAnimation) {
				const tty = process.stdout?.isTTY === true
				if (!tty || !useAnsiSubsystemColors()) {
					const msg = String(parts[0])
					console.log(prefix ? `${prefix} ${msg}` : msg)
					return
				}

				const base = parts[0].slice(0, -4)
				const key = `${subsystem}:${base}`
				addBootingRow(key, prefix, base)
				return
			}

			// Any normal log ends spinner lines (registry, Ready, child output, etc.).
			finalizeBootingSpinners()

			let body = parts
			if (level === 'success' && subsystem) {
				body = formatSuccessParts(subsystem, parts)
			}
			const out = prefix ? [prefix, ...body] : body

			if (level === 'error') {
				console.error(...out)
			} else if (level === 'warn') {
				console.warn(...out)
			} else {
				console.log(...out)
			}
		},
	}
}
