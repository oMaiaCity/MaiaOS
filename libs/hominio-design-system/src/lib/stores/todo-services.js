import { get } from 'svelte/store';
import { todos } from './todo-store';

export const todoServices = {
    addTodo: async ({ text }) => {
        console.log('Service: Adding todo', text);
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
        todos.update(items => items.map(t => 
            t.id === id ? { ...t, completed: !t.completed } : t
        ));
    },

    deleteTodo: async ({ id }) => {
        console.log('Service: Deleting todo', id);
        todos.update(items => items.filter(t => t.id !== id));
    }
};

