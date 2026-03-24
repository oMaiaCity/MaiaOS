/**
 * Drop-in: full-viewport Three.js grid from @MaiaOS/game.
 * Re-enable by importing `renderGame` / `disposeGame` in main.js and restoring the `/the-game` route.
 */
import { mountGame } from '@MaiaOS/game'

let _gameDispose = null

export function disposeGame() {
	if (_gameDispose) {
		_gameDispose()
		_gameDispose = null
	}
}

export function renderGame() {
	disposeGame()
	const app = document.getElementById('app')
	app.innerHTML = `<div id="game-container" style="position:absolute;inset:0;width:100%;height:100%;"></div>`
	const container = document.getElementById('game-container')
	const { dispose } = mountGame(container)
	_gameDispose = dispose
}
