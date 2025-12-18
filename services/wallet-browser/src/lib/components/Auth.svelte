<script lang="ts">
  import { usePasskeyAuth } from 'jazz-tools/svelte';
  import { AccountCoState } from 'jazz-tools/svelte';
  import { WalletAccount } from '../schema';
  
  const { children } = $props();
  
  let isLoggingIn = $state(false);
  let errorMessage = $state<string | null>(null);
  
  // Get logout from AccountCoState (matches working starter)
  const { logOut } = new AccountCoState(WalletAccount);
  
  // Use passkey auth hook with $derived (matches working starter pattern exactly)
  const { current, state: authState } = $derived(
    usePasskeyAuth({
      appName: 'Hominio Wallet',
    }),
  );
  
  const isAuthenticated = $derived(authState === 'signedIn');

  // Check if WebAuthn is available
  const isWebAuthnAvailable = typeof window !== 'undefined' && 
    typeof window.PublicKeyCredential !== 'undefined';
</script>

{#if isAuthenticated}
  <div class="auth-container">
    <div class="auth-header">
      <h2 class="auth-title">Hominio Wallet</h2>
      <button class="btn-logout" onclick={logOut}>
        Logout
      </button>
    </div>
    {@render children?.()}
  </div>
{:else}
  <div class="auth-container">
    <div class="auth-content">
      <h1 class="auth-title">Welcome to Hominio Wallet</h1>
      <p class="auth-subtitle">Create a passkey or log in with an existing one</p>
      
      <div class="auth-actions">
        {#if !isWebAuthnAvailable}
          <div class="error-message">
            Passkeys are not available in this browser context. Please use a supported browser.
          </div>
        {/if}
        {#if errorMessage}
          <div class="error-message">
            {errorMessage}
          </div>
        {/if}
        
        <!-- Sign up button (for first-time users) -->
        <button 
          class="btn-primary" 
          onclick={async () => {
            if (!isWebAuthnAvailable) {
              errorMessage = 'WebAuthn is not available in this context.';
              return;
            }
            isLoggingIn = true;
            errorMessage = null;
            try {
              console.log('Attempting passkey sign up...');
              // Sign up with descriptive name for better passkey identification
              await current.signUp('hominio-wallet');
              console.log('Sign up successful');
            } catch (error: any) {
              console.error('Sign up error:', error);
              if (error?.name === 'NotAllowedError' || error?.message?.includes('cancel')) {
                errorMessage = 'Sign up cancelled';
              } else {
                errorMessage = error?.message || 'Failed to create passkey. Please try again.';
              }
            } finally {
              isLoggingIn = false;
            }
          }}
          disabled={isLoggingIn || !isWebAuthnAvailable}
        >
          {isLoggingIn ? 'Creating passkey...' : 'Sign up with Passkey'}
        </button>
        
        <!-- Login button (for returning users) -->
        <button 
          class="btn-secondary" 
          onclick={async () => {
            if (!isWebAuthnAvailable) {
              errorMessage = 'WebAuthn is not available in this context.';
              return;
            }
            isLoggingIn = true;
            errorMessage = null;
            try {
              console.log('Attempting passkey login...');
              await current.logIn();
              console.log('Login successful');
            } catch (error: any) {
              console.error('Login error:', error);
              if (error?.name === 'NotAllowedError' || error?.message?.includes('cancel')) {
                errorMessage = 'Login cancelled';
              } else {
                errorMessage = error?.message || 'Failed to log in with passkey. Please try again.';
              }
            } finally {
              isLoggingIn = false;
            }
          }}
          disabled={isLoggingIn || !isWebAuthnAvailable}
        >
          {isLoggingIn ? 'Logging in...' : 'Log in with existing Passkey'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .auth-container {
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    background: linear-gradient(135deg, #0a1628 0%, #132a45 100%);
    color: #e2e8f0;
    box-sizing: border-box;
  }

  .auth-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(100, 149, 237, 0.2);
  }

  .auth-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    min-height: 100%;
  }

  .auth-title {
    font-size: 1.75rem;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 0.5rem;
    text-align: center;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .auth-subtitle {
    font-size: 1rem;
    color: #94a3b8;
    margin-bottom: 2rem;
    text-align: center;
  }

  .auth-actions {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .btn-primary,
  .btn-secondary,
  .btn-logout {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: linear-gradient(135deg, #4169e1 0%, #6495ed 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(65, 105, 225, 0.3);
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #3557c7 0%, #5280d8 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(65, 105, 225, 0.4);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: rgba(51, 65, 85, 0.8);
    color: #e2e8f0;
    border: 1px solid rgba(100, 149, 237, 0.2);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(71, 85, 105, 0.9);
    border-color: rgba(100, 149, 237, 0.3);
    transform: translateY(-1px);
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-logout {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    background: rgba(51, 65, 85, 0.8);
    color: #e2e8f0;
    border: 1px solid rgba(100, 149, 237, 0.2);
  }

  .btn-logout:hover {
    background: rgba(71, 85, 105, 0.9);
    border-color: rgba(100, 149, 237, 0.3);
  }

  .error-message {
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    color: #fca5a5;
    font-size: 0.875rem;
    text-align: center;
    margin-bottom: 1rem;
  }
</style>

