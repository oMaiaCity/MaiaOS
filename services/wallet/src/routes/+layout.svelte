<script lang="ts">
	import '@hominio/brand/app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { createAuthClient } from '@hominio/auth';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { NavPill, createVoiceCallService } from '@hominio/brand';
	
	let { children } = $props();
	
	const authClient = createAuthClient();
	const session = authClient.useSession();
	
	// Initialize voice call service with tool call handler
	const voiceCall = createVoiceCallService({
		onToolCall: (toolName, args) => {
			console.log('[NavPill] Tool call:', toolName, args);
			// Wallet service doesn't handle agent switching
			// Could add other tool handlers here if needed
		}
	});

	$effect(() => {
		// Skip protection for root route (/)
		if ($page.url.pathname === '/') {
			return;
		}

		// Protect all other routes - redirect to sign-in if not authenticated
		if (!$session.isPending && !$session.data?.user) {
			goto('/?callback=' + encodeURIComponent(window.location.href));
		}
	});

	// NavPill handlers
	function goHome() {
		goto('/');
	}

	let signingOut = $state(false);

	async function handleSignOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			// Redirect to root (sign-in page)
			goto('/');
		} catch (error) {
			console.error('Sign out error:', error);
			signingOut = false;
		}
	}

	function handleGoogleSignIn() {
		// Redirect to Google sign-in (handled by root page)
		const currentUrl = window.location.href;
		goto('/?callback=' + encodeURIComponent(currentUrl));
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

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

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

{@render children()}
