/**
 * In-memory session only. Full page reload clears auth.
 * `/me` and `/db` are client-side (pushState) so navigation does not lose the in-memory session.
 */
import { signIn, signUp } from '../../libs/self/src/index.js'

/** @type {{ accountID: string, credentialId?: string, profileName?: string, node?: import('cojson').LocalNode, account?: import('cojson').RawAccount } | null} */
let session = null

const elWelcome = document.getElementById('view-welcome')
const elLoggedIn = document.getElementById('view-logged-in')
const elPanelMe = document.getElementById('panel-me')
const elPanelDb = document.getElementById('panel-db')
const elTabMe = document.getElementById('tab-me')
const elTabDb = document.getElementById('tab-db')
const elDbSnapshot = document.getElementById('db-snapshot')
const elAccountId = document.getElementById('account-id')
const elCredentialId = document.getElementById('credential-id')
const elProfileName = document.getElementById('profile-name')
const elErr = document.getElementById('auth-error')

function setError(msg) {
	if (!elErr) return
	elErr.textContent = msg || ''
	elErr.hidden = !msg
}

function readProfileName(node, account) {
	if (!node || !account || typeof account.get !== 'function') return '—'
	const pid = account.get('profile')
	if (!pid || typeof pid !== 'string') return '—'
	const core = node.getCoValue(pid)
	if (!core) return '—'
	const content = core.getCurrentContent?.()
	if (!content || typeof content.get !== 'function') return '—'
	const n = content.get('name')
	return typeof n === 'string' && n.length > 0 ? n : '—'
}

/**
 * @param {import('cojson').LocalNode | undefined} node
 * @param {import('cojson').RawAccount | undefined} account
 */
function buildDbSnapshot(node, account) {
	if (!node || !account) {
		return { error: 'No active session.' }
	}
	const out = {
		accountId: account.id,
		accountKeys: typeof account.keys === 'function' ? [...account.keys()] : [],
		profileRef: account.get('profile') ?? null,
		rootRef: account.get('root') ?? null,
	}
	const pid = account.get('profile')
	if (typeof pid === 'string' && pid.length > 0) {
		const core = node.getCoValue(pid)
		const content = core?.getCurrentContent?.()
		if (content && typeof content.get === 'function') {
			out.profileCoMap = {
				name: content.get('name'),
				avatar: content.get('avatar'),
			}
		}
	}
	const rid = account.get('root')
	if (typeof rid === 'string' && rid.length > 0) {
		const core = node.getCoValue(rid)
		const content = core?.getCurrentContent?.()
		if (content) {
			out.rootCoMap = {
				keys:
					typeof content.keys === 'function'
						? [...content.keys()]
						: typeof content.entries === 'function'
							? [...content.entries()].map(([k]) => k)
							: [],
			}
		}
	}
	return out
}

function renderDbSnapshot() {
	if (!elDbSnapshot) return
	const snap = session
		? buildDbSnapshot(session.node, session.account)
		: { error: 'No active session.' }
	elDbSnapshot.textContent = JSON.stringify(snap, null, 2)
}

function setMeFields(data) {
	if (elAccountId) elAccountId.textContent = data.accountID
	if (elCredentialId) elCredentialId.textContent = data.credentialId ?? '—'
	if (elProfileName) {
		const name =
			data.profileName ?? (data.node && data.account ? readProfileName(data.node, data.account) : '—')
		elProfileName.textContent = name
	}
}

/**
 * @param {'me' | 'db'} tab
 */
function activateTab(tab) {
	const isMe = tab === 'me'
	if (elPanelMe) elPanelMe.hidden = !isMe
	if (elPanelDb) elPanelDb.hidden = isMe
	if (elTabMe) {
		elTabMe.classList.toggle('active', isMe)
		elTabMe.setAttribute('aria-selected', isMe ? 'true' : 'false')
	}
	if (elTabDb) {
		elTabDb.classList.toggle('active', !isMe)
		elTabDb.setAttribute('aria-selected', !isMe ? 'true' : 'false')
	}
	if (!isMe) renderDbSnapshot()
}

function showWelcome() {
	session = null
	if (elWelcome) elWelcome.style.display = 'flex'
	if (elLoggedIn) elLoggedIn.style.display = 'none'
	setError('')
}

function showLoggedInView(data) {
	session = data
	if (elWelcome) elWelcome.style.display = 'none'
	if (elLoggedIn) elLoggedIn.style.display = 'flex'
	setMeFields(data)
	renderDbSnapshot()
}

function showMe(data) {
	showLoggedInView(data)
	activateTab('me')
	setError('')
	history.pushState({ loggedIn: true, tab: 'me' }, '', '/me')
}

function signOut() {
	showWelcome()
	history.pushState({}, '', '/')
}

function isLoggedInPath(path) {
	return path === '/me' || path === '/db'
}

function syncPathToView() {
	const path = window.location.pathname
	if (isLoggedInPath(path)) {
		if (!session) {
			history.replaceState({}, '', '/')
			showWelcome()
			return
		}
		if (elWelcome) elWelcome.style.display = 'none'
		if (elLoggedIn) elLoggedIn.style.display = 'flex'
		setMeFields(session)
		if (path === '/db') {
			activateTab('db')
		} else {
			activateTab('me')
		}
	} else {
		showWelcome()
	}
}

window.addEventListener('popstate', syncPathToView)

document.getElementById('btn-signup')?.addEventListener('click', async () => {
	setError('')
	try {
		const { accountID, credentialId, node, account } = await signUp({
			name: 'Traveler',
			salt: 'maia.city',
		})
		showMe({
			accountID,
			credentialId,
			node,
			account,
			profileName: readProfileName(node, account),
		})
	} catch (e) {
		setError(e?.message || String(e))
	}
})

document.getElementById('btn-signin')?.addEventListener('click', async () => {
	setError('')
	try {
		const { accountID, node, account } = await signIn({ salt: 'maia.city' })
		showMe({
			accountID,
			node,
			account,
			profileName: readProfileName(node, account),
		})
	} catch (e) {
		setError(e?.message || String(e))
	}
})

document.getElementById('btn-signout')?.addEventListener('click', () => {
	signOut()
})

elTabMe?.addEventListener('click', () => {
	if (!session) return
	activateTab('me')
	history.pushState({ loggedIn: true, tab: 'me' }, '', '/me')
})

elTabDb?.addEventListener('click', () => {
	if (!session) return
	activateTab('db')
	history.pushState({ loggedIn: true, tab: 'db' }, '', '/db')
})

syncPathToView()
