# Vibes (App Manifests)

**Vibes** are marketplace-ready app manifests that describe a MaiaOS application. They provide metadata for discovery and reference the root actor that powers the app.

## What is a Vibe?

A vibe is a JSON manifest file (`.vibe.maia`) that serves as an "app store listing" for your MaiaOS application. Think of it as the packaging around your actor-based app that makes it discoverable and installable.

**What vibes provide:**
- App metadata (name, description)
- Reference to the root actor (always a **service actor**)
- Marketplace/catalog integration
- Single entry point for loading apps

**What vibes are NOT:**
- Not the app itself (that's the actor)
- Not execution logic (that's in state machines and tools)
- Not UI definitions (that's in views)

> **Analogy:** If actors are the "executable," vibes are the "app store listing" that describes and loads them.

### Default Pattern: Agent Service Actor Entry Point

**Every vibe MUST have an "agent" service actor** as its entry point. This orchestrating service actor is called the **agent** and handles all business logic, data management, and coordination.

**Best Practice:** Always define the agent service actor first when creating a vibe.

```
Vibe → Agent (Service Actor) → Composite Actor → UI Actors
```

**Why "agent"?**
- Clear naming convention: the agent orchestrates everything
- Consistent across all vibes: every vibe has an `@actor/agent`
- AI-friendly: agents understand this pattern
- Best practice: start with the agent, then build UI actors

This pattern ensures:
- ✅ Clear separation of concerns (service logic vs. UI)
- ✅ Scalable architecture (add UI actors as needed)
- ✅ Message-based communication (loose coupling)
- ✅ Consistent structure across all vibes
- ✅ Agent-first development (define orchestrator first)

## Vibe Structure

Create a file named `manifest.vibe.maia`:

```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application",
  "actor": "@actor/agent"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `$schema` | string | Schema reference (`@schema/vibe`) - transformed to co-id during seeding |
| `$id` | string | Unique vibe identifier (`@vibe/todos`) - transformed to co-id during seeding |
| `name` | string | Display name for marketplace |
| `description` | string | Brief description of the app |
| `actor` | string | Reference to agent service actor (`@actor/agent`) - transformed to co-id during seeding |

### Field Details

**`$type`:** Discriminator field that identifies this as a vibe manifest.

**`$id`:** Unique identifier following the pattern `vibe_{name}_{number}`. Used for internal references.

**`name`:** The human-readable name that appears in marketplace listings, app launchers, etc.

**`description`:** A brief (1-3 sentence) description of what the app does. This appears in marketplace cards and search results.

**`actor`:** Relative path to the root actor file. The path is resolved relative to the vibe manifest location.

## Creating a Vibe

### Best Practice: Agent-First Development

**Always create the agent service actor first.** This is your app's orchestrator and entry point.

**Why Agent-First?**
1. **Clear Architecture** - Agent defines the app's structure and data flow
2. **Data First** - Agent handles all data operations before UI concerns
3. **UI Second** - UI actors receive data from agent, keeping them simple
4. **Consistent Pattern** - Every vibe follows the same structure
5. **AI-Friendly** - LLMs understand this pattern and can generate vibes correctly

**Development Order:**
1. ✅ **Create agent service actor** (`agent/agent.actor.maia`) - ALWAYS FIRST
2. ✅ Create vibe manifest (`manifest.vibe.maia`) - References agent
3. ✅ Create composite actor (`composite/composite.actor.maia`) - First UI actor
4. ✅ Create UI actors (`list/list.actor.maia`, etc.) - Leaf components

### Step 1: Organize Your App

Structure your app directory:

```
todos/
├── manifest.vibe.maia    # Vibe manifest
├── agent/                # Agent service actor (ALWAYS CREATE FIRST)
│   ├── agent.actor.maia
│   ├── agent.context.maia
│   ├── agent.state.maia
│   ├── agent.view.maia
│   ├── agent.interface.maia
│   ├── agent.subscriptions.maia
│   └── agent.inbox.maia
├── composite/            # Composite actor (first UI actor)
│   ├── composite.actor.maia
│   └── ...
├── list/                 # UI actors
│   ├── list.actor.maia
│   └── ...
└── agent/                # Brand style (shared design system)
    └── brand.style.maia
```

### Step 2: Create the Vibe Manifest

**`manifest.vibe.maia`:**
```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A simple todo list with drag-and-drop organization",
  "actor": "@actor/agent"
}
```

**Note:** The `actor` field references `@actor/agent` - this is the agent service actor that orchestrates the entire vibe.

### Step 3: Create Your Agent Service Actor (ALWAYS FIRST!)

**Best Practice:** Always define the agent service actor first. This is your app's orchestrator.

**`agent/agent.actor.maia` (Agent Service Actor):**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/agent",
  "role": "agent",
  "context": "@context/agent",
  "state": "@state/agent",
  "view": "@view/agent",
  "interface": "@interface/agent",
  "brand": "@style/brand",
  "children": {
    "composite": "@actor/composite"
  },
  "subscriptions": "@subscriptions/agent",
  "inbox": "@inbox/agent",
  "inboxWatermark": 0
}
```

**Agent Responsibilities:**
- Orchestrate data queries and mutations
- Manage application-level state
- Coordinate between UI actors via messages
- Handle business logic
- Load composite actor as first child

**Agent View (Minimal):**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/agent",
  "root": {
    "tag": "div",
    "attrs": { "class": "agent-container" },
    "$slot": "$composite"  // ← Only renders child actor
  }
}
```

The agent orchestrates the application and loads UI actors as children. See [Actors](./02-actors.md#default-vibe-pattern-service--composite--ui) for the complete pattern.

**Why Start with Agent?**
1. **Clear Architecture** - Agent defines the app's structure
2. **Data First** - Agent handles all data operations
3. **UI Second** - UI actors receive data from agent
4. **Best Practice** - Always define orchestrator before components

## Loading Vibes

### In HTML Applications

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="app-container"></div>
  
  <script type="module">
    import { MaiaOS } from './o/kernel.js';
    
    async function boot() {
      // Boot MaiaOS
      const os = await MaiaOS.boot({
        modules: ['db', 'core', 'dragdrop', 'interface']
      });
      
      // Load vibe
      const { vibe, actor } = await os.loadVibe(
        './vibes/myapp/myapp.vibe.maia',
        document.getElementById('app-container')
      );
      
      console.log('Loaded vibe:', vibe.name);
      console.log('Actor ready:', actor.id);
    }
    
    boot();
  </script>
</body>
</html>
```

### What Happens When You Load a Vibe?

```
os.loadVibe(path, container)
  ↓
1. Fetch vibe manifest
  ↓
2. Validate vibe structure
  ↓
3. Resolve actor path (relative to vibe)
  ↓
4. Load and create actor
  ↓
5. Return { vibe, actor }
```

The `loadVibe()` method:
- Fetches the vibe manifest from the specified path
- Validates that it's a proper vibe (`$type: "vibe"`)
- Resolves the actor path relative to the vibe location
- Calls `os.createActor()` with the resolved path
- Returns both the vibe metadata and the created actor

## Vibe vs Actor vs View

Understanding the hierarchy:

```
Vibe (App Manifest)
  └── Actor (Component)
        ├── Context (Runtime Data)
        ├── State (Behavior)
        ├── View (UI)
        └── Style (Appearance)
```

**Vibe:**
- Marketplace metadata
- Entry point reference
- What users see in app store

**Actor:**
- Component definition
- References to behavior and UI
- What the app actually is

**View:**
- UI structure
- What users see when running the app

> **Think of it like this:**
> - **Vibe** = App Store listing
> - **Actor** = Installed application
> - **View** = Application window

## Example: Complete Todo App

### Directory Structure

```
vibes/todos/
├── manifest.vibe.maia      # App manifest (references @actor/agent)
├── index.html              # App launcher
├── agent/                  # Agent service actor (ALWAYS CREATE FIRST)
│   ├── agent.actor.maia    # Agent actor definition
│   ├── agent.context.maia  # Agent context
│   ├── agent.state.maia    # Agent state machine
│   ├── agent.view.maia    # Minimal view (renders child)
│   ├── agent.interface.maia # Message interface
│   ├── agent.subscriptions.maia # Subscriptions colist
│   ├── agent.inbox.maia   # Inbox costream
│   └── brand.style.maia   # Shared design system
├── composite/              # Composite actor (first UI actor)
│   ├── composite.actor.maia
│   ├── composite.context.maia
│   ├── composite.state.maia
│   ├── composite.view.maia
│   ├── composite.interface.maia
│   ├── composite.subscriptions.maia
│   └── composite.inbox.maia
├── list/                   # UI actor
│   ├── list.actor.maia
│   ├── list.context.maia
│   ├── list.state.maia
│   ├── list.view.maia
│   ├── list.interface.maia
│   ├── list.subscriptions.maia
│   └── list.inbox.maia
└── kanban/                 # UI actor
    ├── kanban.actor.maia
    ├── kanban.context.maia
    ├── kanban.state.maia
    ├── kanban.view.maia
    ├── kanban.interface.maia
    ├── kanban.subscriptions.maia
    └── kanban.inbox.maia
```

**Note:** The agent directory is created first and contains the orchestrating service actor that all other actors depend on.

### Vibe Manifest

**`manifest.vibe.maia`:**
```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application with state machines, drag-drop kanban view, and AI-compatible tools. Showcases MaiaOS actor system, message passing, and declarative UI.",
  "actor": "@actor/agent"
}
```

**Note:** The vibe references the **agent service actor** (`@actor/agent`) which orchestrates the application and loads UI actors as children. The agent is always defined first.

### Launcher HTML

**`index.html`:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Todos</title>
</head>
<body>
  <div id="actor-todo"></div>
  
  <script type="module">
    import { MaiaOS } from '../../o/kernel.js';
    
    async function boot() {
      const os = await MaiaOS.boot({
        modules: ['db', 'core', 'dragdrop', 'interface']
      });
      
      // Load the vibe
      const { vibe, actor } = await os.loadVibe(
        './manifest.vibe.maia',
        document.getElementById('actor-todo')
      );
      
      console.log('✅ Vibe loaded:', vibe.name);
      
      // Expose for debugging
      window.vibe = vibe;
      window.actor = actor;
    }
    
    boot();
  </script>
</body>
</html>
```

## Best Practices

### ✅ DO:

- **Always create agent first** - Define `@actor/agent` before any UI actors
- **Use schema references** - `@schema/vibe`, `@actor/agent` (transformed to co-ids during seeding)
- **Keep descriptions concise** - 1-3 sentences max
- **Use semantic naming** - `manifest.vibe.maia`, `agent/agent.actor.maia`
- **Reference agent in vibe** - Always use `"actor": "@actor/agent"` in vibe manifest
- **One vibe per app** - Each app gets its own vibe manifest

### ❌ DON'T:

- **Don't skip the agent** - Every vibe MUST have an agent service actor
- **Don't use file paths** - Use schema references (`@actor/agent`, not `"./agent.actor.maia"`)
- **Don't include logic** - Vibes are metadata only
- **Don't duplicate actor properties** - Vibe references actor, doesn't contain it
- **Don't skip schema** - Always include `$schema: "@schema/vibe"`
- **Don't nest actors** - Reference one root actor only (the agent)

## Marketplace Integration (Future)

Vibes are designed to support future marketplace features:

**Planned Fields (v0.5+):**
- `icon` - Path to app icon
- `screenshots` - Array of screenshot paths
- `tags` - Array of category tags
- `category` - Primary app category
- `license` - License type (MIT, GPL, etc.)
- `repository` - Source code URL
- `homepage` - App website URL

**Example Future Vibe:**
```json
{
  "$type": "vibe",
  "$id": "vibe_todos_001",
  "name": "Todo List",
  "description": "A complete todo list application...",
  "actor": "./todo.actor.maia",
  "icon": "./icon.svg",
  "screenshots": ["./screenshots/list.png", "./screenshots/kanban.png"],
  "tags": ["productivity", "task-management"],
  "category": "productivity",
  "license": "MIT",
  "repository": "https://github.com/MaiaOS/todos",
  "homepage": "https://maiaos.dev/vibes/todos"
}
```

## Debugging Vibes

### Accessing Vibe Data

```javascript
// After loading
const { vibe, actor } = await os.loadVibe('./app.vibe.maia', container);

// Inspect vibe
console.log(vibe.name);        // "My App"
console.log(vibe.description); // "App description"
console.log(vibe.actor);       // "./myapp.actor.maia"
console.log(vibe.$id);         // "@vibe/todos" (or co-id after seeding)

// Inspect actor (as usual)
console.log(actor.id);         // "actor_myapp_001"
console.log(actor.context);    // Runtime state
```

### Common Issues

**Error: "Failed to load vibe"**
- Check that the vibe file exists at the specified path
- Verify the path is correct relative to your HTML file

**Error: "Invalid vibe manifest: $type must be 'vibe'"**
- Ensure your JSON has `"$type": "vibe"`
- Check for typos in the $type field

**Error: "Vibe manifest missing 'actor' field"**
- Add the `"actor"` field with path to your actor file
- Verify the actor path is relative to the vibe location

**Actor fails to load**
- Check that the actor file exists at the path specified in the vibe
- Verify the path is relative to the vibe location (not the HTML file)

## Next Steps

- Learn about [Kernel](./01-kernel.md) - How to boot MaiaOS and load vibes
- Understand [Actors](./02-actors.md) - What vibes reference
- Explore [State Machines](./05-state.md) - Actor behavior
- Create [Views](./07-views.md) - Actor UI

---

**Remember:** Vibes are the "app store wrapper" around your actors. They make your apps discoverable, installable, and marketplace-ready!
