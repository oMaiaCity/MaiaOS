/**
 * In-memory session only. Full page reload clears auth.
 * /me is client-side (pushState) so navigation does not lose the in-memory session.
 */
import { signIn, signUp } from '../../libs/self/src/index.js'

/** @type {{ accountID: string, credentialId?: string, profileName?: string, node?: import('cojson').LocalNode, account?: import('cojson').RawAccount } | null} */
let session = null

const elWelcome = document.getElementById('view-welcome')
const elMe = document.getElementById('view-me')
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

function setMeFields(data) {
	if (elAccountId) elAccountId.textContent = data.accountID
	if (elCredentialId) elCredentialId.textContent = data.credentialId ?? '—'
	if (elProfileName) {
		const name =
			data.profileName ?? (data.node && data.account ? readProfileName(data.node, data.account) : '—')
		elProfileName.textContent = name
	}
}

function showWelcome() {
	session = null
	if (elWelcome) elWelcome.style.display = 'flex'
	if (elMe) elMe.style.display = 'none'
	setError('')
}

function showMe(data) {
	session = data
	if (elWelcome) elWelcome.style.display = 'none'
	if (elMe) elMe.style.display = 'flex'
	setMeFields(data)
	setError('')
	history.pushState({ me: true }, '', '/me')
}

function signOut() {
	showWelcome()
	history.pushState({}, '', '/')
}

function syncPathToView() {
	const path = window.location.pathname
	if (path === '/me') {
		if (!session) {
			history.replaceState({}, '', '/')
			showWelcome()
			return
		}
		if (elWelcome) elWelcome.style.display = 'none'
		if (elMe) elMe.style.display = 'flex'
		if (session) setMeFields(session)
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

syncPathToView()
