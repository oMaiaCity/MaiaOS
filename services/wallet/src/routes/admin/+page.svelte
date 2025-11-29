<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import { GlassCard, GlassButton, LoadingSpinner, ProfileImage } from "@hominio/brand";
    import type { CapabilityRequest, Capability } from "@hominio/caps";

    interface RequestWithUserInfo extends CapabilityRequest {
        userInfo?: {
            id: string;
            name: string | null;
            email: string | null;
            image: string | null;
        };
    }

    interface CapabilityWithUserInfo extends Capability {
        userInfo?: {
            id: string;
            name: string | null;
            email: string | null;
            image: string | null;
        };
    }

    type TabType = 'pending' | 'granted' | 'groups';

    let { data } = $props();
    let requests = $state<RequestWithUserInfo[]>(data.requests || []);
    let capabilities = $state<CapabilityWithUserInfo[]>(data.capabilities || []);
    let capabilityGroups = $state<any[]>([]);
    let activeTab = $state<TabType>('pending');
    let loading = $state(false);
    let error = $state<string | null>(null);
    let now = $state(new Date());
    
    // Update time every second for expiration countdown
    $effect(() => {
        const interval = setInterval(() => {
            now = new Date();
        }, 1000);
        return () => clearInterval(interval);
    });
    
    function formatExpirationTime(expiresAt: string): { value: number; unit: 'd' | 'h' | 'm' | 's' } {
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
    
    function getExpirationDate(expiresAt: string): Date {
        return new Date(expiresAt);
    }

    // Get wallet domain for API calls
    function getWalletUrl(): string {
        const isProduction = typeof window !== "undefined" && window.location.hostname !== "localhost" && !window.location.hostname.startsWith("127.0.0.1");
        let walletDomain = import.meta.env.PUBLIC_DOMAIN_WALLET;
        if (!walletDomain) {
            if (isProduction) {
                const hostname = window.location.hostname;
                // If already on wallet domain, use it directly
                if (hostname.startsWith("wallet.")) {
                    walletDomain = hostname;
                } else if (hostname.startsWith("app.")) {
                    walletDomain = hostname.replace("app.", "wallet.");
                } else {
                    // Extract root domain and prepend wallet.
                    const rootDomain = hostname.replace(/^www\./, "");
                    walletDomain = `wallet.${rootDomain}`;
                }
            } else {
                walletDomain = "localhost:4201";
            }
        }
        walletDomain = walletDomain.replace(/^https?:\/\//, "");
        const protocol = walletDomain.startsWith("localhost") || walletDomain.startsWith("127.0.0.1") ? "http" : "https";
        return `${protocol}://${walletDomain}`;
    }

    async function addHotelCapability(groupId: string) {
        loading = true;
        error = null;
        try {
            const walletUrl = getWalletUrl();
            const response = await fetch(`${walletUrl}/api/admin/capability-groups/hominio-explorer/add-hotel-capability`, {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to add hotel capability");
            }

            const data = await response.json();
            
            // Refresh groups to show the new capability
            await refreshRequests();
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
            console.error("[Admin] Error adding hotel capability:", err);
        } finally {
            loading = false;
        }
    }

    async function refreshRequests() {
        loading = true;
        error = null;
        try {
            const walletUrl = getWalletUrl();
            
            // Fetch requests, capabilities, and groups
            const [requestsResponse, capabilitiesResponse, groupsResponse] = await Promise.all([
                fetch(`${walletUrl}/api/admin/capability-requests`, {
                    credentials: "include",
                }),
                fetch(`${walletUrl}/api/admin/capabilities`, {
                    credentials: "include",
                }),
                fetch(`${walletUrl}/api/admin/capability-groups`, {
                    credentials: "include",
                }),
            ]);

            if (!requestsResponse.ok) {
                throw new Error("Failed to fetch requests");
            }
            if (!capabilitiesResponse.ok) {
                throw new Error("Failed to fetch capabilities");
            }
            if (!groupsResponse.ok) {
                throw new Error("Failed to fetch capability groups");
            }

            const requestsData = await requestsResponse.json();
            const capabilitiesData = await capabilitiesResponse.json();
            const groupsData = await groupsResponse.json();
            
            requests = requestsData.requests || [];
            capabilityGroups = groupsData.groups || [];
            
            // Ensure capabilities have user info structure
            capabilities = (capabilitiesData.capabilities || []).map((cap: any) => {
                // If userInfo is already present, use it; otherwise create default structure
                if (cap.userInfo) {
                    return cap;
                }
                const match = cap.principal.match(/^user:(.+)$/);
                const userId = match ? match[1] : null;
                return {
                    ...cap,
                    userInfo: {
                        id: userId || cap.principal,
                        name: null,
                        email: null,
                        image: null,
                    },
                };
            });
            
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
            console.error("[Admin] Error fetching data:", err);
        } finally {
            loading = false;
        }
    }

    async function approveRequest(requestId: string) {
        loading = true;
        error = null;
        try {
            const walletUrl = getWalletUrl();
            const response = await fetch(`${walletUrl}/api/admin/capability-requests/${requestId}/approve`, {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to approve request");
            }

            const data = await response.json();
            
            // Show success message with expiration info
            if (data.expiresAt) {
                const expiresDate = new Date(data.expiresAt);
                const expiresIn = formatExpirationTime(data.expiresAt);
            }

            // Refresh requests
            await refreshRequests();
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
            console.error("[Admin] Error approving request:", err);
        } finally {
            loading = false;
        }
    }

    async function rejectRequest(requestId: string) {
        loading = true;
        error = null;
        try {
            const walletUrl = getWalletUrl();
            const response = await fetch(`${walletUrl}/api/admin/capability-requests/${requestId}/reject`, {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to reject request");
            }

            // Refresh requests
            await refreshRequests();
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
            console.error("[Admin] Error rejecting request:", err);
        } finally {
            loading = false;
        }
    }

    async function revokeCapability(capabilityId: string) {
        if (!confirm("Are you sure you want to revoke this capability?")) {
            return;
        }

        loading = true;
        error = null;
        try {
            const walletUrl = getWalletUrl();
            const response = await fetch(`${walletUrl}/api/admin/capabilities/${capabilityId}/revoke`, {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to revoke capability");
            }

            // Refresh capabilities
            await refreshRequests();
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
            console.error("[Admin] Error revoking capability:", err);
        } finally {
            loading = false;
        }
    }

    function formatResource(resource: CapabilityRequest["resource"]): string {
        if (resource.id) {
            return `${resource.type}:${resource.namespace}:${resource.id}`;
        }
        return `${resource.type}:${resource.namespace}:*`;
    }

    function extractUserId(principal: string): string {
        const match = principal.match(/^user:(.+)$/);
        return match ? match[1] : principal;
    }

    onMount(() => {
        refreshRequests();
    });
</script>

<div class="pt-6 pb-12 min-h-screen bg-glass-gradient">
    <div class="container px-4 mx-auto max-w-5xl">
        <div class="mb-8">
            <h1 class="mb-2 text-4xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
            <p class="text-slate-600">Manage capability requests and granted capabilities</p>
        </div>

        <!-- Tab Navigation -->
        <div class="flex gap-2 mb-6 border-b border-slate-200">
            <button
                onclick={() => activeTab = 'pending'}
                class="tab-button"
                class:active={activeTab === 'pending'}
            >
                Pending Requests
                {#if requests.length > 0}
                    <span class="tab-badge">{requests.length}</span>
                {/if}
            </button>
            <button
                onclick={() => activeTab = 'granted'}
                class="tab-button"
                class:active={activeTab === 'granted'}
            >
                Granted Capabilities
                {#if capabilities.length > 0}
                    <span class="tab-badge">{capabilities.length}</span>
                {/if}
            </button>
            <button
                onclick={() => activeTab = 'groups'}
                class="tab-button"
                class:active={activeTab === 'groups'}
            >
                Capability Groups
                {#if capabilityGroups.length > 0}
                    <span class="tab-badge">{capabilityGroups.length}</span>
                {/if}
            </button>
        </div>

        {#if error}
            <GlassCard class="p-6 mb-6">
                <div class="text-center">
                    <p class="font-medium text-red-600">Error</p>
                    <p class="mt-2 text-sm text-slate-500">{error}</p>
                </div>
            </GlassCard>
        {/if}

        {#if activeTab === 'pending'}
            {#if loading && requests.length === 0}
                <div class="flex justify-center items-center py-12">
                    <LoadingSpinner />
                    <p class="ml-4 text-sm font-medium text-slate-500">Loading requests...</p>
                </div>
            {:else if requests.length === 0}
                <GlassCard class="p-8 text-center">
                    <p class="text-slate-600">No pending requests.</p>
                </GlassCard>
            {:else}
            <div class="space-y-3">
                {#each requests as request (request.id)}
                    <GlassCard class="admin-request-card">
                        <div class="admin-request-header">
                            <!-- Left: User Profile Column -->
                            <div class="admin-request-user-column">
                                {#if request.userInfo?.image}
                                    <ProfileImage
                                        src={request.userInfo.image}
                                        name={request.userInfo.name || ''}
                                        email={request.userInfo.email || ''}
                                        size="sm"
                                        class="admin-profile-image admin-profile-image-small"
                                    />
                                {:else}
                                    <div class="admin-user-avatar">
                                        {request.userInfo?.name?.[0]?.toUpperCase() || extractUserId(request.requester_principal)[0]?.toUpperCase() || '?'}
                                    </div>
                                {/if}
                                <p class="admin-user-name">{request.userInfo?.name || 'Unknown User'}</p>
                                <span class="admin-status-badge pending">Pending</span>
                            </div>
                            
                            <!-- Middle: Title and Description -->
                            <div class="admin-request-title-section">
                                <h3 class="admin-request-title">Voice Assistant Access</h3>
                                {#if request.message}
                                    <p class="admin-request-description">
                                        {request.message} - REQUESTED {new Date(request.created_at).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                                    </p>
                                {:else}
                                    <p class="admin-request-description">
                                        Requesting access to voice assistant - REQUESTED {new Date(request.created_at).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                                    </p>
                                {/if}
                            </div>
                            
                            <!-- Right: Metadata -->
                            <div class="admin-request-metadata">
                                <div class="flex gap-2 justify-end items-center">
                                    <p class="font-mono text-xs text-slate-900">{formatResource(request.resource)}</p>
                                    <span class="text-xs font-semibold tracking-wider uppercase text-slate-400">Resource</span>
                                </div>
                                <div class="flex gap-2 justify-end items-center">
                                    <div class="flex gap-1">
                                        {#each request.actions as action}
                                            <span class="inline-block px-1.5 py-0.5 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">
                                                {action}
                                            </span>
                                        {/each}
                                    </div>
                                    <span class="text-xs font-semibold tracking-wider uppercase text-slate-400">Actions</span>
                                </div>
                            </div>
                            
                            <!-- Right: Expiration Warning (Full Height, Same Style as My Capabilities) -->
                            <div class="admin-request-expiration">
                                <div class="admin-expiration-value">
                                    <span class="admin-expiration-time">
                                        <span class="admin-expiration-number">1</span>
                                        <span class="admin-expiration-unit">d</span>
                                    </span>
                                    <span class="admin-expiration-label">when approved</span>
                                </div>
                            </div>
                            
                            <!-- Right: Action Buttons -->
                            <div class="admin-request-actions">
                                <GlassButton
                                    variant="navy"
                                    onclick={() => approveRequest(request.id)}
                                    disabled={loading}
                                    class="admin-action-button approve"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                </GlassButton>
                                <GlassButton
                                    variant="danger"
                                    onclick={() => rejectRequest(request.id)}
                                    disabled={loading}
                                    class="admin-action-button reject"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </GlassButton>
                            </div>
                        </div>
                    </GlassCard>
                {/each}
            </div>
            {/if}
        {:else if activeTab === 'granted'}
            {#if loading && capabilities.length === 0}
                <div class="flex justify-center items-center py-12">
                    <LoadingSpinner />
                    <p class="ml-4 text-sm font-medium text-slate-500">Loading capabilities...</p>
                </div>
            {:else if capabilities.length === 0}
                <GlassCard class="p-8 text-center">
                    <p class="text-slate-600">No granted capabilities.</p>
                </GlassCard>
            {:else}
                <div class="space-y-3">
                    {#each capabilities as capability (capability.id)}
                        <GlassCard class="admin-capability-card">
                            <div class="admin-capability-header">
                                <!-- Left: User Profile Column -->
                                <div class="admin-capability-user-column">
                                    {#if capability.userInfo?.image}
                                        <ProfileImage
                                            src={capability.userInfo.image}
                                            name={capability.userInfo.name || ''}
                                            email={capability.userInfo.email || ''}
                                            size="sm"
                                            class="admin-profile-image admin-profile-image-small"
                                        />
                                    {:else}
                                        <div class="admin-user-avatar">
                                            {capability.userInfo?.name?.[0]?.toUpperCase() || extractUserId(capability.principal)[0]?.toUpperCase() || '?'}
                                        </div>
                                    {/if}
                                    <p class="admin-user-name">{capability.userInfo?.name || 'Unknown User'}</p>
                                    <span class="admin-status-badge granted">Granted</span>
                                </div>
                                
                                <!-- Middle: Title and Description -->
                                <div class="admin-capability-title-section">
                                    <div class="flex gap-2 items-center mb-1">
                                        {#if capability.title}
                                            <h3 class="admin-capability-title">{capability.title}</h3>
                                        {/if}
                                        {#if capability.metadata?.isGroupCapability}
                                            <span class="inline-block px-2 py-0.5 text-xs font-medium text-purple-800 bg-purple-100 rounded-full">
                                                Group: {capability.metadata.groupTitle || capability.metadata.group}
                                            </span>
                                        {/if}
                                    </div>
                                    {#if capability.description}
                                        <p class="admin-capability-description">
                                            {capability.description} - GRANTED {new Date(capability.created_at).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                                        </p>
                                    {:else}
                                        <p class="admin-capability-description">
                                            No description - GRANTED {new Date(capability.created_at).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })}
                                        </p>
                                    {/if}
                                </div>
                                
                                <!-- Right: All Metadata -->
                                <div class="admin-capability-metadata">
                                    <div class="flex gap-2 justify-end items-center">
                                        <p class="font-mono text-xs text-slate-900">{formatResource(capability.resource)}</p>
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
                                    {@const expiration = formatExpirationTime(capability.conditions.expiresAt)}
                                    <div class="admin-capability-expiration">
                                        <div class="admin-expiration-value">
                                            <span class="admin-expiration-time">
                                                <span class="admin-expiration-number">{expiration.value}</span>
                                                <span class="admin-expiration-unit">{expiration.unit}</span>
                                            </span>
                                            <span class="admin-expiration-label">expires in</span>
                                        </div>
                                    </div>
                                {/if}
                                
                                <!-- Right: Revoke Button -->
                                <div class="admin-capability-actions">
                                    <GlassButton
                                        variant="danger"
                                        onclick={() => revokeCapability(capability.id)}
                                        disabled={loading}
                                        class="admin-revoke-button"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </GlassButton>
                                </div>
                            </div>
                        </GlassCard>
                    {/each}
                </div>
            {/if}
        {:else if activeTab === 'groups'}
            {#if loading && capabilityGroups.length === 0}
                <div class="flex justify-center items-center py-12">
                    <LoadingSpinner />
                    <p class="ml-4 text-sm font-medium text-slate-500">Loading groups...</p>
                </div>
            {:else if capabilityGroups.length === 0}
                <GlassCard class="p-8 text-center">
                    <p class="text-slate-600">No capability groups found.</p>
                </GlassCard>
            {:else}
                <div class="space-y-4">
                    {#each capabilityGroups as group (group.id)}
                        <GlassCard class="p-6">
                            <div class="mb-4">
                                <div class="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 class="mb-1 text-xl font-bold text-slate-900">{group.title}</h3>
                                        <p class="text-sm text-slate-600">{group.description || 'No description'}</p>
                                        <p class="mt-1 text-xs text-slate-500">Group: {group.name}</p>
                                    </div>
                                    {#if group.name === 'hominio-explorer'}
                                        <button
                                            onclick={() => addHotelCapability(group.id)}
                                            disabled={loading}
                                            class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Add Hotel Capability
                                        </button>
                                    {/if}
                                </div>
                            </div>
                            
                            <div class="pt-4 border-t border-slate-200">
                                <h4 class="mb-3 text-sm font-semibold text-slate-700">Sub-capabilities ({group.members.length})</h4>
                                {#if group.members.length === 0}
                                    <p class="text-sm text-slate-500">No capabilities in this group yet.</p>
                                {:else}
                                    <div class="space-y-2">
                                        {#each group.members as member (member.id)}
                                            <div class="flex justify-between items-center p-3 rounded-lg bg-slate-50">
                                                <div>
                                                    <p class="text-sm font-medium text-slate-900">{member.title || 'Untitled Capability'}</p>
                                                    <p class="font-mono text-xs text-slate-600">
                                                        {member.resource_type}:{member.resource_namespace}{member.resource_id ? `:${member.resource_id}` : ''}
                                                    </p>
                                                </div>
                                                <div class="flex gap-1">
                                                    {#each member.actions as action}
                                                        <span class="inline-block px-2 py-0.5 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">
                                                            {action}
                                                        </span>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        </GlassCard>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .tab-button {
        padding: 0.75rem 1.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-slate-600);
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        position: relative;
    }
    
    .tab-button:hover {
        color: var(--color-slate-900);
    }
    
    .tab-button.active {
        color: var(--color-primary-700);
        border-bottom-color: var(--color-primary-700);
    }
    
    .tab-badge {
        background: var(--color-primary-100);
        color: var(--color-primary-700);
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        min-width: 1.5rem;
        text-align: center;
    }
    
    .tab-button.active .tab-badge {
        background: var(--color-primary-700);
        color: white;
    }
    
    /* Admin Capability Card - Compact Design */
    .admin-capability-card {
        padding: 0;
        overflow: hidden;
        min-height: 72px;
    }
    
    .admin-capability-header {
        display: flex;
        align-items: stretch;
        width: 100%;
    }
    
    .admin-capability-title-section {
        flex: 1;
        min-width: 0;
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.25rem;
    }
    
    .admin-capability-title {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--color-primary-700);
        line-height: 1.25;
        margin: 0;
    }
    
    .admin-capability-description {
        font-size: 0.875rem;
        color: #64748b;
        line-height: 1.5;
        margin: 0;
    }
    
    .admin-capability-metadata {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.25rem;
        padding: 1rem 1.25rem;
        border-left: 1px solid rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
    }
    
    .admin-capability-expiration {
        display: flex;
        align-items: stretch;
        justify-content: stretch;
        background: var(--color-warning-100);
        border-left: 1px solid var(--color-warning-300);
        min-width: 120px;
    }
    
    .admin-expiration-value {
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
    
    .admin-expiration-time {
        display: flex;
        align-items: baseline;
        gap: 0.125rem;
        line-height: 1;
    }
    
    .admin-expiration-number {
        font-size: 1.5rem;
        line-height: 1;
    }
    
    .admin-expiration-unit {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-warning-700);
        text-transform: lowercase;
    }
    
    .admin-expiration-label {
        font-size: 0.75rem;
        font-weight: 400;
        color: var(--color-warning-600);
        text-transform: lowercase;
    }
    
    .admin-capability-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem 1.25rem;
        border-left: 1px solid rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
    }
    
    .admin-revoke-button {
        padding: 0.5rem;
        min-width: auto;
    }
    
    /* Admin Request Card - Compact Design */
    .admin-request-card {
        padding: 0;
        overflow: hidden;
        min-height: 72px;
    }
    
    .admin-request-header {
        display: flex;
        align-items: stretch;
        width: 100%;
    }
    
    /* User Column (Left) */
    .admin-request-user-column,
    .admin-capability-user-column {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1rem 0.875rem;
        border-right: 1px solid rgba(0, 0, 0, 0.1);
        min-width: 90px;
        flex-shrink: 0;
        gap: 0.375rem;
    }
    
    .admin-user-avatar {
        width: 1rem;
        height: 1rem;
        border-radius: 9999px;
        background: linear-gradient(to bottom right, #60a5fa, #a78bfa);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 0.5rem;
    }
    
    /* Make ProfileImage smaller in admin columns - override all Tailwind classes */
    /* Target the root ProfileImage component wrapper */
    .admin-request-user-column :global(.admin-profile-image-small),
    .admin-capability-user-column :global(.admin-profile-image-small) {
        width: 2rem !important;
        height: 2rem !important;
        min-width: 2rem !important;
        min-height: 2rem !important;
        max-width: 2rem !important;
        max-height: 2rem !important;
    }
    
    /* Override the wrapper div (frame) - ProfileImage root div with Tailwind classes */
    .admin-request-user-column :global(.admin-profile-image-small.h-16),
    .admin-request-user-column :global(.admin-profile-image-small.w-16),
    .admin-capability-user-column :global(.admin-profile-image-small.h-16),
    .admin-capability-user-column :global(.admin-profile-image-small.w-16) {
        width: 2rem !important;
        height: 2rem !important;
        min-width: 2rem !important;
        min-height: 2rem !important;
        max-width: 2rem !important;
        max-height: 2rem !important;
        padding: 0.125rem !important;
    }
    
    /* Override the image inside - target img with Tailwind classes */
    .admin-request-user-column :global(.admin-profile-image-small img.h-16),
    .admin-request-user-column :global(.admin-profile-image-small img.w-16),
    .admin-capability-user-column :global(.admin-profile-image-small img.h-16),
    .admin-capability-user-column :global(.admin-profile-image-small img.w-16) {
        width: 1.75rem !important;
        height: 1.75rem !important;
        min-width: 1.75rem !important;
        min-height: 1.75rem !important;
        max-width: 1.75rem !important;
        max-height: 1.75rem !important;
    }
    
    /* Override fallback div - target div with Tailwind classes */
    .admin-request-user-column :global(.admin-profile-image-small > div > div.h-16),
    .admin-request-user-column :global(.admin-profile-image-small > div > div.w-16),
    .admin-capability-user-column :global(.admin-profile-image-small > div > div.h-16),
    .admin-capability-user-column :global(.admin-profile-image-small > div > div.w-16) {
        width: 1.75rem !important;
        height: 1.75rem !important;
        min-width: 1.75rem !important;
        min-height: 1.75rem !important;
        max-width: 1.75rem !important;
        max-height: 1.75rem !important;
        font-size: 0.625rem !important;
        line-height: 1.75rem !important;
    }
    
    /* Override text size classes in fallback */
    .admin-request-user-column :global(.admin-profile-image-small .text-2xl),
    .admin-capability-user-column :global(.admin-profile-image-small .text-2xl) {
        font-size: 0.625rem !important;
        line-height: 1.75rem !important;
    }
    
    .admin-user-name {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-slate-900);
        text-align: center;
        margin: 0;
        line-height: 1.2;
    }
    
    .admin-status-badge {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 0.25rem 0.5rem;
        border-radius: 9999px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    
    .admin-status-badge.pending {
        background: var(--color-warning-100);
        color: var(--color-warning-800);
    }
    
    .admin-status-badge.granted {
        background: var(--color-success-100);
        color: var(--color-success-800);
    }
    
    /* Request Title Section */
    .admin-request-title-section {
        flex: 1;
        min-width: 0;
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.25rem;
    }
    
    .admin-request-title {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--color-primary-700);
        line-height: 1.25;
        margin: 0;
    }
    
    .admin-request-description {
        font-size: 0.875rem;
        color: #64748b;
        line-height: 1.5;
        margin: 0;
    }
    
    /* Request Metadata */
    .admin-request-metadata {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.25rem;
        padding: 1rem 1.25rem;
        border-left: 1px solid rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
    }
    
    /* Request Expiration (Full Height, Same Style as My Capabilities) */
    .admin-request-expiration {
        display: flex;
        align-items: stretch;
        justify-content: stretch;
        background: var(--color-warning-100);
        border-left: 1px solid var(--color-warning-300);
        min-width: 120px;
    }
    
    .admin-expiration-value {
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
    
    .admin-expiration-time {
        display: flex;
        align-items: baseline;
        gap: 0.125rem;
        line-height: 1;
    }
    
    .admin-expiration-number {
        font-size: 1.5rem;
        line-height: 1;
    }
    
    .admin-expiration-unit {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-warning-700);
        text-transform: lowercase;
    }
    
    .admin-expiration-label {
        font-size: 0.75rem;
        font-weight: 400;
        color: var(--color-warning-600);
        text-transform: lowercase;
    }
    
    /* Request Actions */
    .admin-request-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1rem 1.25rem;
        border-left: 1px solid rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
    }
    
    .admin-action-button {
        padding: 0.5rem;
        min-width: auto;
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    /* Mobile Responsive Styles */
    @media (max-width: 768px) {
        .admin-request-header,
        .admin-capability-header {
            flex-direction: column;
        }
        
        /* User Column - Horizontal on Mobile */
        .admin-request-user-column,
        .admin-capability-user-column {
            flex-direction: row;
            justify-content: flex-start;
            align-items: center;
            padding: 0.75rem 1rem;
            border-right: none;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            min-width: auto;
            width: 100%;
            gap: 0.75rem;
        }
        
        .admin-user-name {
            flex: 1;
            text-align: left;
            font-size: 0.875rem;
        }
        
        /* Title Section - Full Width on Mobile */
        .admin-request-title-section,
        .admin-capability-title-section {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        
        .admin-request-title,
        .admin-capability-title {
            font-size: 1rem;
        }
        
        .admin-request-description,
        .admin-capability-description {
            font-size: 0.8125rem;
        }
        
        /* Metadata - Stacked on Mobile */
        .admin-request-metadata,
        .admin-capability-metadata {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            border-left: none;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            justify-content: flex-start;
        }
        
        .admin-request-metadata > div,
        .admin-capability-metadata > div {
            flex-direction: row;
            gap: 0.5rem;
        }
        
        /* Expiration - Full Width on Mobile */
        .admin-request-expiration,
        .admin-capability-expiration {
            min-width: auto;
            width: 100%;
            border-left: none;
            border-bottom: 1px solid var(--color-warning-300);
        }
        
        .admin-expiration-value {
            padding: 0.75rem 1rem;
        }
        
        .admin-expiration-number {
            font-size: 1.25rem;
        }
        
        /* Actions - Horizontal on Mobile */
        .admin-request-actions,
        .admin-capability-actions {
            flex-direction: row;
            justify-content: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            border-left: none;
        }
        
        .admin-action-button,
        .admin-revoke-button {
            width: 2.25rem;
            height: 2.25rem;
        }
        
        /* Container adjustments */
        .container {
            padding-left: 0.75rem;
            padding-right: 0.75rem;
        }
        
        /* Tab buttons - smaller on mobile */
        .tab-button {
            padding: 0.5rem 1rem;
            font-size: 0.8125rem;
        }
        
        /* Header adjustments */
        h1 {
            font-size: 2rem;
        }
    }
    
    /* Very small screens */
    @media (max-width: 480px) {
        .admin-request-title,
        .admin-capability-title {
            font-size: 0.9375rem;
        }
        
        .admin-request-description,
        .admin-capability-description {
            font-size: 0.75rem;
        }
        
        .admin-user-name {
            font-size: 0.8125rem;
        }
        
        .admin-expiration-number {
            font-size: 1.125rem;
        }
        
        .admin-expiration-unit,
        .admin-expiration-label {
            font-size: 0.6875rem;
        }
    }
</style>

