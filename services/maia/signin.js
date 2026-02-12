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
let signinKeyHandler = null;

/**
 * Remove Enter key listener (call when navigating away from signin screen)
 */
export function removeSigninKeyHandler() {
	if (signinKeyHandler) {
		document.removeEventListener('keydown', signinKeyHandler);
		signinKeyHandler = null;
	}
}

/**
 * Get first name from signup input (for "Create new Self" flow).
 * Returns trimmed value or undefined if empty.
 * @returns {string|undefined}
 */
export function getFirstNameForRegister() {
	const input = document.getElementById('signin-first-name');
	if (!input) return undefined;
	const val = (input.value || '').trim();
	return val.length > 0 ? val : undefined;
}

/**
 * @param {() => boolean} hasExistingAccount
 * @param {'signup' | 'signin'} [viewMode] - Override; default: hasAccount ? 'signin' : 'signup'
 */
export function renderSignInPrompt(hasExistingAccount, viewMode) {
	const hasAccount = hasExistingAccount();
	const mode = viewMode ?? (hasAccount ? 'signin' : 'signup');

	// State 1: Signup – name input + Create button, link to switch to signin
	// State 2: Signin – big Unlock button only, link to switch to signup

	const isSignupMode = mode === 'signup';

	document.getElementById("app").innerHTML = `
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
					${isSignupMode ? `
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
							<a href="#" class="sign-in-swap-link" onclick="window.switchToSigninView(); return false;">&mdash; signin instead &mdash;</a>
						</div>
					` : `
						<div class="sign-in-buttons">
							<button class="btn btn-solid-water" onclick="window.handleSignIn()">
								Unlock your Self
							</button>
							<a href="#" class="sign-in-swap-link" onclick="window.switchToSignupView(); return false;">&mdash; register new &mdash;</a>
						</div>
					`}
				</div>
			</div>
		</div>
	`;

	// Enter key: Create (signup) or Unlock (signin)
	if (signinKeyHandler) document.removeEventListener('keydown', signinKeyHandler);
	signinKeyHandler = (e) => {
		if (e.key !== 'Enter' || e.repeat) return;
		if (!document.querySelector('.sign-in-container')) return; // Not on signin screen
		if (isSignupMode) {
			window.handleRegister();
		} else {
			window.handleSignIn();
		}
	};
	document.addEventListener('keydown', signinKeyHandler);

	// Focus name input when in signup mode
	if (isSignupMode) {
		requestAnimationFrame(() => document.getElementById('signin-first-name')?.focus());
	}
}

export function renderUnsupportedBrowser(message) {
	document.getElementById("app").innerHTML = `
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
	`;
}
