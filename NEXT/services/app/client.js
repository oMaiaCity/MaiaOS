/**
 * In-memory session only. Full page reload clears auth.
 * /me is client-side (pushState) so navigation does not lose the in-memory session.
 */
import { signIn, signUp } from '@maiacity/self'

/** @type {{ accountID: string, credentialId?: string } | null} */
let session = null

const elWelcome = document.getElementById('view-welcome')
const elMe = document.getElementById('view-me')
const elAccountId = document.getElementById('account-id')
const elCredentialId = document.getElementById('credential-id')
const elErr = document.getElementById('auth-error')

function setError(msg) {
	if (!elErr) return
	elErr.textContent = msg || ''
	elErr.hidden = !msg
}

function showWelcome() {
	session = null
	if (elWelcome) elWelcome.hidden = false
	if (elMe) elMe.hidden = true
	setError('')
}

function showMe(data) {
	session = data
	if (elWelcome) elWelcome.hidden = true
	if (elMe) elMe.hidden = false
	if (elAccountId) elAccountId.textContent = data.accountID
	if (elCredentialId) elCredentialId.textContent = data.credentialId ?? '—'
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
		if (elWelcome) elWelcome.hidden = true
		if (elMe) elMe.hidden = false
		if (elAccountId && session) elAccountId.textContent = session.accountID
		if (elCredentialId && session) elCredentialId.textContent = session.credentialId ?? '—'
	} else {
		showWelcome()
	}
}

window.addEventListener('popstate', syncPathToView)

document.getElementById('btn-signup')?.addEventListener('click', async () => {
	setError('')
	try {
		const { accountID, credentialId } = await signUp({ name: 'Traveler', salt: 'maia.city' })
		showMe({ accountID, credentialId })
	} catch (e) {
		setError(e?.message || String(e))
	}
})

document.getElementById('btn-signin')?.addEventListener('click', async () => {
	setError('')
	try {
		const { accountID } = await signIn({ salt: 'maia.city' })
		showMe({ accountID })
	} catch (e) {
		setError(e?.message || String(e))
	}
})

document.getElementById('btn-signout')?.addEventListener('click', () => {
	signOut()
})

syncPathToView()
