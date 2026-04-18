/**
 * Sign-In/Sign-Up Rendering
 * Handles authentication UI rendering
 *
 * Two states:
 * - State 1 (signup): New user – name input + Create button, link "> -- signin --" swaps to State 2
 * - State 2 (signin): Existing user – big Unlock button, link "-- register new --" swaps to State 1
 * Only signup writes/overwrites the profile name; sign-in never touches it.
 *
 * Enter key: Create new Self (signup) or Unlock (signin)
 */
import { accountLoadingSpinnerHtml } from './account-loading-spinner-html.js'

let signinKeyHandler = null

/**
 * Show or hide loading overlay on sign-in screen.
 * @param {boolean} loading - true to show spinner overlay, false to hide
 */
export function setSignInLoading(loading) {
	const container = document.querySelector('.sign-in-container')
	if (!container) return
	let overlay = container.querySelector('.sign-in-loading-overlay')
	if (loading) {
		if (!overlay) {
			overlay = document.createElement('div')
			overlay.className = 'sign-in-loading-overlay'
			overlay.innerHTML = `
				<div class="loading-connecting-overlay">
					${accountLoadingSpinnerHtml}
					<div class="loading-connecting-content">
						<div class="loading-connecting-subtitle">Authenticating…</div>
					</div>
				</div>
			`
			container.appendChild(overlay)
		}
		overlay.style.display = ''
	} else if (overlay) {
		overlay.style.display = 'none'
	}
}

/**
 * Remove Enter key listener (call when navigating away from signin screen)
 */
export function removeSigninKeyHandler() {
	if (signinKeyHandler) {
		document.removeEventListener('keydown', signinKeyHandler)
		signinKeyHandler = null
	}
}

/**
 * Get first name from signup input (for "Create new Self" flow).
 * Returns trimmed value or undefined if empty.
 * @returns {string|undefined}
 */
export function getFirstNameForRegister() {
	const input = document.getElementById('signin-first-name')
	if (!input) return undefined
	const val = (input.value || '').trim()
	return val.length > 0 ? val : undefined
}

/**
 * @param {() => boolean} hasExistingAccount
 * @param {'signup' | 'signin'} [viewMode] - Override; default: hasAccount ? 'signin' : 'signup'
 * @param {boolean} [showSecretKeyDevSignIn] - Show secret-key dev button (local only, `VITE_AVEN_TEST_MODE`; human operator, not server agent)
 * @param {{ register: () => void, signIn: () => void, signInWithSecretKeyDev: () => void, switchToSignin: () => void, switchToSignup: () => void }} [handlers] - Required for CSP-safe UI (no inline handlers)
 */
export function renderSignInPrompt(
	hasExistingAccount,
	viewMode,
	showSecretKeyDevSignIn = false,
	handlers = null,
	passkeysUnavailable = false,
) {
	const hasAccount = hasExistingAccount()
	const mode = viewMode ?? (hasAccount ? 'signin' : 'signup')

	// State 1: Signup – name input + Create button, link to switch to signin
	// State 2: Signin – big Unlock button only, link to switch to signup

	const isSignupMode = mode === 'signup'
	const secretKeyDevNameRaw =
		(typeof window !== 'undefined' && window.__MAIA_DEV_ENV__?.VITE_AVEN_TEST_NAME) ||
		(typeof import.meta !== 'undefined' && import.meta.env?.VITE_AVEN_TEST_NAME) ||
		'Test'
	const secretKeyDevLabel =
		secretKeyDevNameRaw.startsWith('Aven ') || /\s/.test(secretKeyDevNameRaw)
			? secretKeyDevNameRaw
			: `Aven ${secretKeyDevNameRaw}`
	const secretKeyDevButton = showSecretKeyDevSignIn
		? `
						<button type="button" class="btn btn-outline-marine sign-in-secretkey-dev" data-maia-action="signInWithSecretKeyDev" style="margin-top: 0.5rem;">
							Secret key (dev) · ${secretKeyDevLabel}
						</button>
					`
		: ''
	const passkeyDisabled = passkeysUnavailable
		? ' disabled title="Passkeys not available in this browser"'
		: ''
	const prfNotice = passkeysUnavailable
		? `<p class="sign-in-prf-notice">Passkeys are not available in this browser. Use Chrome or Safari for passkey sign-in.</p>`
		: ''

	document.getElementById('app').innerHTML = `
		<div class="sign-in-container">
			<div class="sign-in-split">
				<div class="sign-in-panel">
					<div class="sign-in-panel-inner">
						<div class="sign-in-brand-row">
							<img src="/brand/logo_dark.svg" alt="Maia City" class="sign-in-logo" />
						</div>
						${
							isSignupMode
								? `
							<h1 class="sign-in-panel-heading">Create your Self</h1>
							<p class="sign-in-panel-lede">Passkeys only — pick a name, then register. No password to remember.</p>
							${prfNotice}
							<div class="sign-in-first-name-wrap">
								<input
									type="text"
									id="signin-first-name"
									class="sign-in-first-name-input"
									placeholder="First name"
									autocomplete="given-name"
									maxlength="50"
									aria-label="First name"
								/>
							</div>
							<div class="sign-in-buttons">
								<button type="button" class="btn btn-solid-water" data-maia-action="register"${passkeyDisabled}>
									Create new Self
								</button>
								${secretKeyDevButton}
								<a href="#" class="sign-in-swap-link" data-maia-action="switchToSignin">Already have a Self? Sign in</a>
							</div>
						`
								: `
							<h1 class="sign-in-panel-heading sign-in-panel-heading--poetic">
								<span class="sign-in-line-eyebrow">is where we are</span>
								<span class="sign-in-line-hero">humans</span>
							</h1>
							<p class="sign-in-panel-lede">who outgrow ourselves everyday creating the extraordinary</p>
							${prfNotice}
							<div class="sign-in-buttons">
								<button type="button" class="btn btn-solid-water" data-maia-action="signIn"${passkeyDisabled}>
									Unlock your Self
								</button>
								${secretKeyDevButton}
								<a href="#" class="sign-in-swap-link" data-maia-action="switchToSignup">New here? Create your Self</a>
							</div>
						`
						}
					</div>
				</div>
				<div class="sign-in-visual" aria-hidden="true">
					<div class="sign-in-visual-scrim"></div>
				</div>
			</div>
		</div>
	`

	// Enter key: Create (signup) or Unlock (signin)
	if (signinKeyHandler) document.removeEventListener('keydown', signinKeyHandler)
	signinKeyHandler = (e) => {
		if (e.key !== 'Enter' || e.repeat) return
		if (!document.querySelector('.sign-in-container')) return // Not on signin screen
		const h = handlers
		if (!h) return
		if (isSignupMode) {
			h.register()
		} else {
			h.signIn()
		}
	}
	document.addEventListener('keydown', signinKeyHandler)

	// Focus name input when in signup mode (double rAF avoids forced reflow: first frame paints, second focuses)
	if (isSignupMode) {
		const input = document.getElementById('signin-first-name')
		const pre = sessionStorage.getItem('maia_intro_first_name')
		if (pre != null && pre !== '' && input) {
			input.value = pre
			sessionStorage.removeItem('maia_intro_first_name')
		}
		requestAnimationFrame(() => {
			requestAnimationFrame(() => input?.focus())
		})
	}
}

export function renderUnsupportedBrowser(message) {
	document.getElementById('app').innerHTML = `
		<div class="unsupported-browser">
			<div class="unsupported-content">
				<h1>⚠️ Browser Not Supported</h1>
				<p class="unsupported-message">${message}</p>
				<div class="unsupported-requirements">
					<h3>Please use:</h3>
					<ul>
						<li>✅ Chrome on macOS, Linux, or Windows 11</li>
						<li>✅ Safari on macOS 13+ or iOS 16+</li>
					</ul>
					<h3>Not supported:</h3>
					<ul>
						<li>❌ Firefox (all platforms)</li>
						<li>❌ Windows 10 (any browser)</li>
						<li>❌ Older browsers</li>
					</ul>
				</div>
			</div>
		</div>
	`
}
