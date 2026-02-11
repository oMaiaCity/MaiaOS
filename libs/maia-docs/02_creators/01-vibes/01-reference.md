# Vibes Reference

*Continued from [00-overview.md](./00-overview.md)*

## Example: Sparks Vibe (continued)

### View (`vibe.view.maia`)

```json
{
  "$schema": "@schema/view",
  "$id": "@sparks/view/vibe",
  "content": {
    "tag": "div",
    "class": "stack",
    "children": [
      {
        "tag": "h2",
        "text": "My Sparks"
      },
      {
        "tag": "input",
        "attrs": {
          "placeholder": "$inputPlaceholder",
          "value": "$newSparkName"
        },
        "$on": {
          "input": {
            "send": "UPDATE_INPUT",
            "payload": { "newSparkName": "$event.target.value" }
          }
        }
      },
      {
        "tag": "button",
        "text": "$createButtonText",
        "$on": {
          "click": {
            "send": "CREATE_BUTTON"
          }
        }
      },
      {
        "tag": "div",
        "class": "sparks-list",
        "$each": {
          "items": "$sparks",
          "template": {
            "tag": "div",
            "class": "spark-item",
            "children": [
              {
                "tag": "h3",
                "text": "$$name"
              },
              {
                "tag": "div",
                "text": "Group: $$group"
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Key:** Uses `$each` to display sparks reactively from the query object.

## Example: Complete Todo App

### Directory Structure

```
vibes/todos/
├── manifest.vibe.maia      # App manifest (references @actor/vibe)
├── index.html              # App launcher
├── vibe/                   # Vibe root service actor (ALWAYS CREATE FIRST)
│   ├── vibe.actor.maia     # Root actor definition
│   ├── vibe.context.maia   # Root context (defines children via @actors)
│   ├── vibe.state.maia     # Root state machine
│   ├── vibe.view.maia      # Minimal view (renders child)
│   ├── vibe.inbox.maia     # Inbox costream
│   └── brand.style.maia    # Shared design system
├── composite/              # Composite actor (first UI actor)
│   ├── composite.actor.maia
│   ├── composite.context.maia
│   ├── composite.state.maia
│   ├── composite.view.maia
│   └── composite.inbox.maia
├── list/                   # UI actor
│   ├── list.actor.maia
│   ├── list.context.maia
│   ├── list.state.maia
│   ├── list.view.maia
│   └── list.inbox.maia
└── kanban/                 # UI actor
    ├── kanban.actor.maia
    ├── kanban.context.maia
    ├── kanban.state.maia
    ├── kanban.view.maia
    └── kanban.inbox.maia
```

**Note:** The vibe directory is created first and contains the orchestrating root actor that all other actors depend on.

### Vibe Manifest

**`manifest.vibe.maia`:**
```json
{
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application with state machines, drag-drop kanban view, and AI-compatible tools. Showcases MaiaOS actor system, message passing, and declarative UI.",
  "actor": "@actor/vibe"
}
```

**Note:** The vibe references the **vibe root service actor** (`@actor/vibe`) which orchestrates the application and loads UI actors as children. The vibe root is always defined first.

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
    import { MaiaOS } from '@MaiaOS/kernel';
    
    async function boot() {
      const os = await MaiaOS.boot({
        modules: ['db', 'core', 'dragdrop']
      });
      
      // Load the vibe (by key from account.sparks[@maia].vibes or by co-id)
      const { vibe, actor } = await os.loadVibe(
        'todos',
        document.getElementById('actor-todo'),
        '@maia'
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

- **Always create vibe root first** - Define `@actor/vibe` before any UI actors
- **Use schema references** - `@schema/vibe`, `@actor/vibe` (transformed to co-ids during seeding)
- **Keep descriptions concise** - 1-3 sentences max
- **Use semantic naming** - `manifest.vibe.maia`, `vibe/vibe.actor.maia`
- **Reference vibe root in manifest** - Always use `"actor": "@actor/vibe"` in vibe manifest
- **One vibe per app** - Each app gets its own vibe manifest

### ❌ DON'T:

- **Don't skip the vibe root** - Every vibe MUST have a vibe root service actor
- **Don't use file paths** - Use schema references (`@actor/vibe`, not `"./vibe.actor.maia"`)
- **Don't include logic** - Vibes are metadata only
- **Don't duplicate actor properties** - Vibe references actor, doesn't contain it
- **Don't skip schema** - Always include `$schema: "@schema/vibe"`
- **Don't nest actors** - Reference one root actor only (`@actor/vibe`)

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
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application...",
  "actor": "@actor/vibe",
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
// After loading (by key or co-id from account)
const { vibe, actor } = await os.loadVibe('todos', container, '@maia');
// Or by co-id: os.loadVibe('co_z...', container);

// Inspect vibe
console.log(vibe.name);        // "My App"
console.log(vibe.description); // "App description"
console.log(vibe.actor);       // co-id (e.g. "co_z...")
console.log(vibe.$id);         // "@vibe/todos" (or co-id after seeding)

// Inspect actor (as usual)
console.log(actor.id);         // "actor_myapp_001"
console.log(actor.context);    // Runtime state
```

### Common Issues

**Error: "Failed to load vibe"**
- Check that the vibe file exists at the specified path
- Verify the path is correct relative to your HTML file

**Error: "Invalid vibe manifest"**
- Ensure your JSON has `"$schema": "@schema/vibe"`
- Check for typos in the $schema field

**Error: "Vibe manifest missing 'actor' field"**
- Add the `"actor"` field with path to your actor file
- Verify the actor path is relative to the vibe location

**Actor fails to load**
- Check that the actor file exists at the path specified in the vibe
- Verify the path is relative to the vibe location (not the HTML file)

## Next Steps

- [Kernel](../02-kernel.md) - How to boot MaiaOS and load vibes
- [Actors](../03-actors/) - What vibes reference
- [State Machines](../05-state/) - Actor behavior
- [Views](../08-views/) - Actor UI

---

**Remember:** Vibes are the "app store wrapper" around your actors. They make your apps discoverable, installable, and marketplace-ready!
