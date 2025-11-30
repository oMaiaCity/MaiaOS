import { get } from 'svelte/store';
import { todos } from './todo-store';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const todoServices = {
    addTodo: async ({ text }) => {
        console.log('Service: Adding todo', text);
        await delay(500); // Fake network latency
        todos.update(items => [
            ...items,
            { 
                id: Date.now().toString(), 
                text, 
                completed: false, 
                priority: 'medium' 
            }
        ]);
    },

    toggleTodo: async ({ id }) => {
        console.log('Service: Toggling todo', id);
        // Optimistic update? Or wait? Let's wait to show FSM state.
        await delay(300); 
        todos.update(items => items.map(t => 
            t.id === id ? { ...t, completed: !t.completed } : t
        ));
    },

    deleteTodo: async ({ id }) => {
        console.log('Service: Deleting todo', id);
        await delay(300);
        todos.update(items => items.filter(t => t.id !== id));
    }
};

