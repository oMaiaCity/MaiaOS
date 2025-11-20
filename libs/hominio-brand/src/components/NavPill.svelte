<script>
	/**
	 * NavPill - Global navigation pill component
	 * Layout: Logo (left) | Call Button (center) | User (right)
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
	 */
	
	import { LoadingSpinner } from './index.js';
	
	let { 
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
	} = $props();
	
	let userImageFailed = $state(false);
	
	// Helper to get wallet service URL
	function getWalletUrl() {
		if (typeof window === 'undefined') return '/';
		
		const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
		let walletDomain = 'localhost:4201'; // Default for dev
		
		if (isProduction) {
			const hostname = window.location.hostname;
			if (hostname.startsWith('app.')) {
				walletDomain = hostname.replace('app.', 'wallet.');
			} else if (hostname.startsWith('website.')) {
				walletDomain = hostname.replace('website.', 'wallet.');
			} else {
				walletDomain = `wallet.${hostname.replace(/^www\./, '')}`;
			}
		}
		
		const protocol = walletDomain.startsWith('localhost') || walletDomain.startsWith('127.0.0.1') ? 'http' : 'https';
		return `${protocol}://${walletDomain}`;
	}
	
	// Helper to get app service URL
	function getAppUrl() {
		if (typeof window === 'undefined') return '/';
		
		const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
		let appDomain = 'localhost:4202'; // Default for dev
		
		if (isProduction) {
			const hostname = window.location.hostname;
			if (hostname.startsWith('wallet.')) {
				appDomain = hostname.replace('wallet.', 'app.');
			} else if (hostname.startsWith('website.')) {
				appDomain = hostname.replace('website.', 'app.');
			} else {
				appDomain = `app.${hostname.replace(/^www\./, '')}`;
			}
		}
		
		const protocol = appDomain.startsWith('localhost') || appDomain.startsWith('127.0.0.1') ? 'http' : 'https';
		return `${protocol}://${appDomain}`;
	}
</script>

{#if isAuthenticated}
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

	<!-- Authenticated: Logo | Call Button | User -->
	<nav class="nav-pill">
		<div class="nav-container">
			<!-- Left: Logo - Links to app service -->
			<a href={getAppUrl()} class="nav-logo-link" aria-label="Go to app">
				<img src="/brand/logo_clean.png" alt="Home" class="nav-logo" />
			</a>
			
			<!-- Center: Call Button -->
			<div class="nav-center">
				{#if isCallActive}
					<button
						onclick={onStopCall}
						class="call-btn call-btn-active"
						aria-label="Stop call"
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
			
			<!-- Right: User Avatar - Links to wallet -->
			<a href={getWalletUrl()} class="nav-user-link" aria-label="Go to profile">
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
		border: 1px solid rgba(8, 27, 71, 0.3);
		background-color: rgba(8, 27, 71, 0.95); /* Default: dark navy */
		backdrop-filter: blur(24px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
		color: white;
		transition: background-color 0.3s ease, border-color 0.3s ease;
	}
	
	/* Color-coded states */
	.modal-waiting .connection-content {
		background-color: rgba(250, 204, 21, 0.95); /* Yellow sunflower - waiting for permission */
		border-color: rgba(253, 224, 71, 0.5);
	}
	
	.modal-connecting .connection-content {
		background-color: rgba(6, 182, 212, 0.95); /* Turquoise blue - connecting */
		border-color: rgba(103, 232, 249, 0.5);
	}
	
	.modal-listening .connection-content {
		background-color: rgba(34, 197, 94, 0.95); /* Green - listening */
		border-color: rgba(134, 239, 172, 0.5);
	}
	
	.modal-thinking .connection-content {
		background-color: rgba(6, 182, 212, 0.95); /* Turquoise blue - thinking */
		border-color: rgba(103, 232, 249, 0.5);
	}
	
	.modal-speaking .connection-content {
		background-color: rgba(250, 204, 21, 0.95); /* Yellow sunflower - speaking */
		border-color: rgba(253, 224, 71, 0.5);
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
		border: 1px solid rgb(6, 20, 54); /* Slightly darker border */
		background-color: rgb(8, 27, 71); /* 100% solid - no transparency! */
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
		padding: 0.1875rem; /* Even smaller padding */
	}
	
	.nav-container {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.1875rem;
		padding: 0;
		min-height: 42px; /* Bit taller to accommodate larger buttons */
	}
	
	/* Logo Link */
	.nav-logo-link {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		background: transparent;
		cursor: pointer;
		padding: 0.375rem; /* Slightly more padding */
		border-radius: 50%;
		transition: all 0.2s;
		text-decoration: none;
	}
	
	.nav-logo-link:hover {
		background: rgba(255, 255, 255, 0.1); /* Light hover on dark background */
		transform: scale(1.05);
	}
	
	.nav-logo {
		width: 34px; /* Bit larger */
		height: 34px;
		border-radius: 50%;
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
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
		/* Overhang above and below the nav pill */
		margin-top: -12px;
		margin-bottom: -12px;
	}
	
	.call-btn:disabled {
		cursor: not-allowed;
		/* Don't reduce opacity - button should stay fully visible during loading */
	}
	
	.call-btn-active {
		background: rgb(220, 38, 38); /* Solid red - fully opaque */
		border: 3px solid rgba(254, 202, 202, 1);
	}
	
	.call-btn-active:hover:not(:disabled) {
		background: rgb(185, 28, 28); /* Darker red on hover */
		box-shadow: 0 12px 24px rgba(220, 38, 38, 0.4);
		transform: translateY(-2px) scale(1.05);
	}
	
	.call-btn-inactive {
		background: rgb(34, 197, 94); /* Solid green - fully opaque */
		border: 3px solid rgba(134, 239, 172, 1);
	}
	
	.call-btn-inactive:hover:not(:disabled) {
		background: rgb(22, 163, 74); /* Darker green on hover */
		box-shadow: 0 12px 24px rgba(34, 197, 94, 0.4);
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
		justify-content: flex-end;
		background: transparent;
		cursor: pointer;
		padding: 0.375rem; /* Slightly more padding */
		border-radius: 50%;
		transition: all 0.2s;
		text-decoration: none;
	}
	
	.nav-user-link:hover {
		background: rgba(255, 255, 255, 0.1); /* Light hover on dark background */
		transform: scale(1.05);
	}
	
	.nav-avatar {
		width: 34px; /* Bit larger */
		height: 34px;
		border-radius: 50%;
	}
	
	.nav-avatar-placeholder {
		width: 34px;
		height: 34px;
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
		/* Outer padding already applied to .nav-pill */
	}
	
	.signin-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-radius: 9999px;
		border: 1px solid rgba(8, 27, 71, 0.9);
		background-color: rgba(8, 27, 71, 0.85); /* 85% opacity navy blue */
		color: #ffffff;
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
		border-color: rgba(8, 27, 71, 1);
		background-color: rgba(8, 27, 71, 0.95);
		box-shadow: 0 4px 8px -1px rgb(0 0 0 / 0.12);
		transform: translateY(-1px);
	}
	
	/* Responsive */
	@media (max-width: 768px) {
		.nav-container {
			gap: 0.125rem;
			min-height: 38px;
		}
		
		.call-btn {
			width: 64px;
			height: 64px;
			margin-top: -10px;
			margin-bottom: -10px;
		}
		
		.signin-btn {
			padding: 0.625rem 1.25rem;
			font-size: 0.8125rem;
		}
		
		.nav-logo-link,
		.nav-user-link {
			padding: 0.3125rem;
		}
		
		.nav-logo {
			width: 30px;
			height: 30px;
		}
		
		.nav-avatar,
		.nav-avatar-placeholder {
			width: 30px;
			height: 30px;
			font-size: 0.75rem;
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
			width: 28px;
			height: 28px;
		}
		
		.nav-avatar,
		.nav-avatar-placeholder {
			width: 28px;
			height: 28px;
			font-size: 0.6875rem;
		}
		
		.connection-modal {
			bottom: calc(56px + max(env(safe-area-inset-bottom), 0.5rem));
		}
	}
</style>

