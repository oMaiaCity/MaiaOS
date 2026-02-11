```

#### `@dragdrop/drop`
```json
{
  "tool": "@dragdrop/drop",
  "payload": {
    "field": "done",
    "value": true
  }
}
```

**Note:** Schema is not required. The schema is automatically extracted from the CoValue's headerMeta internally by the update operation.

**Tool Result:** Returns update result. Access via `$$result` in SUCCESS handler.

### Context Updates (Infrastructure, Not Tools)

**Note:** Context updates are infrastructure (not tools). Use `updateContext` action in state machines:

```json
{
  "updateContext": {
    "newTodoText": "Updated value",
    "someField": "new value"
  }
}
```

**How it works:**
- `updateContext` is infrastructure that directly calls `updateContextCoValue()` 
- Persists changes to context CoValue (CRDT)
- Context ReactiveStore automatically updates (read-only derived data)

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
  modules: ['db', 'core', 'dragdrop', 'custom']
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

- **Don't mutate context directly** - Return results, let state machines update context
- **Don't call other tools directly** (use state machine)
- **Don't store state in tool** - Return results instead
- **Don't make assumptions** about schema structure
- **Don't block** - Keep async operations fast
- **Don't update context from tools** - All context updates flow through state machines

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
Tool returns result (does NOT mutate context directly)
  ↓
Tool succeeds → StateEngine sends SUCCESS event with result in payload
Tool fails → StateEngine sends ERROR event
  ↓
State machine handles SUCCESS/ERROR
  ↓
State machine updates context via updateContext action (if needed)
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
