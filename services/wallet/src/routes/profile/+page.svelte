<script lang="ts">
	import { onMount } from 'svelte';
	import { createAuthClient } from '@hominio/auth';
	import { goto } from '$app/navigation';
	import { GlassCard, GlassButton, GlassInfoCard, LoadingSpinner, Alert, ProfileImage } from '@hominio/brand';
	import type { Capability } from '@hominio/caps';

	const authClient = createAuthClient();
	const session = authClient.useSession();

	let loading = $state(true);
	let error = $state<string | null>(null);
	let signingOut = $state(false);
	
	let capabilities = $state<Capability[]>([]);
	let groupCapabilities = $state<Array<Capability & { subCapabilities: Capability[] }>>([]);
	let capabilitiesLoading = $state(true);
	let capabilitiesError = $state<string | null>(null);
	let now = $state(new Date());
	let expandedGroups = $state<Set<string>>(new Set());

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
		
		// Load capabilities when session is ready
		if ($session.data?.user && capabilitiesLoading && capabilities.length === 0 && !capabilitiesError) {
			loadCapabilities();
		}
	});

	// Update time every second for countdown
	$effect(() => {
		const interval = setInterval(() => {
			now = new Date();
		}, 1000);
		return () => clearInterval(interval);
	});

	function formatTimeRemaining(expiresAt: string): { value: number; unit: 'd' | 'h' | 'm' | 's' } {
		const expires = new Date(expiresAt);
		const diff = expires.getTime() - now.getTime();
		
		if (diff <= 0) {
			return { value: 0, unit: 's' };
		}
		
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((diff % (1000 * 60)) / 1000);
		
		if (days > 0) {
			return { value: days, unit: 'd' };
		} else if (hours > 0) {
			return { value: hours, unit: 'h' };
		} else if (minutes > 0) {
			return { value: minutes, unit: 'm' };
		} else {
			return { value: seconds, unit: 's' };
		}
	}

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

	async function loadCapabilities() {
		try {
			capabilitiesLoading = true;
			capabilitiesError = null;
			
			const response = await fetch('/api/auth/capabilities', {
				credentials: 'include',
			});
			
			
			if (!response.ok) {
				const errorText = await response.text();
				console.error('[Profile] Capabilities API error:', response.status, errorText);
				throw new Error(`Failed to load capabilities: ${response.status} ${errorText}`);
			}
			
			const data = await response.json();
			capabilities = data.capabilities || [];
			groupCapabilities = data.groupCapabilities || [];
		} catch (err) {
			console.error('[Profile] Error loading capabilities:', err);
			capabilitiesError = err instanceof Error ? err.message : 'Failed to load capabilities';
		} finally {
			capabilitiesLoading = false;
		}
	}

	// Capabilities will be loaded automatically when session is ready via $effect

	// Format resource string for display
	function formatResource(capability: Capability): string {
		const { resource } = capability;
		let resourceStr = `${resource.type}:${resource.namespace}`;
		if (resource.id) {
			resourceStr += `:${resource.id}`;
		}
		if (resource.device_id) {
			resourceStr += ` (device: ${resource.device_id})`;
		}
		return resourceStr;
	}
</script>

<div class="p-6 min-h-screen font-sans antialiased bg-glass-gradient text-slate-800 selection:bg-blue-100">

	<div class="relative pt-12 mx-auto max-w-2xl">
		{#if loading || $session.isPending}
			<div class="flex flex-col justify-center items-center py-24">
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
				<div class="w-full h-32 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 opacity-50"></div>
				
				<div class="relative px-8 pb-10">
					<!-- Profile Image (Floating) -->
					<div class="flex justify-center -mt-16 mb-6">
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

					<!-- ID Card - Full Width -->
					<div class="mt-8">
						<GlassInfoCard>
							<div class="flex gap-4 justify-between items-center">
								<span class="text-sm font-semibold tracking-wider uppercase text-slate-400">ID</span>
								<span class="font-mono text-sm text-right break-all text-slate-700">{$session.data.user.id}</span>
							</div>
						</GlassInfoCard>
					</div>

						<!-- Logout Button -->
						<div class="flex justify-center mt-8">
							<GlassButton variant="alert" onclick={handleSignOut} disabled={signingOut} class="gap-2 items-center">
								{#if signingOut}
									<div class="w-4 h-4 rounded-full border-2 border-red-300 animate-spin border-t-red-600"></div>
									<span>Signing out...</span>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
									</svg>
									<span>Sign Out</span>
								{/if}
							</GlassButton>
						</div>
					</div>
				</div>
			</GlassCard>

			<!-- Capabilities Section -->
			<div class="mt-12">
				<h2 class="mb-6 text-3xl font-bold tracking-tight text-slate-900">My Capabilities</h2>
				
				{#if capabilitiesLoading}
					<div class="flex justify-center items-center py-12">
						<LoadingSpinner />
						<p class="ml-4 text-sm font-medium text-slate-500">Loading capabilities...</p>
					</div>
				{:else if capabilitiesError}
					<GlassCard class="p-6">
						<div class="text-center text-red-600">
							<p class="font-medium">Error loading capabilities</p>
							<p class="mt-2 text-sm text-slate-500">{capabilitiesError}</p>
						</div>
					</GlassCard>
				{:else if capabilities.length === 0 && groupCapabilities.length === 0}
					<GlassCard class="p-8 text-center">
						<p class="text-slate-600">No capabilities granted yet.</p>
					</GlassCard>
				{:else}
					<div class="grid grid-cols-1 gap-3">
						<!-- Group Capabilities (with collapsible sub-capabilities) -->
						{#each groupCapabilities as groupCap (groupCap.id)}
							{@const isExpanded = expandedGroups.has(groupCap.id)}
							<GlassCard class="capability-card group-capability-card">
								<div class="capability-header">
									<!-- Left: Title and Description -->
									<div class="capability-title-section">
										<div class="flex gap-2 items-center mb-1">
											{#if groupCap.title}
												<h3 class="capability-title">{groupCap.title}</h3>
											{/if}
										</div>
										{#if groupCap.description}
											<p class="capability-description">
												{groupCap.description} - GRANTED {new Date(groupCap.created_at).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
											</p>
										{:else}
											<p class="capability-description">
												No description - GRANTED {new Date(groupCap.created_at).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
											</p>
										{/if}
									</div>
									
									<!-- Right: Metadata -->
									<div class="capability-metadata">
										<div class="flex gap-2 justify-end items-center">
											<p class="font-mono text-xs text-slate-900">group:{groupCap.resource.namespace}</p>
											<span class="text-xs font-semibold tracking-wider uppercase text-slate-400">Resource</span>
										</div>
									</div>
								</div>
								
								<!-- Expand/Collapse Button and Badge Row at Bottom -->
								<div class="group-capability-toggle-row">
									<button
										onclick={() => {
											const newSet = new Set(expandedGroups);
											if (isExpanded) {
												newSet.delete(groupCap.id);
											} else {
												newSet.add(groupCap.id);
											}
											expandedGroups = newSet;
										}}
										class="group-toggle-button"
										type="button"
										aria-label={isExpanded ? 'Hide capabilities' : 'Show capabilities'}
									>
										<svg
											class="group-toggle-icon {isExpanded ? 'expanded' : ''}"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</button>
									<span class="group-capability-badge">
										<span class="group-capability-badge-text">
											{groupCap.subCapabilities?.length || 0} {groupCap.subCapabilities?.length === 1 ? 'capability' : 'capabilities'}
										</span>
									</span>
								</div>
								
								<!-- Collapsible Sub-capabilities -->
								{#if isExpanded && groupCap.subCapabilities && groupCap.subCapabilities.length > 0}
									<div class="group-capabilities-list">
										{#each groupCap.subCapabilities as subCap (subCap.id)}
											<div class="capability-sub-item">
												<div class="flex gap-2 items-center mb-1">
													{#if subCap.title}
														<h4 class="text-base font-semibold text-slate-800">{subCap.title}</h4>
													{/if}
												</div>
												{#if subCap.description}
													<p class="mb-2 text-sm text-slate-600">{subCap.description}</p>
												{/if}
												<div class="flex gap-4 items-center text-xs">
													<div class="flex gap-2 items-center">
														<p class="font-mono text-slate-700">{formatResource(subCap)}</p>
														<span class="text-slate-400">Resource</span>
													</div>
													<div class="flex gap-2 items-center">
														<div class="flex gap-1">
															{#each subCap.actions as action}
																<span class="inline-block px-1.5 py-0.5 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">
																	{action}
																</span>
															{/each}
														</div>
														<span class="text-slate-400">Actions</span>
													</div>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</GlassCard>
						{/each}
						
						<!-- Individual Capabilities -->
						{#each capabilities as capability (capability.id)}
							<GlassCard class="capability-card">
								<div class="capability-header">
									<!-- Left: Title and Description -->
									<div class="capability-title-section">
										<div class="flex gap-2 items-center mb-1">
											{#if capability.title}
												<h3 class="capability-title">{capability.title}</h3>
											{/if}
											{#if capability.metadata?.isGroupCapability}
												<span class="inline-block px-2 py-0.5 text-xs font-medium text-purple-800 bg-purple-100 rounded-full">
													Group: {capability.metadata.groupTitle || capability.metadata.group}
												</span>
											{/if}
										</div>
										{#if capability.description}
											<p class="capability-description">
												{capability.description} - GRANTED {new Date(capability.created_at).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
											</p>
										{:else}
											<p class="capability-description">
												No description - GRANTED {new Date(capability.created_at).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
											</p>
										{/if}
									</div>
									
									<!-- Right: All Metadata (value first, then label) -->
									<div class="capability-metadata">
										<div class="flex gap-2 justify-end items-center">
											<p class="font-mono text-xs text-slate-900">{formatResource(capability)}</p>
											<span class="text-xs font-semibold tracking-wider uppercase text-slate-400">Resource</span>
										</div>
										<div class="flex gap-2 justify-end items-center">
											<div class="flex gap-1">
												{#each capability.actions as action}
													<span class="inline-block px-1.5 py-0.5 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">
														{action}
													</span>
												{/each}
											</div>
											<span class="text-xs font-semibold tracking-wider uppercase text-slate-400">Actions</span>
										</div>
									</div>
									
									<!-- Right: Expiration Countdown (Full Height, All the way right) -->
									{#if capability.conditions?.expiresAt}
										{@const expiration = formatTimeRemaining(capability.conditions.expiresAt)}
										<div class="capability-expiration">
											<div class="expiration-value">
												<span class="expiration-time">
													<span class="expiration-number">{expiration.value}</span>
													<span class="expiration-unit">{expiration.unit}</span>
												</span>
												<span class="expiration-label">expires in</span>
											</div>
										</div>
									{/if}
								</div>
							</GlassCard>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	
	.capability-header {
		display: flex;
		align-items: stretch;
		width: 100%;
	}
	
	.capability-title-section {
		flex: 1;
		min-width: 0;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.25rem;
	}
	
	.capability-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-primary-700);
		line-height: 1.25;
		margin: 0;
	}
	
	.capability-description {
		font-size: 0.875rem;
		color: #64748b;
		line-height: 1.5;
		margin: 0;
	}
	
	.capability-expiration {
		display: flex;
		align-items: stretch;
		justify-content: stretch;
		background: var(--color-warning-100);
		border-left: 1px solid var(--color-warning-300);
		min-width: 120px;
	}
	
	.expiration-value {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		color: var(--color-warning-800);
		padding: 0 1.1rem;
		letter-spacing: -0.015em;
		gap: 0.25rem;
	}
	
	.expiration-time {
		display: flex;
		align-items: baseline;
		gap: 0.125rem;
		line-height: 1;
	}
	
	.expiration-number {
		font-size: 1.5rem;
		line-height: 1;
	}
	
	.expiration-unit {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-warning-700);
		text-transform: lowercase;
	}
	
	.expiration-label {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--color-warning-600);
		text-transform: lowercase;
	}
	
	.capability-metadata {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.25rem;
		padding: 1rem 1.25rem;
		border-left: 1px solid rgba(0, 0, 0, 0.1);
		flex-shrink: 0;
	}
	
	.group-capability-card {
		position: relative;
	}
	
	.group-capability-toggle-row {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.625rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
		margin-top: 0;
		padding: 0.75rem 1.25rem 1rem 1.25rem;
	}
	
	.group-capability-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.375rem 0.625rem;
		background: var(--color-primary-50);
		border: 1px solid var(--color-primary-200);
		border-radius: 0.375rem;
	}
	
	.group-capability-badge-text {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-primary-700);
		letter-spacing: 0.01em;
	}
	
	.group-toggle-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		background: transparent;
		border: 1px solid var(--color-primary-200);
		border-radius: 0.375rem;
		color: var(--color-primary-600);
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.group-toggle-button:hover {
		background: var(--color-primary-50);
		border-color: var(--color-primary-300);
		color: var(--color-primary-700);
	}
	
	.group-toggle-icon {
		width: 1rem;
		height: 1rem;
		color: currentColor;
		transition: transform 0.2s ease;
	}
	
	.group-toggle-icon.expanded {
		transform: rotate(180deg);
	}
	
	.group-capabilities-list {
		margin-top: 0;
		padding: 1rem 1.25rem;
		border-top: 1px solid rgba(148, 163, 184, 0.2);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.capability-sub-item {
		padding: 0.875rem 1rem;
		background: rgba(255, 255, 255, 0.4);
		border-radius: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.6);
		backdrop-filter: blur(24px);
		box-shadow: 0 8px 30px rgb(0, 0, 0, 0.04);
	}
	
	/* Mobile Responsive Styles */
	@media (max-width: 768px) {
		.capability-header {
			flex-direction: column;
		}
		
		/* Title Section - Full Width on Mobile */
		.capability-title-section {
			padding: 0.75rem 1rem;
			border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		}
		
		.capability-title {
			font-size: 1rem;
		}
		
		.capability-description {
			font-size: 0.8125rem;
		}
		
		/* Metadata - Stacked on Mobile */
		.capability-metadata {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 0.75rem;
			padding: 0.75rem 1rem;
			border-left: none;
			border-bottom: 1px solid rgba(0, 0, 0, 0.1);
			justify-content: flex-start;
		}
		
		.capability-metadata > div {
			flex-direction: row;
			gap: 0.5rem;
		}
		
		/* Expiration - Full Width on Mobile */
		.capability-expiration {
			min-width: auto;
			width: 100%;
			border-left: none;
			border-bottom: 1px solid var(--color-warning-300);
		}
		
		.expiration-value {
			padding: 0.75rem 1rem;
		}
		
		.expiration-number {
			font-size: 1.25rem;
		}
		
		/* Container adjustments */
		.max-w-2xl {
			padding-left: 0.75rem;
			padding-right: 0.75rem;
		}
		
		/* Header adjustments */
		h1 {
			font-size: 2rem;
		}
		
		h2 {
			font-size: 1.75rem;
		}
	}
	
	/* Very small screens */
	@media (max-width: 480px) {
		.capability-title {
			font-size: 0.9375rem;
		}
		
		.capability-description {
			font-size: 0.75rem;
		}
		
		.expiration-number {
			font-size: 1.125rem;
		}
		
		.expiration-unit,
		.expiration-label {
			font-size: 0.6875rem;
		}
		
		h1 {
			font-size: 1.75rem;
		}
		
		h2 {
			font-size: 1.5rem;
		}
	}
</style>
