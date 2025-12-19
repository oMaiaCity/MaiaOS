/**
 * Hominio Provider Package
 * Provides the interface and utilities for the Hominio wallet provider
 * that gets injected into web pages
 */

export interface SigningRequest {
  id: string;
  message: string;
  timestamp: number;
}

export interface Provider {
  isHominio: boolean;
  requestSigning: (message: string) => Promise<{ approved: boolean; signature?: string }>;
  openWallet?: () => Promise<void>;
  on: (event: 'accountsChanged' | 'chainChanged', callback: () => void) => void;
  removeListener: (event: string, callback: () => void) => void;
}

/**
 * Create the Hominio provider object that gets injected into web pages
 * This is used in the extension's content script context
 */
export function createHominioProvider(extensionId: string): Provider {
  return {
    isHominio: true,
    
    /**
     * Request signing of a message
     */
    async requestSigning(message: string): Promise<{ approved: boolean; signature?: string }> {
      return new Promise((resolve, reject) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Send message to background script
        browser.runtime.sendMessage({
          type: 'signing-request',
          requestId,
          message,
        }).then((response) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else if (response?.approved) {
            resolve({
              approved: true,
              signature: response.signature || `fake_signature_${requestId}`,
            });
          } else {
            resolve({ approved: false });
          }
        }).catch((error) => {
          reject(error);
        });
      });
    },
    
    /**
     * Open the wallet (if available)
     */
    async openWallet(): Promise<void> {
      try {
        await browser.runtime.sendMessage({ type: 'open-wallet' });
      } catch (error) {
        console.error('[Hominio Provider] Error opening wallet:', error);
        throw error;
      }
    },
    
    /**
     * Event listeners (for future use)
     */
    on(event: 'accountsChanged' | 'chainChanged', callback: () => void) {
      // Placeholder for future event handling
      console.log('[Hominio Provider] Event listener registered:', event);
    },
    
    /**
     * Remove event listener
     */
    removeListener(event: string, callback: () => void) {
      // Placeholder for future event handling
      console.log('[Hominio Provider] Event listener removed:', event);
    },
  };
}

/**
 * Type guard to check if an object is a Hominio provider
 */
export function isHominioProvider(obj: any): obj is Provider {
  return obj && typeof obj === 'object' && obj.isHominio === true;
}


