<script lang="ts">
  interface PendingRequest {
    requestId: string;
    message: string;
    timestamp: number;
  }

  let pendingRequests = $state<PendingRequest[]>([]);
  let isLoading = $state(false);

  // Load pending requests on mount
  async function loadPendingRequests() {
    try {
      isLoading = true;
      const response = await browser.runtime.sendMessage({ type: 'get-pending-requests' });
      if (response?.requests) {
        pendingRequests = response.requests;
      }
    } catch (error) {
      console.error('Error loading pending requests:', error);
    } finally {
      isLoading = false;
    }
  }

  // Approve a signing request
  async function approveRequest(requestId: string) {
    try {
      await browser.runtime.sendMessage({
        type: 'approve-signing-request',
        requestId,
      });
      await loadPendingRequests(); // Reload to remove approved request
    } catch (error) {
      console.error('Error approving request:', error);
    }
  }

  // Reject a signing request
  async function rejectRequest(requestId: string) {
    try {
      await browser.runtime.sendMessage({
        type: 'reject-signing-request',
        requestId,
      });
      await loadPendingRequests(); // Reload to remove rejected request
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  }

  // Load on mount and listen for updates
  $effect(() => {
    loadPendingRequests();
    
    // Listen for updates from background script
    const messageListener = (message: any) => {
      if (message.type === 'requests-updated') {
        loadPendingRequests();
      }
    };
    
    browser.runtime.onMessage.addListener(messageListener);
    
    return () => {
      browser.runtime.onMessage.removeListener(messageListener);
    };
  });
</script>

<div class="popup-container">
  <main>
    <h1 class="title">Hominio Wallet</h1>

    {#if isLoading}
      <p class="loading">Loading...</p>
    {:else if pendingRequests.length === 0}
      <div class="empty-state">
        <p class="empty-text">No pending requests</p>
        <p class="empty-subtext">Signing requests from web pages will appear here</p>
      </div>
    {:else}
      <div class="requests-list">
        {#each pendingRequests as request (request.requestId)}
          <div class="request-card">
            <div class="request-header">
              <span class="request-label">Signing Request</span>
              <span class="request-time">{new Date(request.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="request-message">
              {request.message}
            </div>
            <div class="request-actions">
              <button class="btn-reject" onclick={() => rejectRequest(request.requestId)}>
                Reject
              </button>
              <button class="btn-approve" onclick={() => approveRequest(request.requestId)}>
                Approve
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  .popup-container {
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    background: linear-gradient(135deg, #0a1628 0%, #132a45 100%);
    color: #e2e8f0;
    box-sizing: border-box;
  }

  main {
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    margin: 0;
    box-sizing: border-box;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 1.5rem;
    text-align: center;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .loading {
    text-align: center;
    color: #94a3b8;
    padding: 2rem;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
  }

  .empty-text {
    font-size: 1.1rem;
    color: #cbd5e1;
    margin-bottom: 0.5rem;
  }

  .empty-subtext {
    font-size: 0.9rem;
    color: #94a3b8;
  }

  .requests-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .request-card {
    background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6e 100%);
    border: 1px solid rgba(100, 149, 237, 0.2);
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .request-card:hover {
    box-shadow: 0 8px 20px rgba(100, 149, 237, 0.2);
    border-color: rgba(100, 149, 237, 0.4);
    transform: translateY(-2px);
  }

  .request-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .request-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6495ed;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .request-time {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .request-message {
    font-size: 0.9rem;
    color: #e2e8f0;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(100, 149, 237, 0.15);
    border-radius: 4px;
    word-break: break-word;
    backdrop-filter: blur(10px);
  }

  .request-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn-reject,
  .btn-approve {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-reject {
    background: rgba(51, 65, 85, 0.8);
    color: #e2e8f0;
    border: 1px solid rgba(100, 149, 237, 0.2);
  }

  .btn-reject:hover {
    background: rgba(71, 85, 105, 0.9);
    border-color: rgba(100, 149, 237, 0.3);
    transform: translateY(-1px);
  }

  .btn-approve {
    background: linear-gradient(135deg, #4169e1 0%, #6495ed 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(65, 105, 225, 0.3);
  }

  .btn-approve:hover {
    background: linear-gradient(135deg, #3557c7 0%, #5280d8 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(65, 105, 225, 0.4);
  }
</style>
