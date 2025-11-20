<script lang="ts">
	import { onMount } from 'svelte';
	import { createAuthClient } from '@hominio/auth';
	import type { Capability, CapabilityRequest } from '@hominio/caps';
	import { env } from '$env/dynamic/public';
	import { DarkGlassCard, LoadingSpinner, GlassButton } from '@hominio/brand';

	const authClient = createAuthClient();
	const session = authClient.useSession();

	let activeTab = $state<'granted' | 'pending'>('granted');
	let capabilities = $state<Capability[]>([]);
	let requests = $state<CapabilityRequest[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function loadCapabilities() {
		try {
			const response = await fetch('/api/auth/capabilities', {
				credentials: 'include',
			});
			if (!response.ok) {
				throw new Error('Failed to load capabilities');
			}
			const data = await response.json();
			capabilities = data.capabilities || [];
		} catch (err) {
			console.error('Error loading capabilities:', err);
			error = err instanceof Error ? err.message : 'Failed to load capabilities';
		}
	}

	async function loadRequests() {
		try {
			const response = await fetch('/api/auth/capabilities/requests?status=pending', {
				credentials: 'include',
			});
			if (!response.ok) {
				throw new Error('Failed to load requests');
			}
			const data = await response.json();
			requests = data.requests || [];
		} catch (err) {
			console.error('Error loading requests:', err);
			error = err instanceof Error ? err.message : 'Failed to load requests';
		}
	}

	async function revokeCapability(capabilityId: string) {
		try {
			const response = await fetch(`/api/auth/capabilities/${capabilityId}`, {
				method: 'DELETE',
				credentials: 'include',
			});
			if (!response.ok) {
				throw new Error('Failed to revoke capability');
			}
			// Reload capabilities
			await loadCapabilities();
		} catch (err) {
			console.error('Error revoking capability:', err);
			error = err instanceof Error ? err.message : 'Failed to revoke capability';
		}
	}

	onMount(async () => {
		loading = true;
		await Promise.all([loadCapabilities(), loadRequests()]);
		loading = false;
	});
</script>

<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
	<div class="mx-auto max-w-4xl">
		<h1 class="mb-8 text-4xl font-bold text-white">Capability Management</h1>

		<!-- Tabs -->
		<div class="mb-6 flex gap-4 border-b border-white/10">
			<button
				onclick={() => (activeTab = 'granted')}
				class="px-4 py-2 font-medium transition-colors {activeTab === 'granted'
					? 'border-b-2 border-cyan-400 text-cyan-400'
					: 'text-white/60 hover:text-white'}"
			>
				My Capabilities ({capabilities.length})
			</button>
			<button
				onclick={() => (activeTab = 'pending')}
				class="px-4 py-2 font-medium transition-colors {activeTab === 'pending'
					? 'border-b-2 border-cyan-400 text-cyan-400'
					: 'text-white/60 hover:text-white'}"
			>
				Pending Requests ({requests.length})
			</button>
		</div>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<LoadingSpinner variant="white" size="h-10 w-10" />
			</div>
		{:else if error}
			<DarkGlassCard class="bg-red-500/20 p-4 text-red-400">
				{error}
			</DarkGlassCard>
		{:else if activeTab === 'granted'}
			<!-- My Capabilities Tab -->
			<div class="space-y-4">
				{#if capabilities.length === 0}
					<DarkGlassCard class="p-8 text-center text-white/60">
						No capabilities granted yet.
					</DarkGlassCard>
				{:else}
					{#each capabilities as capability}
						<DarkGlassCard class="p-6">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="mb-2 flex items-center gap-2">
										<span class="text-sm font-medium text-white/60">Principal:</span>
										<span class="text-white">{capability.principal}</span>
									</div>
									<div class="mb-2 flex items-center gap-2">
										<span class="text-sm font-medium text-white/60">Resource:</span>
										<span class="text-white">
											{capability.resource.type}:{capability.resource.namespace}
											{capability.resource.id ? `:${capability.resource.id}` : ''}
											{capability.resource.device_id ? ` (device: ${capability.resource.device_id})` : ''}
										</span>
									</div>
									<div class="mb-2 flex items-center gap-2">
										<span class="text-sm font-medium text-white/60">Actions:</span>
										<span class="text-white">{capability.actions.join(', ')}</span>
									</div>
									<div class="text-sm text-white/40">
										Granted: {new Date(capability.created_at).toLocaleString()}
									</div>
								</div>
								<GlassButton variant="danger" onclick={() => revokeCapability(capability.id)} class="px-4 py-2 text-sm">
									Revoke
								</GlassButton>
							</div>
						</DarkGlassCard>
					{/each}
				{/if}
			</div>
		{:else}
			<!-- Pending Requests Tab -->
			<div class="space-y-4">
				{#if requests.length === 0}
					<DarkGlassCard class="p-8 text-center text-white/60">
						No pending requests.
					</DarkGlassCard>
				{:else}
					{#each requests as request}
						<DarkGlassCard class="p-6">
							<div class="mb-4">
								<div class="mb-2 flex items-center gap-2">
									<span class="text-sm font-medium text-white/60">Requester:</span>
									<span class="text-white">{request.requester_principal}</span>
								</div>
								<div class="mb-2 flex items-center gap-2">
									<span class="text-sm font-medium text-white/60">Resource:</span>
									<span class="text-white">
										{request.resource.type}:{request.resource.namespace}
										{request.resource.id ? `:${request.resource.id}` : ''}
										{request.resource.device_id ? ` (device: ${request.resource.device_id})` : ''}
									</span>
								</div>
								<div class="mb-2 flex items-center gap-2">
									<span class="text-sm font-medium text-white/60">Actions:</span>
									<span class="text-white">{request.actions.join(', ')}</span>
								</div>
								{#if request.message}
									<div class="mb-2 text-sm text-white/60">
										<strong>Message:</strong> {request.message}
									</div>
								{/if}
								<div class="text-sm text-white/40">
									Requested: {new Date(request.created_at).toLocaleString()}
								</div>
							</div>
							<div class="flex gap-3">
								<a
									href="/capabilities/requests/{request.id}"
									class="inline-block"
								>
									<GlassButton variant="navy" class="px-4 py-2 text-sm">
										Review Request
									</GlassButton>
								</a>
							</div>
						</DarkGlassCard>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>

