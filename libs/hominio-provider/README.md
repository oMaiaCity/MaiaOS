# @hominio/provider

Hominio Wallet Provider package - provides the interface and utilities for the Hominio wallet provider that gets injected into web pages.

## Overview

This package contains:
- **TypeScript types** for the Hominio provider interface
- **Provider creation utilities** for extension content scripts
- **Injection script** (`inject-provider.js`) that gets injected into web pages

## Usage

### In Extension (wallet-browser)

```typescript
import { createHominioProvider, type Provider } from '@hominio/provider';

const extensionId = browser.runtime.id;
const provider = createHominioProvider(extensionId);
```

### In Web Pages (me service)

```typescript
import type { Provider } from '@hominio/provider';

// Check if provider is available
if (typeof window !== 'undefined' && (window as any).hominio) {
  const provider = (window as any).hominio as Provider;
  
  // Request signing
  const result = await provider.requestSigning('Hello, Hominio!');
  
  // Open wallet
  await provider.openWallet?.();
}
```

## API

### `Provider` Interface

```typescript
interface Provider {
  isHominio: boolean;
  requestSigning: (message: string) => Promise<{ approved: boolean; signature?: string }>;
  openWallet?: () => Promise<void>;
  on: (event: 'accountsChanged' | 'chainChanged', callback: () => void) => void;
  removeListener: (event: string, callback: () => void) => void;
}
```

### Functions

- `createHominioProvider(extensionId: string): Provider` - Create provider instance for content script
- `isHominioProvider(obj: any): obj is Provider` - Type guard to check if object is a Hominio provider

## Build Notes

For the wallet-browser extension, the `inject-provider.js` script needs to be copied to `services/wallet-browser/public/inject-provider.js` during build. This is currently done manually, but could be automated with a build script.


