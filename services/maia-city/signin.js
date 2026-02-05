/**
 * Sign-In/Sign-Up Rendering
 * Handles authentication UI rendering
 */

export function renderSignInPrompt(hasExistingAccount) {
	const hasAccount = hasExistingAccount();
	
	// Rendering sign-in prompt
	
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
						<span>is where you become</span>
						<span class="h1-main-text">
							the human
						</span>
					</h1>
					<p class="sign-in-subtitle">you were always meant to be</p>
					${!hasAccount ? `
						<p class="sign-in-description">
							Create your new sovereign self now.
						</p>
					` : ''}
					<div class="sign-in-buttons">
						${hasAccount ? `
							<button class="btn btn-solid-water" onclick="window.handleSignIn()">
								Unlock your Self
							</button>
							<button class="btn btn-glass" onclick="window.handleRegister()">
								Create new Self
							</button>
						` : `
							<button class="btn btn-solid-water" onclick="window.handleRegister()">
								Create new Self
							</button>
							<button class="btn btn-glass" onclick="window.handleSignIn()">
								Unlock your Self
							</button>
						`}
					</div>
				</div>
			</div>
		</div>
	`;
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
