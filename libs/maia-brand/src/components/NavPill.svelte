<script>
/**
 * NavPill - Global navigation pill component
 * Layout: Logo/Avatar (left) | Call Button (center) | User (right)
 * When logged out: Shows Google sign-in button
 *
 * @typedef {Object} Props
 * @property {Function} onHome - Home button click handler
 * @property {Function} onSignOut - Sign out handler (optional)
 * @property {Function} onGoogleSignIn - Google sign-in handler
 * @property {boolean} isAuthenticated - Whether user is authenticated
 * @property {boolean} signingOut - Whether sign out is in progress
 * @property {Object} user - User object with name and image
 * @property {boolean} isCallActive - Whether voice call is active
 * @property {boolean} isConnecting - Whether call is connecting
 * @property {boolean} isWaitingForPermission - Whether waiting for permission
 * @property {Function} onStartCall - Start call handler
 * @property {Function} onStopCall - Stop call handler
 * @property {string|null} vibeAvatar - Optional vibe avatar image path (shows instead of logo when in vibe context)
 */

const {
	onHome,
	onSignOut,
	onGoogleSignIn,
	isAuthenticated = false,
	signingOut = false,
	user = null,
	isCallActive = false,
	isConnecting = false,
	isWaitingForPermission = false,
	aiState = 'idle', // 'listening' | 'thinking' | 'speaking' | 'idle'
	onStartCall,
	onStopCall,
	pillState = 'default', // 'default' | 'cta' | 'hidden'
	ctaText = 'Sign up to waitlist now',
	ctaHref = null,
	showLoginButton = true, // Show login icon button in CTA state
	showCapabilityModal = false,
	showSuccessModal = false,
	onRequestAccess = () => {},
	onCloseCapabilityModal = () => {},
	onCloseSuccessModal = () => {},
	vibeAvatar = null, // Vibe avatar image path (e.g., "/brand/agents/charles.png")
	capabilityModalTitle = 'Access required',
	capabilityModalMessage = 'You need permission to use the voice assistant',
} = $props()

const _userImageFailed = $state(false)

// Helper to get wallet service URL (with optional path)
function _getWalletUrl(path = '') {
	if (typeof window === 'undefined') return '/'

	const isProduction =
		window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1')
	let walletDomain = 'localhost:4201' // Default for dev

	if (isProduction) {
		const hostname = window.location.hostname
		if (hostname.startsWith('app.')) {
			walletDomain = hostname.replace('app.', 'wallet.')
		} else if (hostname.startsWith('website.')) {
			walletDomain = hostname.replace('website.', 'wallet.')
		} else {
			walletDomain = `wallet.${hostname.replace(/^www\./, '')}`
		}
	}

	const protocol =
		walletDomain.startsWith('localhost') || walletDomain.startsWith('127.0.0.1') ? 'http' : 'https'
	return `${protocol}://${walletDomain}${path}`
}

// Helper to get app service URL
function _getAppUrl() {
	if (typeof window === 'undefined') return '/'

	const isProduction =
		window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1')

	if (isProduction) {
		const hostname = window.location.hostname

		// If already on app domain (even if doubled like app.app.hominio.me), return relative path
		// This prevents doubling the domain when clicking the logo
		if (hostname.includes('.app.') || hostname.startsWith('app.')) {
			return '/'
		}

		// If on wallet or website, redirect to app
		if (hostname.startsWith('wallet.')) {
			const rootDomain = hostname.replace('wallet.', '')
			// Ensure we don't double the app prefix
			if (rootDomain.startsWith('app.')) {
				return `https://${rootDomain}`
			}
			return `https://app.${rootDomain}`
		} else if (hostname.startsWith('website.')) {
			const rootDomain = hostname.replace('website.', '')
			// Ensure we don't double the app prefix
			if (rootDomain.startsWith('app.')) {
				return `https://${rootDomain}`
			}
			return `https://app.${rootDomain}`
		} else {
			// Extract root domain (remove www. if present)
			const rootDomain = hostname.replace(/^www\./, '')
			// Only add app. prefix if not already present (check for app. anywhere)
			if (!rootDomain.includes('.app.') && !rootDomain.startsWith('app.')) {
				return `https://app.${rootDomain}`
			}
			return '/'
		}
	}

	// Development: return relative path
	return '/'
}
</script>

{#if pillState === 'hidden'}
	<!-- Hidden state - render nothing -->
{:else if pillState === 'cta'}
	<!-- CTA State: Show modals if authenticated, then show CTA buttons -->
	{#if isAuthenticated}
		<!-- Success Modal (shown after access request is submitted) -->
		{#if showSuccessModal}
			<div class="connection-modal modal-success">
				<div class="connection-content">
					<div class="connection-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
							<path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
						</svg>
					</div>
					<div class="connection-text-group">
						<p class="connection-text">Access request submitted</p>
						<p class="connection-subtext">The admin will review your request</p>
					</div>
				</div>
			</div>
		{/if}
		
		<!-- Capability Modal (shown when user doesn't have voice capability) -->
		{#if showCapabilityModal}
			<div class="connection-modal modal-capability">
				<div class="connection-content">
					<div class="connection-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12,1L8,5H11V14H13V5H16M18,23H6C4.89,23 4,22.1 4,21V9A2,2 0 0,1 6,7H9V9H6V21H18V9H15V7H18A2,2 0 0,1 20,9V21A2,2 0 0,1 18,23Z" />
						</svg>
					</div>
					<div class="connection-text-group">
						<p class="connection-text">{capabilityModalTitle}</p>
						<p class="connection-subtext">{capabilityModalMessage}</p>
					</div>
					<div class="request-access-container">
						<button onclick={onRequestAccess} class="request-access-btn">
							Request access
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Connection State Modal (shown when call is active) -->
		{#if isCallActive || isConnecting || isWaitingForPermission}
			<div class="connection-modal" class:modal-waiting={isWaitingForPermission} class:modal-connecting={isConnecting} class:modal-listening={isCallActive && aiState === 'listening'} class:modal-thinking={isCallActive && aiState === 'thinking'} class:modal-speaking={isCallActive && aiState === 'speaking'}>
				<div class="connection-content">
					{#if isWaitingForPermission}
						<div class="connection-icon">
							<svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round"/>
							</svg>
						</div>
						<p class="connection-text">Waiting for permission...</p>
					{:else if isConnecting}
						<p class="connection-text">Connecting...</p>
					{:else if isCallActive}
						{#if aiState === 'thinking'}
							<div class="connection-icon pulse">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M7.5,8A1.5,1.5 0 0,1 9,9.5A1.5,1.5 0 0,1 7.5,11A1.5,1.5 0 0,1 6,9.5A1.5,1.5 0 0,1 7.5,8M12,8A1.5,1.5 0 0,1 13.5,9.5A1.5,1.5 0 0,1 12,11A1.5,1.5 0 0,1 10.5,9.5A1.5,1.5 0 0,1 12,8M16.5,8A1.5,1.5 0 0,1 18,9.5A1.5,1.5 0 0,1 16.5,11A1.5,1.5 0 0,1 15,9.5A1.5,1.5 0 0,1 16.5,8Z" />
								</svg>
							</div>
							<p class="connection-text">Thinking...</p>
						{:else if aiState === 'speaking'}
							<div class="connection-icon pulse">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
									<path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
								</svg>
							</div>
							<p class="connection-text">Speaking...</p>
						{:else}
							<div class="connection-icon pulse">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z" />
								</svg>
							</div>
							<p class="connection-text">Listening...</p>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	{/if}
	
	<!-- CTA State: Two separate buttons - Sign up and Login (no wrapper) -->
	<div class="cta-buttons-container">
		<a href={ctaHref || getWalletUrl()} class="cta-btn">
			<span>{ctaText}</span>
		</a>
		{#if showLoginButton}
		<a href={getWalletUrl('/')} class="cta-login-btn" aria-label="Sign in">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
				<polyline points="10 17 15 12 10 7"/>
				<line x1="15" y1="12" x2="3" y2="12"/>
			</svg>
		</a>
		{/if}
	</div>
{:else if isAuthenticated}
	<!-- Success Modal (shown after access request is submitted) -->
	{#if showSuccessModal}
		<div class="connection-modal modal-success">
			<div class="connection-content">
				<div class="connection-icon">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
					</svg>
				</div>
				<div class="connection-text-group">
					<p class="connection-text">Access request submitted</p>
					<p class="connection-subtext">The admin will review your request</p>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- Capability Modal (shown when user doesn't have voice capability) -->
	{#if showCapabilityModal}
		<div class="connection-modal modal-capability">
			<div class="connection-content">
				<div class="connection-icon">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12,1L8,5H11V14H13V5H16M18,23H6C4.89,23 4,22.1 4,21V9A2,2 0 0,1 6,7H9V9H6V21H18V9H15V7H18A2,2 0 0,1 20,9V21A2,2 0 0,1 18,23Z" />
					</svg>
				</div>
				<div class="connection-text-group">
					<p class="connection-text">Access required</p>
					<p class="connection-subtext">You need permission to use the voice assistant</p>
				</div>
				<div class="request-access-container">
					<button onclick={onRequestAccess} class="request-access-btn">
						Request access
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Connection State Modal (shown when call is active) -->
	{#if isCallActive || isConnecting || isWaitingForPermission}
		<div class="connection-modal" class:modal-waiting={isWaitingForPermission} class:modal-connecting={isConnecting} class:modal-listening={isCallActive && aiState === 'listening'} class:modal-thinking={isCallActive && aiState === 'thinking'} class:modal-speaking={isCallActive && aiState === 'speaking'}>
			<div class="connection-content">
				{#if isWaitingForPermission}
					<div class="connection-icon">
						<svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round"/>
						</svg>
					</div>
					<p class="connection-text">Waiting for permission...</p>
				{:else if isConnecting}
					<div class="connection-icon">
						<svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round"/>
						</svg>
					</div>
					<p class="connection-text">Connecting...</p>
				{:else if isCallActive}
					{#if aiState === 'thinking'}
						<div class="connection-icon pulse">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M7.5,8A1.5,1.5 0 0,1 9,9.5A1.5,1.5 0 0,1 7.5,11A1.5,1.5 0 0,1 6,9.5A1.5,1.5 0 0,1 7.5,8M12,8A1.5,1.5 0 0,1 13.5,9.5A1.5,1.5 0 0,1 12,11A1.5,1.5 0 0,1 10.5,9.5A1.5,1.5 0 0,1 12,8M16.5,8A1.5,1.5 0 0,1 18,9.5A1.5,1.5 0 0,1 16.5,11A1.5,1.5 0 0,1 15,9.5A1.5,1.5 0 0,1 16.5,8Z" />
							</svg>
						</div>
						<p class="connection-text">Thinking...</p>
					{:else if aiState === 'speaking'}
						<div class="connection-icon pulse">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
								<path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
							</svg>
						</div>
						<p class="connection-text">Speaking...</p>
					{:else}
						<div class="connection-icon pulse">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z" />
							</svg>
						</div>
						<p class="connection-text">Listening...</p>
					{/if}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Authenticated: Logo/Avatar | Call Button | User -->
	<nav class="nav-pill">
		<div class="nav-container">
			<!-- Left: Logo or Agent Avatar (no link) -->
			<div class="nav-logo-link" aria-label="App logo">
				{#if vibeAvatar}
					<!-- Show vibe avatar when in vibe context -->
					<img src={vibeAvatar} alt="Vibe" class="nav-logo nav-vibe-avatar" />
				{:else}
					<!-- Show default logo when not in vibe context -->
					<img src="/brand/MaiaCity.svg" alt="Home" class="nav-logo" />
				{/if}
			</div>
			
			<!-- Center: Call Button -->
			<div class="nav-center">
				{#if isCallActive || showCapabilityModal || showSuccessModal}
					<button
						onclick={showCapabilityModal ? onCloseCapabilityModal : showSuccessModal ? onCloseSuccessModal : onStopCall}
						class="call-btn call-btn-active"
						aria-label={showCapabilityModal ? "Close" : showSuccessModal ? "Close" : "Stop call"}
						disabled={isConnecting}
					>
						{#if isConnecting}
							<svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round"/>
							</svg>
						{:else}
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
								<path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
							</svg>
						{/if}
					</button>
				{:else}
					<button
						onclick={onStartCall}
						class="call-btn call-btn-inactive"
						aria-label={isWaitingForPermission ? "Waiting for permission" : isConnecting ? "Connecting" : "Start call"}
						disabled={isConnecting || isWaitingForPermission}
					>
						{#if isConnecting || isWaitingForPermission}
							<svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round"/>
							</svg>
						{:else}
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z" />
							</svg>
						{/if}
					</button>
				{/if}
			</div>
			
			<!-- Right: User Avatar - Links to wallet profile -->
			<a href={getWalletUrl('/profile')} class="nav-user-link" aria-label="Go to profile">
				{#if user?.image && !userImageFailed}
					<img
						src={user.image}
						alt={user.name}
						class="nav-avatar"
						onerror={() => (userImageFailed = true)}
					/>
				{:else if user?.name}
					<div class="nav-avatar-placeholder">
						{user.name[0]?.toUpperCase() || "U"}
					</div>
				{/if}
			</a>
		</div>
	</nav>
{:else}
	<!-- Not authenticated: Google Sign-in Button -->
	<nav class="nav-pill nav-pill-signin">
		<button onclick={onGoogleSignIn} class="signin-btn">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
				<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
				<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
				<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
			</svg>
			<span>Sign in with Google</span>
		</button>
	</nav>
{/if}

<style>
	/* Connection State Modal - Above mic button */
	.connection-modal {
		position: fixed;
		bottom: calc(72px + max(env(safe-area-inset-bottom), 0.5rem)); /* Above mic button */
		left: 50%;
		transform: translateX(-50%);
		z-index: 999; /* Below call button, above everything else */
		animation: slideUp 0.3s ease-out;
	}
	
	.connection-content {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 1rem; /* Reduced padding */
		border-radius: 1.5rem;
		border: 1px solid rgba(0, 26, 66, 0.3); /* Primary 800 */
		background-color: var(--color-primary-800); /* Primary 800 - navpill bg */
		backdrop-filter: blur(24px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
		color: white;
		transition: background-color 0.3s ease, border-color 0.3s ease;
	}
	
	/* Color-coded states - using design system tokens */
	.modal-waiting .connection-content {
		background-color: var(--color-warning-500); /* Warning - orange - waiting for permission */
		border-color: var(--color-warning-400);
		opacity: 0.95;
	}
	
	.modal-connecting .connection-content {
		background-color: var(--color-info-500); /* Info - purple/blue - connecting */
		border-color: var(--color-info-400);
		opacity: 0.95;
	}
	
	.modal-listening .connection-content {
		background-color: var(--color-primary-800); /* Primary 800 - navy blue - listening */
		border-color: var(--color-primary-700);
		opacity: 0.95;
	}
	
	.modal-thinking .connection-content {
		background-color: var(--color-success-500); /* Success - green - thinking */
		border-color: var(--color-success-300);
		opacity: 0.95;
	}
	
	.modal-speaking .connection-content {
		background-color: var(--color-secondary-500); /* Secondary - teal - speaking */
		border-color: var(--color-secondary-300);
		opacity: 0.95;
	}
	
	.modal-capability .connection-content {
		background-color: var(--color-alert-500); /* Alert - purple/magenta */
		border-color: var(--color-alert-400);
		opacity: 0.95;
		padding: 1rem 1.25rem;
		gap: 0.75rem;
		position: relative;
		flex-direction: column;
		align-items: center;
	}
	
	.modal-success .connection-content {
		background-color: var(--color-success-500); /* Success - green */
		border-color: var(--color-success-400);
		opacity: 0.95;
		padding: 1rem 1.25rem;
		gap: 0.75rem;
		position: relative;
		flex-direction: column;
		align-items: center;
	}
	
	.connection-text-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		text-align: center;
		width: 100%;
	}
	
	.modal-capability .connection-text-group {
		flex: 0;
	}
	
	.connection-subtext {
		font-size: 0.75rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.8);
		white-space: nowrap;
	}
	
	.request-access-container {
		width: 100%;
		display: flex;
		justify-content: center;
		margin-top: 0.5rem;
	}
	
	.request-access-btn {
		background-color: rgba(255, 255, 255, 0.95); /* White background */
		border: 2px solid var(--color-alert-300);
		color: var(--color-alert-700); /* Alert 700 - dark text */
		padding: 0.625rem 1.5rem;
		border-radius: 9999px; /* Fully rounded like all other buttons */
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
		box-shadow: 0 2px 8px rgba(163, 55, 106, 0.2); /* Alert colored shadow */
	}
	
	.request-access-btn:hover {
		background-color: rgba(255, 255, 255, 1); /* Fully opaque white on hover */
		border-color: var(--color-alert-200);
		color: var(--color-alert-800); /* Darker alert text on hover */
		box-shadow: 0 4px 12px rgba(163, 55, 106, 0.3); /* Stronger shadow on hover */
		transform: translateY(-1px);
	}
	
	.connection-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
	}
	
	.connection-icon.pulse {
		animation: pulse 2s ease-in-out infinite;
	}
	
	.connection-text {
		font-size: 0.8125rem;
		font-weight: 500;
		color: white;
		white-space: nowrap;
	}
	
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
	
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.1);
		}
	}

	.nav-pill {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		margin-bottom: max(env(safe-area-inset-bottom), 0.5rem);
		width: fit-content;
		max-width: calc(100vw - 2rem);
		border-radius: 9999px;
		border: 1px solid var(--color-primary-800); /* Primary 800 */
		background-color: var(--color-primary-800); /* Primary 800 - navpill bg */
		backdrop-filter: blur(24px) saturate(180%);
		-webkit-backdrop-filter: blur(24px) saturate(180%);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
		padding: 0.1875rem; /* Even smaller padding */
		transition: all 0.2s;
		opacity: 0.95;
	}
	
	.nav-container {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.5rem;
		padding: 0;
		min-height: 36px;
	}
	
	/* Logo Link */
	.nav-logo-link {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 50%;
		text-decoration: none;
	}
	
	.nav-logo {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		flex-shrink: 0;
		object-fit: cover;
	}
	
	.nav-vibe-avatar {
		/* Agent avatars are already circular images, ensure they display properly */
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	/* Center Call Button - Larger and overhanging */
	.nav-center {
		display: flex;
		align-items: center;
		justify-content: center;
		grid-column: 2;
		position: relative;
		z-index: 10; /* Above the nav pill */
	}
	
	.call-btn {
		width: 72px; /* Larger button */
		height: 72px;
		border-radius: 50%;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.25s ease-out;
		color: white;
		/* Removed bottom shadow - only keep top shadow on hover */
		/* Overhang above and below the nav pill */
		margin-top: -12px;
		margin-bottom: -12px;
	}
	
	.call-btn:disabled {
		cursor: not-allowed;
		/* Don't reduce opacity - button should stay fully visible during loading */
	}
	
	.call-btn-active {
		background: var(--color-alert-500); /* Alert color - purple/magenta */
		border: 3px solid var(--color-alert-300);
	}
	
	.call-btn-active:hover:not(:disabled) {
		background: var(--color-alert-600); /* Darker alert on hover */
		box-shadow: 0 12px 24px rgba(163, 55, 106, 0.4); /* Alert 500 with opacity */
		transform: translateY(-2px) scale(1.05);
	}
	
	.call-btn-inactive {
		background: var(--color-success-500); /* Success color - green */
		border: 3px solid var(--color-success-300);
	}
	
	.call-btn-inactive:hover:not(:disabled) {
		background: var(--color-success-600); /* Darker success on hover */
		box-shadow: 0 12px 24px rgba(76, 169, 132, 0.4); /* Success 500 with opacity */
		transform: translateY(-2px) scale(1.05);
	}
	
	.spinner {
		animation: spin 1s linear infinite;
	}
	
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	
	/* User Link */
	.nav-user-link {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 50%;
		text-decoration: none;
	}
	
	.nav-avatar {
		width: 38px;
		height: 38px;
		border-radius: 50%;
	}
	
	.nav-avatar-placeholder {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: linear-gradient(135deg, #4ecdc4, #f4d03f);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 700;
		font-size: 0.875rem;
	}
	
	/* Sign-in Mode - matches website style */
	.nav-pill-signin {
		border: 1px solid rgba(255, 255, 255, 0.3);
		background-color: rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(24px) saturate(180%);
		-webkit-backdrop-filter: blur(24px) saturate(180%);
	}
	
	/* CTA Mode - clean buttons without wrapper */
	.cta-buttons-container {
		position: fixed;
		bottom: max(env(safe-area-inset-bottom), 0.5rem);
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: max(env(safe-area-inset-bottom), 0.5rem);
	}
	
	.cta-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		border: 1px solid var(--color-primary-800); /* Primary 800 */
		background-color: var(--color-primary-800); /* Primary 800 - buttons and navpill bg */
		color: var(--color-primary-50); /* Primary 50 - button text/label color */
		padding: 0.75rem 1.5rem;
		font-weight: 500;
		font-size: 0.875rem;
		box-shadow: 0 2px 4px 0 rgb(0 0 0 / 0.08);
		backdrop-filter: blur(8px);
		transition: all 0.2s;
		cursor: pointer;
		white-space: nowrap;
		text-decoration: none;
		min-height: 44px; /* Ensure consistent height */
	}
	
	.cta-btn:hover {
		border-color: var(--color-primary-700); /* Primary 700 */
		background-color: var(--color-primary-700); /* Primary 700 - button hover */
		color: var(--color-primary-50); /* Primary 50 - keep text color */
		box-shadow: 0 4px 8px -1px rgb(0 0 0 / 0.12);
		transform: translateY(-1px);
	}
	
	.cta-login-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px; /* Match cta-btn height */
		height: 44px; /* Match cta-btn height */
		border-radius: 50%; /* Keep fully circular */
		border: 1px solid var(--color-primary-800); /* Primary 800 - same as cta-btn */
		background-color: var(--color-primary-800); /* Primary 800 - same as cta-btn */
		color: var(--color-primary-50); /* Primary 50 - button text/label color */
		transition: all 0.2s;
		cursor: pointer;
		text-decoration: none;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		flex-shrink: 0;
	}
	
	.cta-login-btn:hover {
		background-color: var(--color-primary-700); /* Primary 700 - button hover */
		border-color: var(--color-primary-700); /* Primary 700 */
		color: var(--color-primary-50); /* Primary 50 - keep text color */
		transform: scale(1.05);
	}
	
	
	.signin-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-radius: 9999px;
		border: 1px solid rgba(0, 26, 66, 0.9); /* Primary 800 */
		background-color: #001a42; /* Primary 800 - buttons bg */
		color: #e6ecf7; /* Primary 50 - button text/label color */
		padding: 0.75rem 1.5rem;
		font-weight: 500;
		font-size: 0.875rem;
		box-shadow: 0 2px 4px 0 rgb(0 0 0 / 0.08);
		backdrop-filter: blur(8px);
		transition: all 0.2s;
		cursor: pointer;
		white-space: nowrap;
	}
	
	.signin-btn:hover {
		border-color: rgba(0, 38, 98, 0.9); /* Primary 700 */
		background-color: #002662; /* Primary 700 - button hover */
		color: #e6ecf7; /* Primary 50 - keep text color */
		box-shadow: 0 4px 8px -1px rgb(0 0 0 / 0.12);
		transform: translateY(-1px);
	}
	
	/* Responsive */
	@media (max-width: 768px) {
		.nav-container {
			gap: 0.125rem;
			min-height: 36px;
		}
		
		/* Keep call button same size on tablet as desktop */
		/* Only shrink on mobile (480px) */
		
		.signin-btn {
			padding: 0.625rem 1.25rem;
			font-size: 0.8125rem;
		}
		
		.cta-btn {
			padding: 0.625rem 1.25rem;
			font-size: 0.8125rem;
		}
		
		.nav-logo-link {
			padding: 0.5rem;
		}
		
		.nav-user-link {
			padding: 0.5rem;
		}
		
		.nav-logo {
			width: 38px;
			height: 38px;
		}
		
		.nav-avatar,
		.nav-avatar-placeholder {
			width: 38px;
			height: 38px;
			font-size: 0.875rem;
		}
		
		.connection-modal {
			bottom: calc(64px + max(env(safe-area-inset-bottom), 0.5rem));
		}
	}
	
	@media (max-width: 480px) {
		.signin-btn span {
			display: none;
		}
		
		.signin-btn {
			padding: 0.625rem;
		}
		
		.cta-btn {
			padding: 0.625rem 1.25rem;
		}
		
		.cta-login-btn {
			width: 36px;
			height: 36px;
		}
		
		.call-btn {
			width: 56px;
			height: 56px;
			margin-top: -8px;
			margin-bottom: -8px;
		}
		
		.nav-logo-link,
		.nav-user-link {
			padding: 0.25rem;
		}
		
		.nav-logo {
			width: 32px;
			height: 32px;
		}
		
		.nav-avatar,
		.nav-avatar-placeholder {
			width: 32px;
			height: 32px;
			font-size: 0.75rem;
		}
		
		.connection-modal {
			bottom: calc(56px + max(env(safe-area-inset-bottom), 0.5rem));
		}
	}
</style>