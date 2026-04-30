/**
 * Full-viewport Three.js scene from @MaiaOS/game (dashboard screen `the-game`).
 * Loads `@MaiaOS/game` only when entering The Game (dynamic import + parallel splash decode).
 */
import { createLogger } from '@MaiaOS/aven-os/client'

const gameMountLog = createLogger('game')

const LOADING_SCREEN_IMAGE = '/brand/images/loading-screen.png'

let _gameDispose = null
/** Bumps when `disposeGame` runs so in-flight deferred mounts can abort. */
let _loadSession = 0

/** Wait until the loading-screen image is decoded so the scene is not mounted while only the fallback color is visible. */
function waitForLoadingScreenImage() {
	return new Promise((resolve) => {
		const img = new Image()
		const done = () => resolve()
		function afterLoad() {
			if (typeof img.decode === 'function') {
				img.decode().then(done).catch(done)
			} else {
				done()
			}
		}
		img.onload = afterLoad
		img.onerror = done
		img.src = LOADING_SCREEN_IMAGE
		if (img.complete && img.naturalWidth > 0) {
			afterLoad()
		}
	})
}

export function disposeGame() {
	_loadSession++
	if (_gameDispose) {
		_gameDispose()
		_gameDispose = null
	}
}

function gameLoadingMarkup() {
	return `
		<div id="game-shell" style="position:absolute;inset:0;overflow:hidden">
			<div id="game-container" style="position:absolute;inset:0;width:100%;height:100%;z-index:1"></div>
			<div id="game-loading" class="game-loading-screen" role="status" aria-live="polite" aria-busy="true">
				<div class="game-loading-panel">
					<p class="game-loading-title">Loading Maia City</p>
					<p class="game-loading-sub">Preparing the world…</p>
					<div class="game-loading-spinner" aria-hidden="true"></div>
				</div>
			</div>
		</div>
	`
}

/**
 * Paint loading UI, decode splash + load game module in parallel, then mount after frames so the browser can paint the splash.
 */
export async function renderGame() {
	disposeGame()
	const token = _loadSession
	const app = document.getElementById('app')
	app.innerHTML = gameLoadingMarkup()
	const container = document.getElementById('game-container')

	const [, gameMod] = await Promise.all([waitForLoadingScreenImage(), import('@MaiaOS/game')])
	const { mountGame } = gameMod
	if (token !== _loadSession) return

	const scheduleMount = () => {
		if (token !== _loadSession) return
		if (!container?.isConnected) return
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					void runMountAsync(token, container, mountGame)
				})
			})
		} else {
			setTimeout(() => void runMountAsync(token, container, mountGame), 0)
		}
	}

	scheduleMount()
}

/** Terrain build yields to the event loop; await so home navigation can run mid-mount. */
async function runMountAsync(token, container, mountGame) {
	await new Promise((r) => setTimeout(r, 0))
	if (token !== _loadSession) return
	if (!container?.isConnected) return
	let result
	try {
		result = await mountGame(container, {
			isCancelled: () => token !== _loadSession,
		})
	} catch (err) {
		gameMountLog.error('[Maia game] mount failed', err)
		return
	}
	if (token !== _loadSession) {
		result?.dispose()
		return
	}
	if (!container?.isConnected) return
	_gameDispose = result.dispose
	document.getElementById('game-loading')?.remove()
}
