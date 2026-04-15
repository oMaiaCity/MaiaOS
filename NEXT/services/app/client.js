/**
 * In-memory session only. Full page reload clears auth.
 * `/profile` and `/db` are client-side (pushState) so navigation does not lose the in-memory session.
 */
import { signIn, signUp } from '../../libs/self/src/index.js'

/** @type {{ accountID: string, credentialId?: string, profileName?: string, node?: import('cojson').LocalNode, account?: import('cojson').RawAccount } | null} */
let session = null

const elWelcome = document.getElementById('view-welcome')
const elLoggedIn = document.getElementById('view-logged-in')
const elPanelProfile = document.getElementById('panel-profile')
const elPanelDb = document.getElementById('panel-db')
const elNavProfile = document.getElementById('nav-profile')
const elNavDb = document.getElementById('nav-db')
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

/**
 * Same contract as MaiaDB: never call getCurrentContent until the core is available/verified.
 * @param {{ getCurrentContent?: () => unknown, isAvailable?: () => boolean } | null | undefined} core
 */
function getCurrentContentSafe(core) {
	if (!core) return undefined
	if (typeof core.isAvailable === 'function' && !core.isAvailable()) {
		return undefined
	}
	try {
		return core.getCurrentContent?.()
	} catch {
		return undefined
	}
}

function readProfileName(node, account) {
	if (!node || !account || typeof account.get !== 'function') return '—'
	const pid = account.get('profile')
	if (!pid || typeof pid !== 'string') return '—'
	const core = node.getCoValue(pid)
	const content = getCurrentContentSafe(core)
	if (!content || typeof content.get !== 'function') return '—'
	const n = content.get('name')
	return typeof n === 'string' && n.length > 0 ? n : '—'
}

/**
 * CoValue fields are not always JSON-serializable; only keep plain data for display.
 * @param {unknown} v
 */
function jsonableField(v) {
	if (v === null || v === undefined) return null
	const t = typeof v
	if (t === 'string' || t === 'number' || t === 'boolean') return v
	if (t === 'bigint') return v.toString()
	return String(v)
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
		accountId: jsonableField(account.id),
		accountKeys:
			typeof account.keys === 'function' ? [...account.keys()].map((k) => jsonableField(k)) : [],
		profileRef: jsonableField(account.get('profile')),
		rootRef: jsonableField(account.get('root')),
	}
	const pid = account.get('profile')
	if (typeof pid === 'string' && pid.length > 0) {
		const core = node.getCoValue(pid)
		const content = getCurrentContentSafe(core)
		if (content && typeof content.get === 'function') {
			out.profileCoMap = {
				name: jsonableField(content.get('name')),
				avatar: jsonableField(content.get('avatar')),
			}
		} else if (core) {
			out.profileCoMap = {
				status: 'pending',
				coId: pid,
				note: 'CoValue not verified yet — run the snapshot again after a short delay',
			}
		}
	}
	const rid = account.get('root')
	if (typeof rid === 'string' && rid.length > 0) {
		const core = node.getCoValue(rid)
		const content = getCurrentContentSafe(core)
		if (content) {
			let keys = []
			if (typeof content.keys === 'function') {
				keys = [...content.keys()].map((k) => jsonableField(k))
			} else if (typeof content.entries === 'function') {
				keys = [...content.entries()].map(([k]) => jsonableField(k))
			}
			out.rootCoMap = { keys }
		} else if (core) {
			out.rootCoMap = {
				status: 'pending',
				coId: rid,
				note: 'CoValue not verified yet — run the snapshot again after a short delay',
			}
		}
	}
	return out
}

function stringifySnapshot(snap) {
	try {
		return JSON.stringify(
			snap,
			(_, v) => {
				if (typeof v === 'bigint') return v.toString()
				return v
			},
			2,
		)
	} catch (e) {
		return JSON.stringify(
			{ error: 'Snapshot serialization failed', detail: String(e?.message ?? e) },
			null,
			2,
		)
	}
}

function renderDbSnapshot() {
	if (!elDbSnapshot) return
	let snap
	try {
		snap = session ? buildDbSnapshot(session.node, session.account) : { error: 'No active session.' }
	} catch (e) {
		snap = { error: 'buildDbSnapshot failed', detail: String(e?.message ?? e) }
	}
	elDbSnapshot.textContent = stringifySnapshot(snap)
}

function setProfileFields(data) {
	if (elAccountId) elAccountId.textContent = data.accountID
	if (elCredentialId) elCredentialId.textContent = data.credentialId ?? '—'
	if (elProfileName) {
		const name =
			data.profileName ?? (data.node && data.account ? readProfileName(data.node, data.account) : '—')
		elProfileName.textContent = name
	}
}

/**
 * @param {'profile' | 'db'} panel
 */
function activatePanel(panel) {
	const isProfile = panel === 'profile'
	if (elPanelProfile) {
		elPanelProfile.hidden = !isProfile
		elPanelProfile.setAttribute('aria-hidden', isProfile ? 'false' : 'true')
	}
	if (elPanelDb) {
		elPanelDb.hidden = isProfile
		elPanelDb.setAttribute('aria-hidden', isProfile ? 'true' : 'false')
	}
	if (elNavProfile) {
		elNavProfile.classList.toggle('active', isProfile)
		elNavProfile.setAttribute('aria-selected', isProfile ? 'true' : 'false')
	}
	if (elNavDb) {
		elNavDb.classList.toggle('active', !isProfile)
		elNavDb.setAttribute('aria-selected', !isProfile ? 'true' : 'false')
	}
	if (!isProfile) {
		requestAnimationFrame(() => {
			renderDbSnapshot()
			setTimeout(() => {
				renderDbSnapshot()
			}, 400)
		})
	}
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
	setProfileFields(data)
	renderDbSnapshot()
}

function openAfterAuth(data) {
	showLoggedInView(data)
	activatePanel('profile')
	setError('')
	history.pushState({ loggedIn: true, panel: 'profile' }, '', '/profile')
}

function signOut() {
	showWelcome()
	history.pushState({}, '', '/')
}

function isLoggedInPath(path) {
	return path === '/profile' || path === '/db' || path === '/me'
}

function syncPathToView() {
	const path = window.location.pathname
	if (!isLoggedInPath(path)) {
		showWelcome()
		return
	}
	if (!session) {
		history.replaceState({}, '', '/')
		showWelcome()
		return
	}
	let effectivePath = path
	if (path === '/me') {
		effectivePath = '/profile'
		history.replaceState(history.state, '', '/profile')
	}
	if (elWelcome) elWelcome.style.display = 'none'
	if (elLoggedIn) elLoggedIn.style.display = 'flex'
	setProfileFields(session)
	if (effectivePath === '/db') {
		activatePanel('db')
	} else {
		activatePanel('profile')
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
		openAfterAuth({
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
		openAfterAuth({
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

elNavProfile?.addEventListener('click', () => {
	if (!session) return
	activatePanel('profile')
	history.pushState({ loggedIn: true, panel: 'profile' }, '', '/profile')
})

elNavDb?.addEventListener('click', () => {
	if (!session) return
	activatePanel('db')
	history.pushState({ loggedIn: true, panel: 'db' }, '', '/db')
})

syncPathToView()
