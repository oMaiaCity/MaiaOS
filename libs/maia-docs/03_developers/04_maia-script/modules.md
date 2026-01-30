# Module System

Modules are plugins that extend MaiaOS functionality. They register tools and provide configuration.

---

## What Are Modules?

Modules are plugins that extend MaiaOS functionality. They register tools and provide configuration.

**Module Structure:**
```javascript
export class MyModule {
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'MyModule');
    
    // Register tools
    await registerToolsFromRegistry(registry, toolEngine, 'mymodule', ['tool1', 'tool2'], '@mymodule');
    
    // Register module config
    registerModuleConfig(registry, 'mymodule', MyModule, {
      version: '1.0.0',
      description: 'My module description',
      namespace: '@mymodule',
      tools: ['@mymodule/tool1', '@mymodule/tool2']
    });
  }
  
  static query(query) {
    // Return module configuration
    return null;
  }
}

export async function register(registry) {
  return await MyModule.register(registry);
}
```

---

## Available Modules

### db.module.js

**Purpose:** Database operations module.

**Tools:**
- `@db` - Unified database operations

**Usage:**
```javascript
// Tools are automatically available after module loads
// Use in state machines or views:
{
  tool: '@db',
  payload: {
    op: 'read',
    schema: 'co_zTodos123'  // Schema co-id (co_z...)
  }
}

// read() always returns a reactive store
const store = await os.db({op: 'read', schema: 'co_zTodos123'});
console.log('Current todos:', store.value);
store.subscribe((todos) => {
  console.log('Todos updated:', todos);
});
```

---

### core.module.js

**Purpose:** Core UI tools module.

**Tools:**
- `@core/noop` - No-operation (for testing)
- `@core/preventDefault` - Prevent default events
- `@core/publishMessage` - Publish messages to subscribed actors

---

### dragdrop.module.js

**Purpose:** Drag-and-drop functionality module.

**Tools:**
- `@dragdrop/start` - Start drag operation
- `@dragdrop/end` - End drag operation
- `@dragdrop/drop` - Handle drop
- `@dragdrop/dragEnter` - Handle drag enter
- `@dragdrop/dragLeave` - Handle drag leave

**Configuration:**
```javascript
// Access module config
const config = registry.getModule('dragdrop').query('config');
```

---

## Creating Custom Modules

### Step 1: Create Module File

Create `libs/maia-script/src/modules/mymodule.module.js`:

```javascript
import { getToolEngine, registerToolsFromRegistry, registerModuleConfig } from '../utils/module-registration.js';

export class MyModule {
  static async register(registry) {
    const toolEngine = getToolEngine(registry, 'MyModule');
    
    const toolNames = ['tool1', 'tool2'];
    
    await registerToolsFromRegistry(registry, toolEngine, 'mymodule', toolNames, '@mymodule');
    
    registerModuleConfig(registry, 'mymodule', MyModule, {
      version: '1.0.0',
      description: 'My custom module',
      namespace: '@mymodule',
      tools: toolNames.map(t => `@mymodule/${t}`)
    });
  }
  
  static query(query) {
    return null;
  }
}

export async function register(registry) {
  return await MyModule.register(registry);
}
```

### Step 2: Create Tools

Create tools in `@MaiaOS/tools` package (see `@MaiaOS/tools` documentation).

### Step 3: Load Module

Load module during boot:

```javascript
const os = await MaiaOS.boot({
  modules: ['db', 'core', 'mymodule'] // Add your module
});
```

---

## Module Registration Utilities

Modules use shared utilities from `module-registration.js`:

- `getToolEngine(registry, moduleName)` - Get ToolEngine from registry
- `registerToolsFromRegistry(registry, toolEngine, moduleName, toolNames, namespace)` - Register tools
- `registerModuleConfig(registry, moduleName, ModuleClass, config)` - Register module config

These utilities ensure consistent module registration patterns across all modules.

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines.md](./engines.md) - Engine details
- [api-reference.md](./api-reference.md) - API reference
- [patterns.md](./patterns.md) - Common patterns
