/**
 * Account Loader - Standardized account loading patterns
 */

import { AccountCoState } from 'jazz-tools/svelte';
import { JazzAccount } from '@hominio/data';

export interface AccountResolveConfig {
  profile?: boolean;
  root?: {
    contact?: boolean;
    capabilities?: boolean;
    [key: string]: boolean | undefined;
  };
}

/**
 * Create a standard account loader
 */
export function createAccountLoader(resolve: AccountResolveConfig = {}) {
  return new AccountCoState(JazzAccount, {
    resolve: {
      profile: resolve.profile ?? true,
      root: resolve.root ?? {
        contact: true,
      },
    },
  });
}

/**
 * Standard account resolve patterns
 */
export const accountResolvePatterns = {
  minimal: {
    profile: false,
    root: {},
  },
  default: {
    profile: true,
    root: {
      contact: true,
    },
  },
  full: {
    profile: true,
    root: {
      contact: true,
      capabilities: true,
    },
  },
} as const;

