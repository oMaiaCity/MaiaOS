<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { createAuthClient } from '@hominio/auth';
	import type { CapabilityRequest } from '@hominio/caps';
	import { DarkGlassCard, LoadingSpinner, GlassButton } from '@hominio/brand';

	const authClient = createAuthClient();
	const session = authClient.useSession();

	let request: CapabilityRequest | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let processing = $state(false);

	async function loadRequest() {
		try {
			const requestId = $page.params.id;
			const response = await fetch(`/api/auth/capabilities/requests?status=pending`, {
				credentials: 'include',
			});
			if (!response.ok) {
				throw new Error('Failed to load request');
			}
			const data = await response.json();
			const found = data.requests.find((r: CapabilityRequest) => r.id === requestId);
			if (!found) {
				throw new Error('Request not found');
			}
			request = found;
		} catch (err) {
			console.error('Error loading request:', err);
			error = err instanceof Error ? err.message : 'Failed to load request';
		} finally {
			loading = false;
		}
	}

	async function approve() {
		if (!request) return;
		processing = true;
		try {
			const callbackUrl = new URL($page.url.searchParams.get('callback') || '', window.location.origin);
			const response = await fetch(`/api/auth/capabilities/requests/${request.id}/approve?callback=${encodeURIComponent(callbackUrl.toString())}`, {
				method: 'POST',
				credentials: 'include',
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to approve request');
			}
			// If callback URL provided, redirect will happen server-side
			// Otherwise, redirect back to capabilities page
			if (!callbackUrl.toString().includes(window.location.origin)) {
				window.location.href = '/capabilities';
			}
		} catch (err) {
			console.error('Error approving request:', err);
			error = err instanceof Error ? err.message : 'Failed to approve request';
			processing = false;
		}
	}

	async function reject() {
		if (!request) return;
		processing = true;
		try {
			const callbackUrl = new URL($page.url.searchParams.get('callback') || '', window.location.origin);
			const response = await fetch(`/api/auth/capabilities/requests/${request.id}/reject?callback=${encodeURIComponent(callbackUrl.toString())}`, {
				method: 'POST',
				credentials: 'include',
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to reject request');
			}
			// If callback URL provided, redirect will happen server-side
			// Otherwise, redirect back to capabilities page
			if (!callbackUrl.toString().includes(window.location.origin)) {
				window.location.href = '/capabilities';
			}
		} catch (err) {
			console.error('Error rejecting request:', err);
			error = err instanceof Error ? err.message : 'Failed to reject request';
			processing = false;
		}
	}

	onMount(() => {
		loadRequest();
	});
</script>

<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
	<div class="mx-auto max-w-2xl">
		<h1 class="mb-8 text-4xl font-bold text-white">Review Capability Request</h1>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<LoadingSpinner variant="white" size="h-10 w-10" />
			</div>
		{:else if error}
			<DarkGlassCard class="bg-red-500/20 p-4 text-red-400">
				{error}
			</DarkGlassCard>
		{:else if request}
			<DarkGlassCard class="p-6">
				<div class="mb-6 space-y-4">
					<div>
						<div class="mb-1 text-sm font-medium text-white/60">Requester</div>
						<div class="text-white">{request.requester_principal}</div>
					</div>
					<div>
						<div class="mb-1 text-sm font-medium text-white/60">Resource</div>
						<div class="text-white">
							{request.resource.type}:{request.resource.namespace}
							{request.resource.id ? `:${request.resource.id}` : ''}
							{request.resource.device_id ? ` (device: ${request.resource.device_id})` : ''}
						</div>
					</div>
					<div>
						<div class="mb-1 text-sm font-medium text-white/60">Requested Actions</div>
						<div class="flex flex-wrap gap-2">
							{#each request.actions as action}
								<span class="rounded bg-cyan-500/20 px-2 py-1 text-sm text-cyan-400">{action}</span>
							{/each}
						</div>
					</div>
					{#if request.message}
						<div>
							<div class="mb-1 text-sm font-medium text-white/60">Message</div>
							<div class="text-white">{request.message}</div>
						</div>
					{/if}
					<div class="text-sm text-white/40">
						Requested: {new Date(request.created_at).toLocaleString()}
					</div>
				</div>

				<div class="flex gap-3">
					<GlassButton variant="navy" onclick={approve} disabled={processing} class="flex-1 px-6 py-3">
						{processing ? 'Processing...' : 'Approve'}
					</GlassButton>
					<GlassButton variant="danger" onclick={reject} disabled={processing} class="flex-1 px-6 py-3">
						{processing ? 'Processing...' : 'Reject'}
					</GlassButton>
				</div>
			</DarkGlassCard>
		{/if}
	</div>
</div>

