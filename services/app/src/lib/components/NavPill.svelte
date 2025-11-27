<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { createAuthClient } from '@hominio/auth';
    import { NavPill, createVoiceCallService } from '@hominio/brand';
    import type { Capability } from '@hominio/caps';

	const authClient = createAuthClient();
	const session = authClient.useSession();

	// Detect if we're on an agent page and extract agent ID
	// Matches /me/charles, /me/charles/admin, /me/karl, etc.
	const currentAgentId = $derived.by(() => {
		const path = $page.url.pathname;
		// Match /me/{agentId} or /me/{agentId}/... (any sub-route)
		const match = path.match(/^\/me\/([^\/]+)/);
		const agentId = match ? match[1] : undefined;
		
		// Return valid agent IDs (charles, karl, etc.)
		// Exclude 'admin' if it's a top-level route
		if (agentId && agentId !== 'admin') {
			return agentId;
		}
		
		return undefined;
	});

	// Load agent config to get avatar when in agent context
	let agentAvatar = $state<string | null>(null);
	
	$effect(() => {
		if (currentAgentId) {
			// Dynamically load agent config to get avatar
			import('@hominio/vibes').then(({ loadVibeConfig }) => {
				loadVibeConfig(currentAgentId).then((config) => {
					agentAvatar = config.avatar || null;
				}).catch((err) => {
					console.warn('[NavPill] Failed to load agent config for avatar:', err);
					agentAvatar = null;
				});
			});
		} else {
			agentAvatar = null; // Reset to default logo when not in agent context
		}
	});

	// Initialize voice call service with tool call handler
	const voiceCall = createVoiceCallService({
		onToolCall: async (toolName, args) => {
			console.log('[NavPill] Tool call:', toolName, args);
			
			// Dispatch generic toolCall event for activity stream
			const toolCallEvent = new CustomEvent('toolCall', {
				detail: {
					toolName,
					args,
					timestamp: Date.now()
				}
			});
			window.dispatchEvent(toolCallEvent);

			if (toolName === 'queryVibeContext') {
				// Vibe context queries don't require UI navigation
				// The context is injected into the conversation automatically
				console.log('[NavPill] Vibe context queried:', args.vibeId);
			} else if (toolName === 'actionSkill') {
				// Handle actionSkill tool calls
				// Dispatch custom event for Charles/Karl page to handle
				
				// Extract vibeId and skillId, pass the rest as args (flat structure)
				// Support legacy agentId parameter
				const { vibeId, skillId, agentId, ...rawArgs } = args;
				const effectiveVibeId = vibeId || agentId;
				
				// Handle potential nested args from LLM (hallucination or habit)
				// If rawArgs has a single property 'args' which is an object, use that instead
				let skillArgs = rawArgs;
				if (Object.keys(rawArgs).length === 1 && rawArgs.args && typeof rawArgs.args === 'object') {
					console.log('[NavPill] ⚠️ Detected nested args object from LLM, flattening...');
					skillArgs = rawArgs.args;
				}
				
				const event = new CustomEvent('actionSkill', {
					detail: {
						vibeId: effectiveVibeId,
						agentId: effectiveVibeId, // Legacy support
						skillId,
						args: skillArgs
					}
				});
				window.dispatchEvent(event);
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

	// Check if user has voice capability
	let hasVoiceCapability = $state(false);
	let showCapabilityModal = $state(false);
	let showSuccessModal = $state(false);
	let capabilityExpired = $state(false); // Track if capability expired vs missing

	async function checkVoiceCapability() {
		if (!isAuthenticated) {
			hasVoiceCapability = false;
			return false;
		}

		try {
			// Get wallet domain for API call
			const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
			let walletDomain = import.meta.env.PUBLIC_DOMAIN_WALLET;
			if (!walletDomain) {
				if (isProduction) {
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

			const response = await fetch(`${walletUrl}/api/auth/capabilities`, {
				credentials: 'include',
			});

			if (!response.ok) {
				hasVoiceCapability = false;
				return false;
			}

			const data = await response.json();
			const capabilities = data.capabilities || [];
			
			// Check if user has api:voice capability
			hasVoiceCapability = capabilities.some((cap: Capability) => 
				cap.resource?.type === 'api' && 
				cap.resource?.namespace === 'voice' &&
				cap.actions?.includes('read')
			);

			return hasVoiceCapability;
		} catch (err) {
			console.error('[NavPill] Error checking capability:', err);
			hasVoiceCapability = false;
			return false;
		}
	}

	// Voice call handlers - Using actual voice call service
	async function handleStartCall() {
		// Check capability first
		const hasAccess = await checkVoiceCapability();
		
		if (!hasAccess) {
			capabilityExpired = false; // Not expired, just missing
			showCapabilityModal = true;
			return;
		}

		// Pass current agent ID when starting call (reactive)
		await voiceCall.startCall(currentAgentId);
	}

	async function handleRequestAccess() {
		if (!isAuthenticated) {
			console.error('[NavPill] Cannot request access: not authenticated');
			return;
		}

		// Reset expired flag when requesting new access
		capabilityExpired = false;

		try {
			// Get wallet domain for API call
			const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.0.0.1');
			let walletDomain = import.meta.env.PUBLIC_DOMAIN_WALLET;
			if (!walletDomain) {
				if (isProduction) {
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

			// Request voice capability (admin is automatically set as owner for api:voice)
			const response = await fetch(`${walletUrl}/api/auth/capabilities/request`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					resource: {
						type: 'api',
						namespace: 'voice',
					},
					actions: ['read'],
					message: 'Requesting access to voice assistant',
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to request access');
			}

			const data = await response.json();
			console.log('[NavPill] Capability request created:', data);
			
			showCapabilityModal = false;
			showSuccessModal = true;
			
			// Auto-close success modal after 3 seconds
			setTimeout(() => {
				showSuccessModal = false;
			}, 3000);
		} catch (err) {
			console.error('[NavPill] Error requesting access:', err);
			alert(err instanceof Error ? err.message : 'Failed to request access');
		}
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

	// Handle context updates from pages
	$effect(() => {
		const handleContextUpdate = (event: Event) => {
			const customEvent = event as CustomEvent;
			const { text } = customEvent.detail;
			if (text && voiceCall.isCallActive) {
				console.log('[NavPill] Sending context update to voice session');
				voiceCall.sendTextMessage(`[System] Updated context: ${text}`);
			}
		};

		window.addEventListener('updateVoiceContext', handleContextUpdate);

		return () => {
			window.removeEventListener('updateVoiceContext', handleContextUpdate);
		};
	});

	// Track previous call state to detect expiration during active call
	let wasCallActive = $state(false);
	
	$effect(() => {
		// Track if call was active
		if (voiceCall.isCallActive || voiceCall.status === 'connected') {
			wasCallActive = true;
		} else {
			// Reset flag when call ends (both isCallActive and status are inactive)
			wasCallActive = false;
		}
	});

	// Watch for capability expiration errors from voice call service
	$effect(() => {
		const currentError = voiceCall.error;
		if (currentError) {
			// Check if error is related to capability expiration
			const isCapabilityError = 
				currentError.includes('capability') ||
				currentError.includes('Access denied') ||
				currentError.includes('permission') ||
				currentError.includes('Forbidden');
			
			if (isCapabilityError) {
				console.log('[NavPill] Capability error detected:', currentError);
				// Mark as expired if call was active before (meaning it expired during use)
				// If wasCallActive is true, it means the call was interrupted by expiration
				capabilityExpired = wasCallActive;
				// Show capability modal to allow re-requesting access
				showCapabilityModal = true;
				// Reset the flag after showing modal
				wasCallActive = false;
			}
		} else {
			// Reset expired flag when error clears
			if (!showCapabilityModal) {
				capabilityExpired = false;
			}
		}
	});

	// Cleanup voice call service on unmount
	$effect(() => {
		return () => {
			console.log('[NavPill] Cleaning up voice call service');
			voiceCall.cleanup();
		};
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
	showCapabilityModal={showCapabilityModal}
	showSuccessModal={showSuccessModal}
	onRequestAccess={handleRequestAccess}
	onCloseCapabilityModal={() => {
		showCapabilityModal = false;
		capabilityExpired = false;
	}}
	onCloseSuccessModal={() => showSuccessModal = false}
	agentAvatar={agentAvatar}
	capabilityModalTitle={capabilityExpired ? 'Voice access expired' : 'Access required'}
	capabilityModalMessage={capabilityExpired ? 'Your voice access has expired. Please request access again to continue using the voice assistant.' : 'You need permission to use the voice assistant'}
/>
