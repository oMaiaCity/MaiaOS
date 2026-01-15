# Skills (AI Agent Interface)

**Skills** are interface specifications that describe how AI agents should interact with actors. They are **metadata for LLM orchestration**, not execution logic.

> Skills tell AI agents WHAT an actor can do, WHEN to use it, and HOW to interact with it.

## Philosophy

- **Actors** are pure declarative specifications (definition layer)
- **Engines** execute the logic (runtime layer)
- **Skills** describe capabilities (interface layer for AI)

Skills enable **AI-composable applications** where LLM agents can discover, understand, and orchestrate actors without hardcoded workflows.

## Skill Definition

Create a file named `{name}.skill.maia`:

```json
{
  "$type": "skill",
  "$id": "skill_todo_001",
  "actorType": "todo",
  "version": "1.0.0",
  
  "description": "A todo list manager that maintains task state and provides list/kanban views",
  
  "capabilities": {
    "taskManagement": {
      "description": "Create, complete, and delete todo items",
      "when": "User wants to track tasks, create lists, manage todos"
    },
    "viewSwitching": {
      "description": "Switch between list and kanban board layouts",
      "when": "User wants different visualization of their tasks"
    },
    "dragDropOrganization": {
      "description": "Drag tasks between todo/done columns in kanban view",
      "when": "User wants to visually organize or complete tasks"
    }
  },
  
  "stateEvents": {
    "CREATE_TODO": {
      "description": "Creates a new todo item in the list",
      "payload": {
        "text": {
          "type": "string",
          "required": true,
          "maxLength": 500,
          "description": "The todo item text"
        }
      },
      "example": {
        "event": "CREATE_TODO",
        "payload": {"text": "Buy groceries"}
      },
      "when": [
        "User says: 'add todo'",
        "User says: 'create task'",
        "User says: 'remember to...'"
      ]
    },
    "TOGGLE_TODO": {
      "description": "Marks a todo as done/undone",
      "payload": {
        "id": {
          "type": "string",
          "required": true,
          "description": "The todo item ID to toggle"
        }
      },
      "when": [
        "User says: 'mark done'",
        "User says: 'complete task'",
        "User says: 'check off...'"
      ]
    },
    "DELETE_TODO": {
      "description": "Removes a todo item",
      "payload": {
        "id": {
          "type": "string",
          "required": true
        }
      },
      "when": ["User says: 'delete task'", "User says: 'remove...'"]
    },
    "SET_VIEW_MODE": {
      "description": "Changes the visualization mode",
      "payload": {
        "viewMode": {
          "type": "string",
          "enum": ["list", "kanban"],
          "required": true
        }
      },
      "when": ["User says: 'show kanban'", "User says: 'switch to list view'"]
    }
  },
  
  "queryableContext": {
    "todos": {
      "type": "array",
      "description": "All todo items",
      "schema": {
        "id": "string",
        "text": "string",
        "done": "boolean"
      }
    },
    "todosTodo": {
      "type": "array",
      "description": "Filtered list of incomplete todos"
    },
    "todosDone": {
      "type": "array",
      "description": "Filtered list of completed todos"
    },
    "viewMode": {
      "type": "string",
      "enum": ["list", "kanban"],
      "description": "Current view mode"
    },
    "newTodoText": {
      "type": "string",
      "description": "Current text in the input field"
    }
  },
  
  "bestPractices": [
    "Always check existing todos before creating duplicates",
    "Use fuzzy matching when user refers to tasks (e.g., 'finish the groceries' matches 'Buy groceries')",
    "Provide feedback about current state (e.g., 'You have 3 incomplete tasks')",
    "When user says 'show my tasks', read context.todos and summarize",
    "Confirm destructive actions (DELETE_TODO) before executing"
  ],
  
  "commonPatterns": {
    "addAndView": {
      "description": "User wants to add item and see their list",
      "userIntent": ["add milk", "new task: call mom"],
      "sequence": [
        {
          "action": "sendEvent",
          "event": "CREATE_TODO",
          "payload": {"text": "{{extracted from user input}}"}
        },
        {
          "action": "queryContext",
          "path": "todos",
          "respond": "Added '{{text}}'. You now have {{todos.length}} tasks."
        }
      ]
    },
    "completeTask": {
      "description": "User wants to mark something done",
      "userIntent": ["finish groceries", "done with homework", "complete the report"],
      "sequence": [
        {
          "action": "queryContext",
          "path": "todosTodo",
          "operation": "fuzzyMatch",
          "input": "{{user's task description}}"
        },
        {
          "action": "sendEvent",
          "event": "TOGGLE_TODO",
          "payload": {"id": "{{matched todo id}}"}
        },
        {
          "action": "respond",
          "message": "Marked '{{todo.text}}' as complete!"
        }
      ]
    },
    "listTasks": {
      "description": "User wants to see their todos",
      "userIntent": ["what's on my list", "show tasks", "what do I need to do"],
      "sequence": [
        {
          "action": "queryContext",
          "path": "todosTodo"
        },
        {
          "action": "respond",
          "message": "You have {{todosTodo.length}} incomplete tasks: {{list}}. {{todosDone.length}} completed."
        }
      ]
    }
  }
}
```

## How AI Agents Use Skills

### 1. Discovery Phase
```javascript
// Agent discovers available actors via SkillEngine
const skills = await skillEngine.listSkills();

// Agent reads skill to understand capabilities
const todoSkill = await skillEngine.getSkill('todo');
console.log(todoSkill.capabilities);
// → taskManagement, viewSwitching, dragDropOrganization
```

### 2. Intent Matching Phase
```javascript
// User says: "Add milk to my shopping list"

// Agent matches user intent to skill patterns
const matches = agent.matchIntent(userMessage, skills);
// → Pattern: "addAndView" from todo skill

// Agent identifies relevant event
const event = agent.selectEvent(userMessage, todoSkill);
// → "CREATE_TODO"
```

### 3. Execution Phase
```javascript
// Agent generates correct payload
const payload = agent.generatePayload(userMessage, event);
// → {text: "Buy milk"}

// Agent checks best practices
if (todoSkill.bestPractices.includes('check duplicates')) {
  const existing = await actor.getContext('todos');
  const hasDuplicate = existing.some(t => fuzzyMatch(t.text, 'Buy milk'));
}

// Agent sends event to actor
await actor.sendEvent('CREATE_TODO', payload);

// Agent responds using skill guidance
respond("Added 'Buy milk' to your todos. You now have " + 
        actor.context.todosTodo.length + " tasks.");
```

## Skill Structure

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `$type` | string | Always `"skill"` |
| `$id` | string | Unique identifier |
| `actorType` | string | Actor type this skill describes |
| `description` | string | High-level capability summary |
| `stateEvents` | object | Events the actor can handle |
| `queryableContext` | object | Context fields AI can read |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `capabilities` | object | High-level capability categories |
| `bestPractices` | array | Guidelines for AI agents |
| `commonPatterns` | object | Reusable interaction sequences |
| `version` | string | Skill version |
| `examples` | array | Usage examples |

## Event Definitions

Each event in `stateEvents` should include:

```json
{
  "EVENT_NAME": {
    "description": "What this event does",
    "payload": {
      "field1": {
        "type": "string|number|boolean|object|array",
        "required": true|false,
        "description": "Field purpose",
        "enum": ["option1", "option2"],  // optional
        "maxLength": 500,                 // optional
        "pattern": "regex"                // optional
      }
    },
    "example": {
      "event": "EVENT_NAME",
      "payload": {...}
    },
    "when": [
      "User intent pattern 1",
      "User intent pattern 2"
    ]
  }
}
```

## Context Schema

Define what AI agents can query:

```json
{
  "queryableContext": {
    "fieldName": {
      "type": "string|number|boolean|array|object",
      "description": "What this field contains",
      "schema": {...},           // For arrays/objects
      "enum": [...],             // For string enums
      "readOnly": true,          // If AI should not suggest modifications
      "computed": true           // If derived from other fields
    }
  }
}
```

## Common Patterns

Patterns describe reusable interaction sequences:

```json
{
  "patternName": {
    "description": "What this pattern accomplishes",
    "userIntent": ["Example phrases users might say"],
    "sequence": [
      {
        "action": "queryContext|sendEvent|respond",
        "...": "action-specific fields"
      }
    ],
    "errorHandling": {
      "notFound": "What to do if entity not found",
      "duplicate": "What to do if duplicate exists"
    }
  }
}
```

## Best Practices for Writing Skills

### ✅ DO:

- **Be explicit** - Don't assume AI knows domain conventions
- **Provide examples** - Show actual payloads and responses
- **Document intent patterns** - Map user phrases to events
- **Include edge cases** - What if list is empty? Item not found?
- **Specify constraints** - Max lengths, required fields, enums
- **Guide error handling** - What to do when operations fail

### ❌ DON'T:

- **Don't include implementation details** - Skills describe interface, not implementation
- **Don't hardcode data** - Skills are templates, not instances
- **Don't assume context** - Each skill should be self-contained
- **Don't mix concerns** - Keep skills focused on one actor type

## Linking Skills to Actors

In your actor definition, reference the skill:

```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "stateRef": "todo",
  "skillRef": "todo",     // ← References todo.skill.maia
  "context": {...}
}
```

## Token Efficiency (Why Skills Matter)

**Without Skills** (50K+ tokens):
```
LLM loads:
- All tool schemas (15+ tools × 500 tokens each)
- Entire state machine definition (2K tokens)
- All possible events and transitions
- Payload schemas for every tool
```

**With Skills** (2-5K tokens):
```
LLM loads:
- Single skill definition (2-5K tokens)
- Only relevant capabilities
- Clear usage patterns
- Best practices guidance
```

Skills reduce token usage by **90%** while improving decision quality.

## Next Steps

- Learn about [State Machines](./05-state.md) - Actor behavior (execution)
- Understand [Tools](./06-tools.md) - Executable actions
- Explore [Context](./04-context.md) - Runtime state management

## Voice/AI Agent Integration

Skills are designed for voice and AI agent interfaces:

```typescript
// Voice agent discovers actors
const skills = await skillEngine.listSkills();

// LLM determines relevant actor
const skill = ai.selectSkill(userMessage, skills);

// LLM generates event
const event = ai.generateEvent(userMessage, skill);

// Execute via actor
await actor.sendEvent(event.name, event.payload);
```

Coming in **v0.5**: Full voice integration with automatic skill discovery!
