# Vibes (App Manifests)

**Vibes** are marketplace-ready app manifests that describe a MaiaOS application. They provide metadata for discovery and reference the root actor that powers the app.

## What is a Vibe?

A vibe is a JSON manifest file (`.vibe.maia`) that serves as an "app store listing" for your MaiaOS application. Think of it as the packaging around your actor-based app that makes it discoverable and installable.

**What vibes provide:**
- App metadata (name, description)
- Reference to the root actor
- Marketplace/catalog integration
- Single entry point for loading apps

**What vibes are NOT:**
- Not the app itself (that's the actor)
- Not execution logic (that's in state machines and tools)
- Not UI definitions (that's in views)

> **Analogy:** If actors are the "executable," vibes are the "app store listing" that describes and loads them.

## Vibe Structure

Create a file named `{name}.vibe.maia`:

```json
{
  "$type": "vibe",
  "$id": "vibe_myapp_001",
  "name": "My App",
  "description": "A description of what this app does",
  "actor": "./myapp.actor.maia"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `$type` | string | Always `"vibe"` |
| `$id` | string | Unique identifier for this vibe |
| `name` | string | Display name for marketplace |
| `description` | string | Brief description of the app |
| `actor` | string | Relative path to root actor file |

### Field Details

**`$type`:** Discriminator field that identifies this as a vibe manifest.

**`$id`:** Unique identifier following the pattern `vibe_{name}_{number}`. Used for internal references.

**`name`:** The human-readable name that appears in marketplace listings, app launchers, etc.

**`description`:** A brief (1-3 sentence) description of what the app does. This appears in marketplace cards and search results.

**`actor`:** Relative path to the root actor file. The path is resolved relative to the vibe manifest location.

## Creating a Vibe

### Step 1: Organize Your App

Structure your app directory:

```
my-app/
├── myapp.vibe.maia       # Vibe manifest
├── myapp.actor.maia      # Root actor
├── myapp.context.maia    # Runtime data
├── myapp.state.maia      # State machine
├── myapp.view.maia       # UI definition
└── myapp.style.maia      # Styling (optional)
```

### Step 2: Create the Vibe Manifest

**`myapp.vibe.maia`:**
```json
{
  "$type": "vibe",
  "$id": "vibe_myapp_001",
  "name": "My Todo App",
  "description": "A simple todo list with drag-and-drop organization",
  "actor": "./myapp.actor.maia"
}
```

### Step 3: Create Your Root Actor

The actor referenced in the vibe is your app's entry point:

**`myapp.actor.maia`:**
```json
{
  "$type": "actor",
  "$id": "actor_myapp_001",
  "id": "actor_myapp_001",
  "contextRef": "myapp",
  "stateRef": "myapp",
  "viewRef": "myapp",
  "styleRef": "brand"
}
```

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
        modules: ['core', 'mutation', 'dragdrop']
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
├── todos.vibe.maia         # App manifest
├── index.html              # App launcher
├── todo.actor.maia         # Root actor
├── todo.context.maia       # Runtime state
├── todo.state.maia         # Behavior (state machine)
├── todo.view.maia          # UI definition
└── brand.style.maia        # Design system
```

### Vibe Manifest

**`todos.vibe.maia`:**
```json
{
  "$type": "vibe",
  "$id": "vibe_todos_001",
  "name": "Todo List",
  "description": "A complete todo list application with state machines, drag-drop kanban view, and AI-compatible tools. Showcases MaiaOS actor system, message passing, and declarative UI.",
  "actor": "./todo.actor.maia"
}
```

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
        toolsPath: '../../o/tools',
        modules: ['core', 'mutation', 'dragdrop']
      });
      
      // Load the vibe
      const { vibe, actor } = await os.loadVibe(
        './todos.vibe.maia',
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

- **Keep descriptions concise** - 1-3 sentences max
- **Use semantic naming** - `todos.vibe.maia`, not `app.vibe.maia`
- **Match vibe and actor names** - `todos.vibe.maia` → `todo.actor.maia`
- **Use relative paths** - `"./actor.maia"` not absolute paths
- **One vibe per app** - Each app gets its own vibe manifest

### ❌ DON'T:

- **Don't hardcode absolute paths** - Use relative paths
- **Don't include logic** - Vibes are metadata only
- **Don't duplicate actor properties** - Vibe references actor, doesn't contain it
- **Don't skip validation** - Always include `$type: "vibe"`
- **Don't nest actors** - Reference one root actor only

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
console.log(vibe.$id);         // "vibe_myapp_001"

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
