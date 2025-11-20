<script lang="ts">
	import { createAuthClient } from '@hominio/auth';
	import { goto } from '$app/navigation';
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

<div class="min-h-screen bg-gradient-to-br from-[#f8f9fa] via-[#f2f4f6] to-[#e9ecef] p-6 font-sans text-slate-800 antialiased selection:bg-blue-100">
	<!-- Decorative background blobs for liquid effect -->
	<div class="fixed -top-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-blue-200/20 blur-3xl filter pointer-events-none"></div>
	<div class="fixed top-[20%] -right-[10%] h-[600px] w-[600px] rounded-full bg-purple-200/20 blur-3xl filter pointer-events-none"></div>
	<div class="fixed -bottom-[20%] left-[20%] h-[500px] w-[500px] rounded-full bg-emerald-200/20 blur-3xl filter pointer-events-none"></div>

	<div class="relative mx-auto max-w-2xl pt-12">
		{#if loading || $session.isPending}
			<div class="flex flex-col items-center justify-center py-24">
				<div class="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
				<p class="mt-4 text-sm font-medium text-slate-500">Loading profile...</p>
			</div>
		{:else if error}
			<div class="rounded-2xl border border-red-100 bg-red-50/50 p-6 text-red-600 backdrop-blur-md">
				<p class="font-medium">Error</p>
				<p class="text-sm opacity-80">{error}</p>
			</div>
		{:else if $session.data?.user}
			<!-- Header -->
			<div class="mb-8 text-center md:text-left">
				<h1 class="text-4xl font-bold tracking-tight text-slate-900">Profile</h1>
				<p class="mt-2 text-slate-500">Manage your account details</p>
			</div>
			
			<!-- Liquid Glass Card -->
			<div class="overflow-hidden rounded-3xl border border-white/60 bg-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
				<!-- Gradient Accent Header -->
				<div class="h-32 w-full bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 opacity-50"></div>
				
				<div class="relative px-8 pb-10">
					<!-- Profile Image (Floating) -->
					<div class="-mt-16 mb-6 flex justify-center">
						<div class="relative rounded-full p-1 bg-white/80 shadow-lg backdrop-blur-sm">
							{#if $session.data.user.image}
								<img
									src={$session.data.user.image}
									alt={$session.data.user.name || 'Profile'}
									class="h-32 w-32 rounded-full object-cover"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<div class="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-5xl font-medium text-slate-500">
									{($session.data.user.name || $session.data.user.email || 'U')[0].toUpperCase()}
								</div>
							{/if}
						</div>
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
							<div class="group relative overflow-hidden rounded-2xl border border-white/50 bg-white/30 p-4 transition-all hover:bg-white/50 hover:shadow-sm">
								<div class="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
									</svg>
									User ID
								</div>
								<div class="font-mono text-sm text-slate-700 break-all">
									{$session.data.user.id}
								</div>
							</div>

							<!-- Role/Status Card (Placeholder) -->
							<div class="group relative overflow-hidden rounded-2xl border border-white/50 bg-white/30 p-4 transition-all hover:bg-white/50 hover:shadow-sm">
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
							</div>
						</div>

						<!-- Logout Button -->
						<div class="mt-8 flex justify-center">
							<button
								onclick={handleSignOut}
								disabled={signingOut}
								class="group flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-6 py-3 font-medium text-red-600 transition-all hover:border-red-300 hover:bg-red-100/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
							>
								{#if signingOut}
									<div class="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600"></div>
									<span>Signing out...</span>
								{:else}
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
									</svg>
									<span>Sign Out</span>
								{/if}
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- TODO: Re-enable Capabilities Section -->
			<!-- <div class="mt-12">
				... capabilities UI ...
			</div> -->
		{/if}
	</div>
</div>
