import { todoServices } from '../../lib/stores/todo-services.js';

export const appConfig = {
    id: "todo-app-root",
    type: "Composite",
    layout: { 
        type: "flex", 
        direction: "column", 
        gap: "6", 
        padding: "8", 
        background: "slate.300", 
        align: "center",
        width: "100%", // Increased width
        maxWidth: "4xl", // Max width constraint
        margin: "0 auto" // Centering
    },
    children: [
        {
            type: "Leaf",
            component: "Label",
            style: { size: "3xl", weight: "bold", color: "primary.600" },
            data: { children: "Composite Todo App" }
        },
        
        // Add Todo Section (State Machine for Input)
        {
            type: "Composite",
            id: "add-todo-section",
            layout: { 
                type: "flex", 
                direction: "row", 
                gap: "4", 
                padding: "6", 
                background: "white", 
                rounded: "2xl", 
                border: true,
                width: "100%",
                align: "center"
            },
            stateMachine: {
                initial: "idle",
                states: {
                    idle: {
                        on: {
                            UPDATE_INPUT: {
                                target: "idle",
                                actions: (ctx, event) => { ctx.inputText = event.target.value; }
                            },
                            ADD: {
                                target: "adding",
                                actions: (ctx) => { console.log('Adding:', ctx.inputText); }
                            }
                        }
                    },
                    adding: {
                        invoke: async (ctx) => {
                            if (!ctx.inputText) return;
                            await todoServices.addTodo({ text: ctx.inputText });
                        },
                        on: {
                            DONE: {
                                target: "idle",
                                actions: (ctx) => { ctx.inputText = ''; } // Clear input
                            }
                        }
                    }
                }
            },
            children: [
                {
                    type: "Leaf",
                    component: "Input",
                    events: { 
                        input: { send: "UPDATE_INPUT" },
                        keydown: (e, dispatch) => { if(e.key === 'Enter') dispatch('ADD'); }
                    },
                    style: { flex: "1" }, // Take up remaining space
                    data: { 
                        placeholder: "What needs to be done?", 
                        value: (ctx) => ctx.inputText, 
                        disabled: (ctx) => ctx.state.matches('adding')
                    }
                },
                {
                    type: "Leaf",
                    component: "Button", 
                    style: { 
                        variant: "primary",
                        size: "xl", // Larger button
                        icon: "lucide:plus",
                        rounded: "full",
                        flex: "0 0 auto" // Don't shrink
                    }, 
                    data: { 
                        children: "Add", // Add text
                        loading: (ctx) => ctx.state.matches('adding')
                    },
                    events: { click: { send: "ADD" } }
                }
            ]
        },

        // Todo List
        {
            type: "Composite",
            id: "todo-list",
            layout: { type: "flex", direction: "column", gap: "3", width: "100%" },
            dataSource: "$store.todos",
            itemTemplate: {
                type: "Composite",
                layout: { 
                    type: "flex", 
                    direction: "row",
                    align: "center", 
                    gap: "3", 
                    padding: "3", 
                    background: "white", 
                    rounded: "lg", 
                    border: true,
                    width: "100%"
                },
                stateMachine: {
                    initial: "idle",
                    states: {
                        idle: {
                            on: {
                                TOGGLE: { target: "toggling" },
                                DELETE: { target: "deleting" }
                            }
                        },
                        toggling: {
                            invoke: async (ctx) => await todoServices.toggleTodo({ id: ctx.item.id }),
                            on: { DONE: "idle" }
                        },
                        deleting: {
                            invoke: async (ctx) => await todoServices.deleteTodo({ id: ctx.item.id }),
                            on: { DONE: "idle" } // Technically item disappears
                        }
                    }
                },
                children: [
                    {
                        type: "Leaf",
                        component: "IconButton",
                        style: { size: "sm" },
                        data: { 
                            icon: (ctx) => ctx.item.completed ? 'lucide:check-circle' : 'lucide:circle',
                            color: (ctx) => ctx.item.completed ? 'success.500' : 'slate.400'
                        },
                        events: { click: { send: "TOGGLE" } }
                    },
                    {
                        type: "Leaf",
                        component: "Label",
                        style: { size: "md", flex: "1" }, // Push badge/delete to right or just take space
                        data: { 
                            children: (ctx) => ctx.item.text,
                            textDecoration: (ctx) => ctx.item.completed ? 'line-through' : 'none',
                            color: (ctx) => ctx.item.completed ? 'slate.400' : 'slate.900'
                        }
                    },
                    {
                        type: "Leaf",
                        component: "Badge",
                        data: { 
                            children: (ctx) => ctx.item.priority,
                            variant: (ctx) => ctx.item.priority === 'high' ? 'alert' : 'info'
                        }
                    },
                    {
                        type: "Leaf",
                        component: "IconButton",
                        style: { icon: "lucide:trash-2", color: "alert.500", size: "sm" },
                        events: { click: { send: "DELETE" } }
                    }
                ]
            }
        }
    ]
};

