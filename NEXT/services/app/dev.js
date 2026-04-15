import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { join } from 'node:path'

const root = import.meta.dir
const bun = process.execPath
const selfSrc = join(root, '../../libs/self/src')

function shouldIgnore(relativePath) {
	if (!relativePath) return true
	const s = relativePath.split('\\').join('/')
	if (s.includes('node_modules')) return true
	if (s.includes('/.git/') || s.startsWith('.git/')) return true
	return false
}

function isServerOrDevSource(filename) {
	if (!filename) return false
	const base = filename.split(/[/\\]/).pop()
	return base === 'server.js' || base === 'dev.js'
}

let child = null
let debounceTimer = null
let ignoreNextServerExit = false

function start() {
	child = spawn(bun, [join(root, 'server.js')], {
		cwd: root,
		stdio: 'inherit',
		env: { ...process.env, MAIACITY_DEV: '1' },
	})
	child.on('exit', (code, signal) => {
		child = null
		if (ignoreNextServerExit) return
		if (signal === 'SIGTERM' || signal === 'SIGKILL') return
		if (code !== 0 && code !== null) process.exit(code ?? 1)
	})
}

function stop() {
	return new Promise((resolve) => {
		if (!child) {
			resolve()
			return
		}
		ignoreNextServerExit = true
		const c = child
		const pid = c.pid
		let settled = false
		const finish = () => {
			if (settled) return
			settled = true
			ignoreNextServerExit = false
			resolve()
		}
		c.once('exit', finish)
		c.kill('SIGTERM')
		setTimeout(() => {
			try {
				process.kill(pid, 'SIGKILL')
			} catch {
				// ignore
			}
			finish()
		}, 400)
	})
}

async function scheduleRestart() {
	clearTimeout(debounceTimer)
	debounceTimer = setTimeout(async () => {
		await stop()
		start()
	}, 120)
}

function shutdown() {
	clearTimeout(debounceTimer)
	return stop().then(() => process.exit(0))
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

start()

let buildTimer = null
function scheduleBuildClient() {
	clearTimeout(buildTimer)
	buildTimer = setTimeout(() => {
		const b = spawn(bun, ['run', 'build:client'], {
			cwd: root,
			stdio: 'inherit',
			env: process.env,
		})
		b.on('exit', (code) => {
			if (code !== 0) console.error('[maiacity/app] build:client failed')
		})
	}, 250)
}

watch(join(root, 'client.js'), () => {
	scheduleBuildClient()
})
watch(selfSrc, { recursive: true }, (_event, filename) => {
	if (shouldIgnore(filename)) return
	scheduleBuildClient()
})

watch(root, { recursive: true }, (_event, filename) => {
	if (shouldIgnore(filename)) return
	if (!isServerOrDevSource(filename)) return
	scheduleRestart()
})
