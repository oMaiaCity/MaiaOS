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

### Default Pattern: Vibe Root Service Actor Entry Point

**Every vibe MUST have a root service actor** as its entry point. This orchestrating service actor handles all business logic, data management, and coordination.

**Best Practice:** Always define the vibe root service actor first when creating a vibe.

**Naming convention:** Use `@actor/vibe` for the vibe's root service actor. This clearly indicates "the actor that IS the vibe" (as opposed to `@actor/agent` which could confuse with AI agents).

```
Vibe → @actor/vibe (Root Service Actor) → Composite Actor → UI Actors
```

**Why `@actor/vibe`?**
- Clear: the vibe's root actor, not to be confused with AI agents
- Consistent: every vibe has `@actor/vibe` as its entry point
- Semantic: the actor that powers the vibe

This pattern ensures:
- ✅ Clear separation of concerns (service logic vs. UI)
- ✅ Scalable architecture (add UI actors as needed)
- ✅ Message-based communication (loose coupling)
- ✅ Consistent structure across all vibes
- ✅ Vibe-first development (define orchestrator first)

## Vibe Structure

Create a file named `manifest.vibe.maia`:

```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application",
  "actor": "@actor/vibe"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `$schema` | string | Schema reference (`@schema/vibe`) - transformed to co-id during seeding |
| `$id` | string | Unique vibe identifier (`@vibe/todos`) - transformed to co-id during seeding |
| `name` | string | Display name for marketplace |
| `description` | string | Brief description of the app |
| `actor` | string | Reference to vibe root service actor (`@actor/vibe`) - transformed to co-id during seeding |

### Field Details

**`$schema`:** Schema reference (`@schema/vibe`) - identifies this as a vibe manifest and is transformed to co-id during seeding.

**`$id`:** Unique vibe identifier (`@vibe/todos`) - transformed to co-id during seeding. Used for internal references.

**`name`:** The human-readable name that appears in marketplace listings, app launchers, etc.

**`description`:** A brief (1-3 sentence) description of what the app does. This appears in marketplace cards and search results.

**`actor`:** Co-id reference to the vibe root service actor (`@actor/vibe`) - transformed to co-id during seeding. When loading from file, the path is resolved relative to the vibe manifest location.

## Creating a Vibe

### Best Practice: Vibe-First Development

**Always create the vibe root service actor first.** This is your app's orchestrator and entry point.

**Why Vibe-First?**
1. **Clear Architecture** - Root actor defines the app's structure and data flow
2. **Data First** - Root actor handles all data operations before UI concerns
3. **UI Second** - UI actors receive data from root actor, keeping them simple
4. **Consistent Pattern** - Every vibe follows the same structure
5. **AI-Friendly** - LLMs understand this pattern and can generate vibes correctly

**Development Order:**
1. ✅ **Create vibe root service actor** (`vibe/vibe.actor.maia`) - ALWAYS FIRST
2. ✅ Create vibe manifest (`manifest.vibe.maia`) - References `@actor/vibe`
3. ✅ Create composite actor (`composite/composite.actor.maia`) - First UI actor
4. ✅ Create UI actors (`list/list.actor.maia`, etc.) - Leaf components

### Step 1: Organize Your App

Structure your app directory:

```
todos/
├── manifest.vibe.maia    # Vibe manifest (references @actor/vibe)
├── vibe/                 # Vibe root service actor (ALWAYS CREATE FIRST)
│   ├── vibe.actor.maia
│   ├── vibe.context.maia
│   ├── vibe.state.maia
│   ├── vibe.view.maia
│   ├── vibe.inbox.maia
│   └── brand.style.maia
├── composite/            # Composite actor (first UI actor)
│   ├── composite.actor.maia
│   └── ...
├── list/                 # UI actors
│   ├── list.actor.maia
│   └── ...
└── brand/                # Brand style (shared design system)
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
  "actor": "@actor/vibe"
}
```

**Note:** The `actor` field references `@actor/vibe` - this is the vibe root service actor that orchestrates the entire vibe.

### Step 3: Create Your Vibe Root Service Actor (ALWAYS FIRST!)

**Best Practice:** Always define the vibe root service actor first. This is your app's orchestrator.

**`vibe/vibe.actor.maia` (Vibe Root Service Actor):**
```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/vibe",
  "role": "agent",
  "context": "@context/vibe",
  "state": "@state/vibe",
  "view": "@view/vibe",
  "brand": "@style/brand",
  "inbox": "@inbox/vibe"
}
```

**Note:** Children are defined in `vibe.context.maia` via `@actors` system property. See [Actors](../03-actors/01-vibe-pattern.md#system-properties-in-context) for details.

**Vibe Root Actor Responsibilities:**
- Orchestrate data queries and mutations
- Manage application-level state
- Coordinate between UI actors via messages
- Handle business logic
- Load composite actor as first child

**Vibe Root View (Minimal):**
```json
{
  "$schema": "@schema/view",
  "$id": "@view/vibe",
  "root": {
    "tag": "div",
    "attrs": { "class": "vibe-container" },
    "$slot": "$composite"  // ← Only renders child actor
  }
}
```

The vibe root actor orchestrates the application and loads UI actors as children. See [Actors](../03-actors/01-vibe-pattern.md) for the complete pattern.

**Why Start with Vibe Root?**
1. **Clear Architecture** - Root actor defines the app's structure
2. **Data First** - Root actor handles all data operations
3. **UI Second** - UI actors receive data from root actor
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
    import { MaiaOS } from '@MaiaOS/loader';
    
    async function boot() {
      // Boot MaiaOS
      const os = await MaiaOS.boot({
        modules: ['db', 'core', 'dragdrop']
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
- Validates that it's a proper vibe (`$schema: "@schema/vibe"`)
- Resolves the actor path relative to the vibe location (when loading from file)
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

## Example: Sparks Vibe (Group Management)

The Sparks vibe demonstrates how to create and manage groups (sparks) using the operations API.

### Directory Structure

```
vibes/sparks/
├── manifest.vibe.maia      # Sparks vibe manifest
├── registry.js             # Registry exports
├── loader.js               # Vibe loader
└── vibe/                   # Vibe root service actor
    ├── vibe.actor.maia     # Root actor definition
    ├── vibe.context.maia   # Context with sparks query
    ├── vibe.state.maia     # State machine for spark CRUD
    ├── vibe.view.maia      # UI for creating and displaying sparks
    └── vibe.inbox.maia     # Inbox costream
```

### Context (`vibe.context.maia`)

```json
{
  "$schema": "@schema/context",
  "$id": "@sparks/context/vibe",
  "sparks": {
    "schema": "@schema/data/spark"
  },
  "newSparkName": "",
  "inputPlaceholder": "Enter spark name...",
  "createButtonText": "Create Spark",
  "error": null
}
```

**Key:** The `sparks` query object automatically creates a reactive store that reads from the indexed colist.

### State Machine (`vibe.state.maia`)

```json
{
  "$schema": "@schema/state",
  "$id": "@sparks/state/vibe",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "CREATE_BUTTON": {
          "target": "creating"
        },
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "newSparkName": "$$newSparkName" }
            }
          ]
        }
      }
    },
    "creating": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "createSpark",
          "name": "$newSparkName"
        }
      },
      "on": {
        "SUCCESS": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "newSparkName": "" }
            }
          ]
        },
        "ERROR": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "error": "$$error" }
            }
          ]
        }
      }
    }
  }
}
```

**Key:** Uses `createSpark` operation which creates both the group and Spark CoMap.
