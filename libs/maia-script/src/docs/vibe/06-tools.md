# Tools

**Tools** are executable functions that perform actions. They are the **hands of actors** - invoked by state machines to mutate context, call APIs, update databases, etc.

## Philosophy

> Tools are the ONLY place where imperative code lives. Everything else is declarative.

- **State machines** decide WHEN to act
- **Tools** define HOW to act  
- **Actors** hold WHAT to act upon (context)

## Tool Structure

Each tool consists of two files:

### 1. Tool Definition (`.tool.maia`)
AI-compatible metadata describing the tool:

```json
{
  "$type": "tool",
  "$id": "tool_mutation_create_001",
  "name": "@mutation/create",
  "description": "Generic create operation for any schema",
  "parameters": {
    "type": "object",
    "properties": {
      "schema": {
        "type": "string",
        "description": "Collection name (e.g., 'todos', 'notes')"
      },
      "data": {
        "type": "object",
        "description": "Entity data (without ID, auto-generated)"
      }
    },
    "required": ["schema", "data"]
  }
}
```

### 2. Tool Function (`.tool.js`)
Executable JavaScript function:

```javascript
export default {
  async execute(actor, payload) {
    const { schema, data } = payload;
    
    // Create entity
    const entity = {
      id: Date.now().toString(),
      ...data
    };
    
    // Add to collection
    actor.context[schema].push(entity);
    
    console.log(`✅ Created ${schema}:`, entity);
  }
};
```

## Available Tools

### Mutation Module (`@mutation/*`)

#### `@mutation/create`
```json
{
  "tool": "@mutation/create",
  "payload": {
    "schema": "todos",
    "data": {"text": "Buy milk", "done": false}
  }
}
```

#### `@mutation/update`
```json
{
  "tool": "@mutation/update",
  "payload": {
    "schema": "todos",
    "id": "123",
    "data": {"text": "Buy milk and eggs"}
  }
}
```

#### `@mutation/delete`
```json
{
  "tool": "@mutation/delete",
  "payload": {
    "schema": "todos",
    "id": "123"
  }
}
```

#### `@mutation/toggle`
```json
{
  "tool": "@mutation/toggle",
  "payload": {
    "schema": "todos",
    "id": "123",
    "field": "done"
  }
}
```

### Core Module (`@core/*`)

#### `@core/setViewMode`
```json
{
  "tool": "@core/setViewMode",
  "payload": {"viewMode": "kanban"}
}
```

#### `@core/openModal`
```json
{
  "tool": "@core/openModal",
  "payload": {}
}
```

#### `@core/closeModal`
```json
{
  "tool": "@core/closeModal",
  "payload": {}
}
```

### Drag-Drop Module (`@dragdrop/*`)

#### `@dragdrop/start`
```json
{
  "tool": "@dragdrop/start",
  "payload": {
    "schema": "todos",
    "id": "123"
  }
}
```

#### `@dragdrop/drop`
```json
{
  "tool": "@dragdrop/drop",
  "payload": {
    "schema": "todos",
    "field": "done",
    "value": true
  }
}
```

### Context Module (`@context/*`)

#### `@context/update`
```json
{
  "tool": "@context/update",
  "payload": {
    "newTodoText": "Updated value",
    "someField": "new value"
  }
}
```

## Creating Custom Tools

### 1. Create Tool Definition

`o/tools/custom/notify.tool.maia`:
```json
{
  "$type": "tool",
  "$id": "tool_notify_001",
  "name": "@custom/notify",
  "description": "Shows a notification to the user",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "Notification message"
      },
      "type": {
        "type": "string",
        "enum": ["info", "success", "error"],
        "description": "Notification type"
      }
    },
    "required": ["message"]
  }
}
```

### 2. Create Tool Function

`o/tools/custom/notify.tool.js`:
```javascript
export default {
  async execute(actor, payload) {
    const { message, type = 'info' } = payload;
    
    // Add notification to context
    if (!actor.context.notifications) {
      actor.context.notifications = [];
    }
    
    actor.context.notifications.push({
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    });
    
    // Auto-clear after 3 seconds
    setTimeout(() => {
      actor.context.notifications = actor.context.notifications.filter(
        n => n.id !== id
      );
      actor.actorEngine.rerender(actor);
    }, 3000);
    
    console.log(`📬 Notification: ${message}`);
  }
};
```

### 3. Register in Module

`o/modules/custom.module.js`:
```javascript
export class CustomModule {
  static async register(registry, toolEngine) {
    await toolEngine.registerTool('custom/notify', '@custom/notify');
    
    registry.registerModule('custom', CustomModule, {
      version: '1.0.0',
      namespace: '@custom',
      tools: ['@custom/notify']
    });
  }
}

export async function register(registry) {
  const toolEngine = registry._toolEngine;
  await CustomModule.register(registry, toolEngine);
}
```

### 4. Load Module at Boot

```javascript
const os = await MaiaOS.boot({
  modules: ['core', 'mutation', 'dragdrop', 'custom']
});
```

## Tool Best Practices

### ✅ DO:

- **Be schema-agnostic** - Don't hardcode collection names
- **Validate inputs** - Check required fields
- **Handle errors gracefully** - Use try/catch
- **Log actions** - Help debugging
- **Keep pure** - Minimize side effects
- **Document well** - Clear parameter descriptions

### ❌ DON'T:

- **Don't mutate actor properties** (except `context`)
- **Don't call other tools directly** (use state machine)
- **Don't store state in tool** (use actor.context)
- **Don't make assumptions** about schema structure
- **Don't block** - Keep async operations fast

## Tool Execution Flow

```
State machine entry action
  ↓
StateEngine._invokeTool()
  ↓
StateEngine._evaluatePayload() (resolve $ and $$ references)
  ↓
ToolEngine.execute(toolName, actor, evaluatedPayload)
  ↓
ToolEngine finds tool by name
  ↓
Tool function executes
  ↓
Tool mutates actor.context
  ↓
Tool succeeds → StateEngine sends SUCCESS event
Tool fails → StateEngine sends ERROR event
  ↓
State machine handles SUCCESS/ERROR
  ↓
ActorEngine.rerender() (if state changed)
```

## Error Handling in Tools

```javascript
export default {
  async execute(actor, payload) {
    const { schema, id } = payload;
    
    // Validate inputs
    if (!schema) {
      throw new Error('Schema is required');
    }
    
    // Check collection exists
    if (!actor.context[schema]) {
      throw new Error(`Schema "${schema}" not found`);
    }
    
    try {
      // Perform operation
      const entity = actor.context[schema].find(e => e.id === id);
      if (!entity) {
        console.warn(`Entity ${id} not found in ${schema}`);
        return; // Graceful failure
      }
      
      // Mutate
      entity.updated = Date.now();
      
      console.log(`✅ Updated ${schema}/${id}`);
    } catch (error) {
      console.error(`❌ Failed to update ${schema}/${id}:`, error);
      throw error; // Re-throw to trigger ERROR event
    }
  }
};
```

## Testing Tools

```javascript
// Manual tool execution for testing
const mockActor = {
  context: {
    todos: []
  },
  actorEngine: null
};

const payload = {
  schema: 'todos',
  data: {text: 'Test', done: false}
};

await createTool.execute(mockActor, payload);
console.log(mockActor.context.todos); // [{id: "...", text: "Test", done: false}]
```

## Next Steps

- Learn about [State Machines](./05-state.md) - How tools are invoked
- Understand [Context](./04-context.md) - What tools manipulate
- Explore [Developers/Tools](../developers/tools.md) - Creating tool modules
