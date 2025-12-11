/**
 * Toast notification store
 * Simple toast system for displaying temporary messages
 */

import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const createToastStore = () => {
  const { subscribe, update } = writable<Toast[]>([]);

  return {
    subscribe,
    add: (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).substring(2, 9);
      const toast: Toast = { id, message, type };

      update((toasts) => [...toasts, toast]);

      // Auto-remove after 2 seconds
      setTimeout(() => {
        update((toasts) => toasts.filter((t) => t.id !== id));
      }, 2000);

      return id;
    },
    remove: (id: string) => {
      update((toasts) => toasts.filter((t) => t.id !== id));
    },
    success: (message: string) => {
      return createToastStore().add(message, 'success');
    },
    error: (message: string) => {
      return createToastStore().add(message, 'error');
    },
    warning: (message: string) => {
      return createToastStore().add(message, 'warning');
    },
    info: (message: string) => {
      return createToastStore().add(message, 'info');
    },
  };
};

export const toast = createToastStore();

