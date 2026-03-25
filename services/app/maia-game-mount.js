/**
 * Full-viewport Three.js scene from @MaiaOS/game (dashboard screen `the-game`).
 */
import { mountGame } from '@MaiaOS/game'

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
 * Paint loading UI, wait for splash image decode, then mount after frames so the browser can paint the splash.
 */
export async function renderGame() {
	disposeGame()
	const token = _loadSession
	const app = document.getElementById('app')
	app.innerHTML = gameLoadingMarkup()
	const container = document.getElementById('game-container')

	await waitForLoadingScreenImage()
	if (token !== _loadSession) return

	const runMount = () => {
		if (token !== _loadSession) return
		if (!container?.isConnected) return
		const { dispose } = mountGame(container)
		if (token !== _loadSession) {
			dispose()
			return
		}
		_gameDispose = dispose
		document.getElementById('game-loading')?.remove()
	}

	if (typeof requestAnimationFrame === 'function') {
		requestAnimationFrame(() => {
			requestAnimationFrame(runMount)
		})
	} else {
		setTimeout(runMount, 0)
	}
}
