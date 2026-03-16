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
let signinKeyHandler = null

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
 * Set loading state on sign-in buttons. Disables all buttons and shows spinner on primary.
 * Call with true immediately on click; false restores (or re-render replaces DOM).
 * @param {boolean} loading
 */
export function setSignInLoading(loading) {
	const container = document.querySelector('.sign-in-container')
	if (!container) return
	const buttonsWrap = container.querySelector('.sign-in-buttons')
	if (!buttonsWrap) return
	const buttons = buttonsWrap.querySelectorAll('.btn')
	const primaryBtn = buttonsWrap.querySelector('.btn-solid-water')
	if (loading) {
		buttons.forEach((btn) => {
			btn.disabled = true
			btn.classList.add('loading')
		})
		if (primaryBtn && !primaryBtn.dataset.originalText) {
			primaryBtn.dataset.originalText = primaryBtn.innerHTML
			primaryBtn.innerHTML = `
				<span class="btn-spinner" aria-hidden="true"></span>
				<span>Authenticating…</span>
			`
		}
		container.classList.add('fading')
	} else {
		buttons.forEach((btn) => {
			btn.disabled = false
			btn.classList.remove('loading')
		})
		if (primaryBtn?.dataset.originalText) {
			primaryBtn.innerHTML = primaryBtn.dataset.originalText
			delete primaryBtn.dataset.originalText
		}
		container.classList.remove('fading')
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
 * @param {boolean} [showTestAven] - Show "Sign in with Test AVEN" (local dev only, no passkeys)
 */
export function renderSignInPrompt(hasExistingAccount, viewMode, showTestAven = false) {
	const hasAccount = hasExistingAccount()
	const mode = viewMode ?? (hasAccount ? 'signin' : 'signup')

	// State 1: Signup – name input + Create button, link to switch to signin
	// State 2: Signin – big Unlock button only, link to switch to signup

	const isSignupMode = mode === 'signup'
	const testAvenNameRaw =
		(typeof import.meta !== 'undefined' && import.meta.env?.VITE_AVEN_TEST_NAME) ||
		window.__MAIA_DEV_ENV__?.VITE_AVEN_TEST_NAME ||
		'Test'
	const testAvenName = testAvenNameRaw.startsWith('Aven ')
		? testAvenNameRaw
		: `Aven ${testAvenNameRaw}`
	const testAvenButton = showTestAven
		? `
						<button class="btn btn-outline" onclick="window.handleSignInWithTestAven()" style="margin-top: 0.5rem;">
							Sign in with ${testAvenName}
						</button>
					`
		: ''

	document.getElementById('app').innerHTML = `
		<div class="sign-in-container">
			<div class="sign-in-content liquid-glass">
				<div class="liquid-glass--bend"></div>
				<div class="liquid-glass--face"></div>
				<div class="liquid-glass--edge"></div>
				<div class="sign-in-inner liquid-glass-inner">
					<div class="logo-container">
						<img src="/brand/logo.svg" alt="Maia City" class="sign-in-logo" />
					</div>
					<h1>
						<span>is where we are</span>
						<span class="h1-main-text">
							humans
						</span>
					</h1>
					<p class="sign-in-subtitle">who outgrow ourselves everyday creating the extraordinary</p>
					${
						isSignupMode
							? `
						<div class="sign-in-first-name-wrap">
							<label for="signin-first-name" class="sign-in-first-name-label">First name</label>
							<input
								type="text"
								id="signin-first-name"
								class="sign-in-first-name-input"
								placeholder="What shall we call you?"
								autocomplete="given-name"
								maxlength="50"
								aria-label="First name"
							/>
						</div>
						<div class="sign-in-buttons">
							<button class="btn btn-solid-water" onclick="window.handleRegister()">
								Create new Self
							</button>
							${testAvenButton}
							<a href="#" class="sign-in-swap-link" onclick="window.switchToSigninView(); return false;">&mdash; signin instead &mdash;</a>
						</div>
					`
							: `
						<div class="sign-in-buttons">
							<button class="btn btn-solid-water" onclick="window.handleSignIn()">
								Unlock your Self
							</button>
							${testAvenButton}
							<a href="#" class="sign-in-swap-link" onclick="window.switchToSignupView(); return false;">&mdash; register new &mdash;</a>
						</div>
					`
					}
				</div>
			</div>
		</div>
	`

	// Enter key: Create (signup) or Unlock (signin)
	if (signinKeyHandler) document.removeEventListener('keydown', signinKeyHandler)
	signinKeyHandler = (e) => {
		if (e.key !== 'Enter' || e.repeat) return
		if (!document.querySelector('.sign-in-container')) return // Not on signin screen
		if (isSignupMode) {
			window.handleRegister()
		} else {
			window.handleSignIn()
		}
	}
	document.addEventListener('keydown', signinKeyHandler)

	// Focus name input when in signup mode
	if (isSignupMode) {
		requestAnimationFrame(() => document.getElementById('signin-first-name')?.focus())
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
