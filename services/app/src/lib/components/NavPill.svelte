<script>
    import { goto } from '$app/navigation';
    import { createAuthClient } from '@hominio/auth';
    import { NavPill, createVoiceCallService } from '@hominio/brand';

	const authClient = createAuthClient();
	const session = authClient.useSession();

	// Initialize voice call service with tool call handler
	const voiceCall = createVoiceCallService({
		onToolCall: (toolName, args) => {
			console.log('[NavPill] Tool call:', toolName, args);
			if (toolName === 'switchAgent') {
				const agentId = args.agentId;
				if (agentId === 'dashboard') {
					goto('/me');
				} else {
					goto(`/me/${agentId}`);
				}
			}
		}
	});

	function goHome() {
		goto('/me');
	}

	let signingOut = $state(false);

	async function handleSignOut() {
		signingOut = true;
		try {
			// Clear Zero sync cache before signing out (privacy/security)
			// This removes all synced data from the device
			try {
				const { dropAllDatabases } = await import('@rocicorp/zero');
				const { dropped, errors } = await dropAllDatabases();
				if (errors && errors.length > 0) {
					console.warn('[NavPill] Some Zero databases could not be dropped:', errors);
				} else {
					console.log('[NavPill] ✅ Cleared Zero sync cache on logout');
				}
			} catch (zeroError) {
				console.error('[NavPill] Failed to clear Zero cache on logout:', zeroError);
				// Continue with logout even if cache clearing fails
			}
			
			await authClient.signOut();
			// Redirect to wallet service sign-in page
			const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
			
			// Get wallet domain - use env var or derive from current location
			let walletDomain = import.meta.env.PUBLIC_DOMAIN_WALLET;
			if (!walletDomain) {
				if (isProduction) {
					// In production, construct wallet domain from app domain
					const hostname = window.location.hostname;
					if (hostname.startsWith('app.')) {
						walletDomain = hostname.replace('app.', 'wallet.');
					} else {
						walletDomain = `wallet.${hostname.replace(/^www\./, '')}`;
					}
				} else {
					walletDomain = 'localhost:4201';
				}
			}
			walletDomain = walletDomain.replace(/^https?:\/\//, '');
			const protocol = walletDomain.startsWith('localhost') || walletDomain.startsWith('127.0.0.1') ? 'http' : 'https';
			const walletUrl = `${protocol}://${walletDomain}`;
			
			// Get app domain - use env var or derive from current location
			let appDomain = import.meta.env.PUBLIC_DOMAIN_APP;
			if (!appDomain) {
				if (isProduction) {
					appDomain = window.location.hostname;
				} else {
					appDomain = 'localhost:4202';
				}
			}
			appDomain = appDomain.replace(/^https?:\/\//, '');
			const appProtocol = appDomain.startsWith('localhost') || appDomain.startsWith('127.0.0.1') ? 'http' : 'https';
			const appUrl = `${appProtocol}://${appDomain}`;
			const callbackUrl = `${appUrl}/me`;
			window.location.href = `${walletUrl}?callback=${encodeURIComponent(callbackUrl)}`;
		} catch (error) {
			console.error('Sign out error:', error);
			signingOut = false;
		}
	}

	function handleGoogleSignIn() {
		// Redirect to wallet service for Google sign-in
		const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
		
		// Get wallet domain
		let walletDomain = import.meta.env.PUBLIC_DOMAIN_WALLET;
		if (!walletDomain) {
			if (isProduction) {
				const hostname = window.location.hostname;
				if (hostname.startsWith('app.')) {
					walletDomain = hostname.replace('app.', 'wallet.');
				} else if (hostname.startsWith('website.')) {
					walletDomain = hostname.replace('website.', 'wallet.');
				} else {
					walletDomain = `wallet.${hostname.replace(/^www\./, '')}`;
				}
			} else {
				walletDomain = 'localhost:4201';
			}
		}
		walletDomain = walletDomain.replace(/^https?:\/\//, '');
		const protocol = walletDomain.startsWith('localhost') || walletDomain.startsWith('127.0.0.1') ? 'http' : 'https';
		const walletUrl = `${protocol}://${walletDomain}`;
		
		// Get callback URL (current page or default)
		const currentUrl = window.location.href;
		window.location.href = `${walletUrl}?callback=${encodeURIComponent(currentUrl)}`;
	}

	// Voice call handlers - Using actual voice call service
	async function handleStartCall() {
		await voiceCall.startCall();
	}

	async function handleStopCall() {
		voiceCall.endCall();
	}

	// Ensure authentication state is properly reactive
	const isAuthenticated = $derived(!!$session.data?.user);
	const user = $derived($session.data?.user);
	
	// Debug: Log authentication state changes
	$effect(() => {
		console.log('[NavPill] Auth state changed:', { isAuthenticated, user: user?.name });
	});
</script>

<NavPill 
	onHome={goHome}
	onSignOut={handleSignOut}
	onGoogleSignIn={handleGoogleSignIn}
	isAuthenticated={isAuthenticated}
	signingOut={signingOut}
	user={user}
	isCallActive={voiceCall.isCallActive}
	isConnecting={voiceCall.isConnecting}
	isWaitingForPermission={voiceCall.isWaitingForPermission}
	aiState={voiceCall.aiState}
	onStartCall={handleStartCall}
	onStopCall={handleStopCall}
/>
