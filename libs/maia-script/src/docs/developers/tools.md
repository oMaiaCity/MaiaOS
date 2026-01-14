# Tools Guide (Developer)

**For developers** who want to create custom tools and tool modules to extend MaiaOS functionality.

## What Are Tools?

Tools are **executable functions** that state machines invoke to perform actions. They are the ONLY place where imperative code lives in MaiaOS.

### Tool Characteristics

- ✅ **Pure functions** - Same input → same output
- ✅ **Context mutation** - Modify `actor.context`
- ✅ **Async operations** - API calls, database queries
- ✅ **Schema-agnostic** - Work with any data model
- ✅ **AI-compatible** - Defined with JSON schemas

## Tool Structure

Each tool consists of **two files**:

### 1. Tool Definition (`*.tool.maia`)
AI-compatible metadata in JSON format:

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
        "description": "Notification message",
        "required": true
      },
      "type": {
        "type": "string",
        "enum": ["info", "success", "error", "warning"],
        "description": "Notification type",
        "default": "info"
      },
      "duration": {
        "type": "number",
        "description": "Duration in milliseconds",
        "default": 3000
      }
    },
    "required": ["message"]
  }
}
```

### 2. Tool Function (`*.tool.js`)
Executable JavaScript:

```javascript
export default {
  async execute(actor, payload) {
    const { message, type = 'info', duration = 3000 } = payload;
    
    // Validate inputs
    if (!message) {
      throw new Error('Message is required');
    }
    
    // Mutate context
    if (!actor.context.notifications) {
      actor.context.notifications = [];
    }
    
    const notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    };
    
    actor.context.notifications.push(notification);
    
    // Auto-clear after duration
    setTimeout(() => {
      actor.context.notifications = actor.context.notifications.filter(
        n => n.id !== notification.id
      );
      actor.actorEngine.rerender(actor);
    }, duration);
    
    console.log(`📬 Notification: ${message} (${type})`);
  }
};
```

## Creating a Tool Module

### Step 1: Organize Tool Files

```
o/tools/
└── notifications/
    ├── show.tool.maia
    ├── show.tool.js
    ├── clear.tool.maia
    ├── clear.tool.js
    ├── clearAll.tool.maia
    └── clearAll.tool.js
```

### Step 2: Create Tool Definitions

**`o/tools/notifications/show.tool.maia`:**
```json
{
  "$type": "tool",
  "$id": "tool_notifications_show",
  "name": "@notifications/show",
  "description": "Display a notification",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {"type": "string", "required": true},
      "type": {"type": "string", "enum": ["info", "success", "error"]},
      "duration": {"type": "number", "default": 3000}
    }
  }
}
```

**`o/tools/notifications/clear.tool.maia`:**
```json
{
  "$type": "tool",
  "$id": "tool_notifications_clear",
  "name": "@notifications/clear",
  "description": "Clear a specific notification by ID",
  "parameters": {
    "type": "object",
    "properties": {
      "id": {"type": "string", "required": true}
    }
  }
}
```

### Step 3: Implement Tool Functions

**`o/tools/notifications/show.tool.js`:**
```javascript
export default {
  async execute(actor, payload) {
    const { message, type = 'info', duration = 3000 } = payload;
    
    if (!actor.context.notifications) {
      actor.context.notifications = [];
    }
    
    const notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    };
    
    actor.context.notifications.push(notification);
    
    setTimeout(() => {
      actor.context.notifications = actor.context.notifications.filter(
        n => n.id !== notification.id
      );
      actor.actorEngine.rerender(actor);
    }, duration);
    
    console.log(`✅ [notifications/show] ${message} (${type})`);
  }
};
```

**`o/tools/notifications/clear.tool.js`:**
```javascript
export default {
  async execute(actor, payload) {
    const { id } = payload;
    
    if (!actor.context.notifications) return;
    
    const before = actor.context.notifications.length;
    actor.context.notifications = actor.context.notifications.filter(
      n => n.id !== id
    );
    const after = actor.context.notifications.length;
    
    console.log(`✅ [notifications/clear] Cleared notification ${id} (${before - after} removed)`);
  }
};
```

**`o/tools/notifications/clearAll.tool.js`:**
```javascript
export default {
  async execute(actor, payload) {
    const count = actor.context.notifications?.length || 0;
    actor.context.notifications = [];
    console.log(`✅ [notifications/clearAll] Cleared ${count} notifications`);
  }
};
```

### Step 4: Create Module Definition

**`o/modules/notifications.module.js`:**
```javascript
export class NotificationsModule {
  static async register(registry, toolEngine) {
    const tools = ['show', 'clear', 'clearAll'];
    
    console.log(`[NotificationsModule] Registering ${tools.length} tools...`);
    
    for (const tool of tools) {
      await toolEngine.registerTool(
        `notifications/${tool}`,      // Tool path (relative to o/tools/)
        `@notifications/${tool}`       // Tool name (namespace + name)
      );
    }
    
    registry.registerModule('notifications', NotificationsModule, {
      version: '1.0.0',
      description: 'User notification system',
      namespace: '@notifications',
      tools: tools.map(t => `@notifications/${t}`)
    });
    
    console.log('[NotificationsModule] Registration complete');
  }
}

export default NotificationsModule;
```

### Step 5: Load Module at Boot

```javascript
// In your app's index.html or boot script
const os = await MaiaOS.boot({
  modules: ['core', 'mutation', 'dragdrop', 'notifications']
});
```

### Step 6: Use in State Machine

```json
{
  "states": {
    "idle": {
      "on": {
        "CREATE_TODO": "creating"
      }
    },
    "creating": {
      "entry": [
        {
          "tool": "@mutation/create",
          "payload": {
            "schema": "todos",
            "data": {"text": "$newTodoText", "done": false}
          }
        },
        {
          "tool": "@notifications/show",
          "payload": {
            "message": "Todo created!",
            "type": "success",
            "duration": 2000
          }
        }
      ],
      "on": {
        "SUCCESS": "idle"
      }
    }
  }
}
```

## Advanced Tool Patterns

### Tool with External API

```javascript
// o/tools/api/fetchWeather.tool.js
export default {
  async execute(actor, payload) {
    const { city } = payload;
    
    try {
      const response = await fetch(
        `https://api.weather.com/v1/current?city=${city}`
      );
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Store in context
      actor.context.weather = {
        city,
        temperature: data.temp,
        condition: data.condition,
        timestamp: Date.now()
      };
      
      console.log(`✅ [api/fetchWeather] Got weather for ${city}: ${data.temp}°`);
    } catch (error) {
      console.error(`❌ [api/fetchWeather] Failed:`, error);
      throw error; // Will trigger ERROR event in state machine
    }
  }
};
```

### Tool with Database Integration

```javascript
// o/tools/db/saveToDatabase.tool.js
export default {
  async execute(actor, payload) {
    const { collection, data } = payload;
    
    try {
      // Use IndexedDB, localStorage, or external DB
      const db = await openDB('myapp', 1);
      const tx = db.transaction(collection, 'readwrite');
      const store = tx.objectStore(collection);
      
      const id = await store.add(data);
      
      // Update context with saved ID
      if (actor.context[collection]) {
        const item = actor.context[collection].find(i => i.id === data.id);
        if (item) {
          item.dbId = id;
        }
      }
      
      await tx.done;
      console.log(`✅ [db/saveToDatabase] Saved to ${collection}: ${id}`);
    } catch (error) {
      console.error(`❌ [db/saveToDatabase] Failed:`, error);
      throw error;
    }
  }
};
```

### Tool with Complex Validation

```javascript
// o/tools/validation/validateEmail.tool.js
export default {
  async execute(actor, payload) {
    const { email, field = 'email' } = payload;
    
    // Validation logic
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    // Store validation result in context
    if (!actor.context.validation) {
      actor.context.validation = {};
    }
    
    actor.context.validation[field] = {
      value: email,
      isValid,
      error: isValid ? null : 'Invalid email format',
      timestamp: Date.now()
    };
    
    if (!isValid) {
      throw new Error('Invalid email format');
    }
    
    console.log(`✅ [validation/validateEmail] Valid: ${email}`);
  }
};
```

### Tool with Side Effects (Analytics)

```javascript
// o/tools/analytics/trackEvent.tool.js
export default {
  async execute(actor, payload) {
    const { event, properties = {} } = payload;
    
    // Send to analytics service
    if (window.gtag) {
      window.gtag('event', event, properties);
    }
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`📊 [analytics/trackEvent] ${event}`, properties);
    }
    
    // Store in context for debugging
    if (!actor.context.analyticsEvents) {
      actor.context.analyticsEvents = [];
    }
    
    actor.context.analyticsEvents.push({
      event,
      properties,
      timestamp: Date.now()
    });
    
    // Keep only last 50 events
    if (actor.context.analyticsEvents.length > 50) {
      actor.context.analyticsEvents.shift();
    }
  }
};
```

## Generic vs Specific Tools

### Generic Tool Pattern
Works with any schema/data:

```javascript
// @mutation/create (generic)
export default {
  async execute(actor, payload) {
    const { schema, data } = payload;
    const entity = { id: Date.now().toString(), ...data };
    actor.context[schema].push(entity);
  }
};
```

Usage:
```json
{"tool": "@mutation/create", "payload": {"schema": "todos", "data": {...}}}
{"tool": "@mutation/create", "payload": {"schema": "notes", "data": {...}}}
```

### Specific Tool Pattern
Hardcoded for one use case:

```javascript
// @todos/createTodo (specific)
export default {
  async execute(actor, payload) {
    const { text } = payload;
    const todo = {
      id: Date.now().toString(),
      text,
      done: false,
      createdAt: Date.now()
    };
    actor.context.todos.push(todo);
  }
};
```

**When to use which:**
- **Generic** - Library tools (core, mutation, dragdrop)
- **Specific** - App-specific business logic

## Tool Best Practices

### ✅ DO:

- **Validate inputs** - Check required fields
- **Handle errors gracefully** - Try/catch and meaningful messages
- **Log operations** - Help debugging
- **Keep pure** - No global state, only `actor.context`
- **Be async** - Even if synchronous (consistency)
- **Document parameters** - Clear JSON schema
- **Use schema-agnostic patterns** - When possible

### ❌ DON'T:

- **Don't mutate actor properties** - Only `context` is safe
- **Don't call other tools directly** - Use state machine
- **Don't store state in tool** - Stateless functions only
- **Don't block** - Async operations should be fast
- **Don't use globals** - Pass everything via payload
- **Don't hardcode** - Parameterize when possible

## Testing Tools

```javascript
// test-notification-tool.js
import notifyTool from './o/tools/notifications/show.tool.js';

describe('Notification Tool', () => {
  it('should add notification to context', async () => {
    const mockActor = {
      context: {},
      actorEngine: {
        rerender: jest.fn()
      }
    };
    
    const payload = {
      message: 'Test notification',
      type: 'info',
      duration: 1000
    };
    
    await notifyTool.execute(mockActor, payload);
    
    expect(mockActor.context.notifications).toHaveLength(1);
    expect(mockActor.context.notifications[0].message).toBe('Test notification');
  });
  
  it('should auto-clear after duration', async () => {
    const mockActor = {
      context: {},
      actorEngine: { rerender: jest.fn() }
    };
    
    await notifyTool.execute(mockActor, {
      message: 'Test',
      type: 'info',
      duration: 100
    });
    
    expect(mockActor.context.notifications).toHaveLength(1);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(mockActor.context.notifications).toHaveLength(0);
  });
});
```

## Module Configuration

Advanced module with configuration:

```javascript
export class DatabaseModule {
  static config = {
    dbName: 'myapp',
    version: 1,
    stores: ['todos', 'notes', 'users']
  };
  
  static async register(registry, toolEngine) {
    // Initialize database
    const db = await this._initDatabase();
    
    // Pass db instance to tools (via closure)
    const tools = ['save', 'load', 'delete'];
    
    for (const tool of tools) {
      const toolPath = `db/${tool}`;
      const toolName = `@db/${tool}`;
      
      // Load and augment tool with db instance
      const toolModule = await import(`../tools/${toolPath}.tool.js`);
      toolModule.db = db;
      
      await toolEngine.registerTool(toolPath, toolName);
    }
    
    registry.registerModule('database', DatabaseModule, {
      version: '1.0.0',
      namespace: '@db',
      tools: tools.map(t => `@db/${t}`),
      config: this.config
    });
  }
  
  static async _initDatabase() {
    // IndexedDB initialization
    return await openDB(this.config.dbName, this.config.version, {
      upgrade(db) {
        for (const store of DatabaseModule.config.stores) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
          }
        }
      }
    });
  }
}
```

## Next Steps

- Read [Engines Guide](./engines.md) - Creating custom engines
- Read [DSL Guide](./dsl.md) - Defining new DSL types
- Read [MaiaOS Guide](./maiaos.md) - Understanding the system
