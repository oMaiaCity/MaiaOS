import { writable } from 'svelte/store';
import { registerStore } from '../engine/data';

export const todos = writable([
    { id: '1', text: 'Learn Svelte 5', completed: true, priority: 'high' },
    { id: '2', text: 'Build Composite Engine', completed: false, priority: 'medium' },
    { id: '3', text: 'Ship Todo App', completed: false, priority: 'high' }
]);

// Register for JSON access
registerStore('todos', todos);

