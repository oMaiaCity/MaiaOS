import { get } from 'svelte/store';

// Mock store registry for now. In a real app, this would be a Context or global registry.
export const storeRegistry = {};

export const registerStore = (name, store) => {
    storeRegistry[name] = store;
};

export const resolveData = (pathOrFn, context = {}) => {
    // If it's a function, execute it with context
    if (typeof pathOrFn === 'function') {
        return pathOrFn(context);
    }

    if (typeof pathOrFn !== 'string') return pathOrFn;
    
    // Basic string path resolution
    // $item.text -> context.item.text
    if (pathOrFn.startsWith('$item.')) {
        const key = pathOrFn.replace('$item.', '');
        return context.item ? context.item[key] : undefined;
    }

    // $context.inputText -> context.inputText
    if (pathOrFn.startsWith('$context.')) {
        const key = pathOrFn.replace('$context.', '');
        return context[key];
    }

    // $store.todos -> storeRegistry.todos
    if (pathOrFn.startsWith('$store.')) {
        const key = pathOrFn.replace('$store.', '');
        return storeRegistry[key];
    }

    // If string starts with $, try to resolve from context keys as a fallback
    // BUT avoid executing functions if the path is just a string starting with $
    if (pathOrFn.startsWith('$')) {
        const key = pathOrFn.substring(1);
        // Handle store resolution if the resolved value is a store
        // This might be redundant with $store. prefix but handles implicit store passing
        // For now, simply return context value
        return context[key];
    }

    return pathOrFn;
};

