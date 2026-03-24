import { mountGame } from '@MaiaOS/game'

const root = document.getElementById('game-root')
if (!root) {
	throw new Error('missing #game-root')
}

const { dispose } = mountGame(root)
window.addEventListener('beforeunload', () => {
	dispose()
})
