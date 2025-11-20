<script lang="ts">
	import { createAuthClient } from '@hominio/auth';
	import { goto } from '$app/navigation';
	import { BackgroundBlobs, GlassCard, GlassButton, GlassInfoCard, LoadingSpinner, Alert, ProfileImage } from '@hominio/brand';
	// import type { Capability, CapabilityRequest } from '@hominio/caps';

	const authClient = createAuthClient();
	const session = authClient.useSession();

	let loading = $state(true);
	let error = $state<string | null>(null);
	let signingOut = $state(false);

	$effect(() => {
		// Handle session state changes
		if ($session.isPending) {
			return;
		}
		
		if (!$session.data?.user) {
			loading = false;
			goto('/?callback=' + encodeURIComponent(window.location.href));
			return;
		}
		
		loading = false;
	});

	async function handleSignOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			// Redirect to sign-in page
			goto('/');
		} catch (error) {
			console.error('Sign out error:', error);
			signingOut = false;
		}
	}
</script>

<div class="min-h-screen bg-glass-gradient p-6 font-sans text-slate-800 antialiased selection:bg-blue-100">
	<BackgroundBlobs />

	<div class="relative mx-auto max-w-2xl pt-12">
		{#if loading || $session.isPending}
			<div class="flex flex-col items-center justify-center py-24">
				<LoadingSpinner />
				<p class="mt-4 text-sm font-medium text-slate-500">Loading profile...</p>
			</div>
		{:else if error}
			<Alert type="error">
				<p class="font-medium">Error</p>
				<p class="text-sm opacity-80">{error}</p>
			</Alert>
		{:else if $session.data?.user}
			<!-- Header -->
			<div class="mb-8 text-center md:text-left">
				<h1 class="text-4xl font-bold tracking-tight text-slate-900">Profile</h1>
				<p class="mt-2 text-slate-500">Manage your account details</p>
			</div>
			
			<!-- Liquid Glass Card -->
			<GlassCard hover={true}>
				<!-- Custom taller gradient header for floating profile image -->
				<div class="h-32 w-full bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 opacity-50"></div>
				
				<div class="relative px-8 pb-10">
					<!-- Profile Image (Floating) -->
					<div class="-mt-16 mb-6 flex justify-center">
						<ProfileImage
							src={$session.data.user.image}
							name={$session.data.user.name || ''}
							email={$session.data.user.email || ''}
							size="lg"
						/>
					</div>

					<!-- User Info -->
					<div class="text-center">
						<h2 class="text-3xl font-bold text-slate-900">
							{$session.data.user.name || 'Anonymous User'}
						</h2>
						<div class="mt-1 text-lg font-medium text-slate-500">
							{$session.data.user.email || 'No email provided'}
						</div>

						<div class="mt-8 grid gap-6 md:grid-cols-2">
							<!-- ID Card -->
							<GlassInfoCard>
								<div class="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
									</svg>
									User ID
								</div>
								<div class="font-mono text-sm text-slate-700 break-all">
									{$session.data.user.id}
								</div>
							</GlassInfoCard>

							<!-- Role/Status Card (Placeholder) -->
							<GlassInfoCard>
								<div class="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									Status
								</div>
								<div class="flex items-center gap-2">
									<span class="relative flex h-2.5 w-2.5">
										<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
										<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
									</span>
									<span class="text-sm font-medium text-slate-700">Active</span>
								</div>
							</GlassInfoCard>
						</div>

						<!-- Logout Button -->
						<div class="mt-8 flex justify-center">
							<GlassButton variant="danger" onclick={handleSignOut} disabled={signingOut} class="items-center gap-2">
								{#if signingOut}
									<div class="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600"></div>
									<span>Signing out...</span>
								{:else}
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
									</svg>
									<span>Sign Out</span>
								{/if}
							</GlassButton>
						</div>
					</div>
				</GlassCard>

			<!-- TODO: Re-enable Capabilities Section -->
			<!-- <div class="mt-12">
				... capabilities UI ...
			</div> -->
		{/if}
	</div>
</div>
