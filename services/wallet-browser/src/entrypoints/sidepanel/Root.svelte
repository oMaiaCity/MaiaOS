<script lang="ts">
  import { JazzSvelteProvider } from 'jazz-tools/svelte';
  import { WalletAccount } from '../../lib/schema';
  import Auth from '../../lib/components/Auth.svelte';
  import App from './App.svelte';

  const apiKey = import.meta.env.PUBLIC_JAZZ_API_KEY || '';

  if (!apiKey) {
    console.warn('PUBLIC_JAZZ_API_KEY is not set. Jazz sync will not work.');
  }

  const sync = {
    peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
    // Only sync when authenticated (not for anonymous accounts)
    when: 'signedUp' as const,
  };
</script>

<JazzSvelteProvider {sync} AccountSchema={WalletAccount}>
  <Auth>
    <App />
  </Auth>
</JazzSvelteProvider>


