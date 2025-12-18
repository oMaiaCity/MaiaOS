<script lang="ts">
  import { JazzSvelteProvider } from 'jazz-tools/svelte';
  import { WalletAccount } from '../../lib/schema';
  import Auth from '../../lib/components/Auth.svelte';

  const apiKey = import.meta.env.PUBLIC_JAZZ_API_KEY || '';

  if (!apiKey) {
    console.warn('PUBLIC_JAZZ_API_KEY is not set. Jazz sync will not work.');
  }

  const sync = {
    peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
  };

  // Listen for successful auth and close popup
  $effect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'auth-success') {
        // Close popup after successful auth
        setTimeout(() => window.close(), 1000);
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  });
</script>

<JazzSvelteProvider {sync} AccountSchema={WalletAccount}>
  <Auth />
</JazzSvelteProvider>

