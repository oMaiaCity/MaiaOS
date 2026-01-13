# MaiaOS Pure JavaScript Prototype

A complete, framework-free proof-of-concept demonstrating the MaiaOS architecture with `.maia` DSL files, Shadow DOM isolation, and Constructable Stylesheets.

## 🎯 Purpose

This prototype validates the core MaiaOS concepts:
- **Pure JavaScript** - No framework dependencies
- **`.maia` DSL files** - JSON-based declarative definitions
- **Three-engine architecture** - ActorEngine, ViewEngine, StyleEngine
- **Shadow DOM** - Complete style isolation per actor
- **Constructable Stylesheets** - Efficient style distribution
- **Fake CoMap IDs** - Simulates Jazz reference pattern for future integration

## 📁 Architecture

```
todo-prototype/
├── engines/              # Core rendering engines
│   ├── ActorEngine.js    # Orchestrates actors, actions, lifecycle
│   ├── ViewEngine.js     # Renders view DSL to Shadow DOM
│   ├── StyleEngine.js    # Compiles style DSL to CSS
│   └── MaiaScriptEvaluator.js  # DSL expression evaluator
├── maia/                 # .maia DSL files
│   ├── brand.style.maia  # Complete design system (tokens + components)
│   ├── todo.style.maia   # Actor-specific style overrides
│   ├── todo.view.maia    # View template with DSL operations
│   └── todo.actor.maia   # Actor definition with context
├── index.html            # Demo page
└── README.md             # This file
```

## 🚀 How to Run

1. **Serve the directory** (needs a local server for ES modules):
   ```bash
   # From project root
   cd libs/maia-script/src/examples/todo-prototype
   
   # Using Python
   python3 -m http.server 8000
   
   # Or using Node.js http-server
   npx http-server -p 8000
   
   # Or using PHP
   php -S localhost:8000
   ```

2. **Open in browser**:
   ```
   http://localhost:8000
   ```

3. **Inspect Shadow DOM**:
   - Open DevTools
   - Navigate to Elements tab
   - Expand `#actor-container` → `#shadow-root (open)`
   - See isolated styles and rendered view

## 📚 File Format: `.maia`

### Actor Definition (`todo.actor.maia`)

```json
{
  "$type": "actor",
  "$id": "actor_todo_001",
  "viewRef": "co_view_001",        // Fake CoMap ID → view file
  "brandRef": "co_brand_001",      // Fake CoMap ID → brand file
  "styleRef": "todo",              // Actor-specific overrides
  "context": {
    "title": "My Todos",
    "newTodoText": "",
    "todos": []
  }
}
```

**Structure:**
- `viewRef` → Points to view template (future: Jazz CoMap)
- `brandRef` → Points to design system (future: Jazz CoMap)
- `styleRef` → Optional actor-specific style overrides
- `context` → Reactive data (all template variables live here)

### View Definition (`todo.view.maia`)

```json
{
  "$type": "view",
  "$id": "co_view_001",
  "root": {
    "tag": "div",
    "class": "todo-container",
    "children": [
      {
        "tag": "h1",
        "text": { "$context": "title" }
      },
      {
        "tag": "input",
        "value": { "$context": "newTodoText" },
        "$on": {
          "input": {
            "action": "@context/update",
            "payload": { "newTodoText": "@inputValue" }
          }
        }
      }
    ]
  }
}
```

**DSL Operations:**
- `$context` → Access actor context values
- `$item` → Access foreach item properties
- `$if` → Conditional rendering
- `$each` → Loop over arrays
- `$on` → Event handlers

### Style Definition (`brand.style.maia`)

```json
{
  "$type": "brand.style",
  "$id": "co_brand_001",
  "tokens": {
    "colors": {
      "primary": "#3b82f6"
    },
    "spacing": {
      "md": "1rem"
    }
  },
  "components": {
    "button": {
      "padding": "{spacing.md}",
      "background": "{colors.primary}",
      "color": "white"
    }
  }
}
```

**Features:**
- **Tokens** → Design tokens (colors, spacing, typography, etc.)
- **Components** → CSS class definitions
- **Interpolation** → `{token.path}` resolved at compile time
- **Inheritance** → Actor styles override brand styles

## 🔧 Engine API

### MaiaScriptEvaluator

```javascript
const evaluator = new MaiaScriptEvaluator();

// Evaluate DSL expressions
evaluator.evaluate({ $context: "title" }, { context: { title: "Hello" } });
// → "Hello"

evaluator.evaluate({ $item: "name" }, { item: { name: "Todo 1" } });
// → "Todo 1"

evaluator.evaluate(
  { $if: { condition: { $item: "done" }, then: "✓", else: "○" } },
  { item: { done: true } }
);
// → "✓"
```

### StyleEngine

```javascript
const styleEngine = new StyleEngine();

// Get compiled stylesheets for an actor
const sheets = await styleEngine.getStyleSheets(actorConfig);
// → [CSSStyleSheet]

// Styles are cached by (brandRef + styleRef)
// Brand tokens + actor overrides are deep merged
// Result compiled to CSS variables + classes
```

### ViewEngine

```javascript
const viewEngine = new ViewEngine(evaluator);

// Render view into shadow root
viewEngine.render(viewDef, context, shadowRoot, styleSheets);

// Handles:
// - Recursive node rendering
// - $each loops (DocumentFragment)
// - $if conditionals
// - Event attachment
// - DSL evaluation via MaiaScriptEvaluator
```

### ActorEngine

```javascript
const actorEngine = new ActorEngine(styleEngine, viewEngine);

// Load and create actor
const config = await actorEngine.loadActor('./maia/todo.actor.maia');
await actorEngine.createActor(config, containerElement);

// Actors render into shadow DOM with isolated styles
// Actions dispatched from view are handled by ActorEngine
// Context updates trigger re-render
```

## 🎨 Design System Architecture

**Brand = Complete Design System**
- All design tokens (colors, spacing, typography, radii, shadows)
- All component definitions (button, input, todoItem, etc.)
- Shared across all actors

**Actor = Overrides Only**
- Optional actor-specific token overrides
- Inherits everything else from brand
- Deep merge: actor wins on conflicts

**Result = One Unified Stylesheet**
- Brand + actor merged at runtime
- Compiled to CSS once
- Cached for performance
- Adopted by shadow root via Constructable Stylesheets

## 🔄 Reactivity & Re-rendering

**Current (Prototype):**
- Context updates trigger full re-render
- Simple but inefficient (fine for prototype)

**Future (Jazz Integration):**
- Jazz CoMap reactivity → fine-grained updates
- Only changed nodes re-render
- ViewEngine subscribes to CoMap changes
- Automatic reactive propagation

## 🧪 DSL Examples

### Conditionals

```json
{
  "class": {
    "$if": {
      "condition": { "$item": "done" },
      "then": "todo-item todo-item-done",
      "else": "todo-item"
    }
  }
}
```

### Foreach Loops

```json
{
  "$each": {
    "items": { "$context": "todos" },
    "template": {
      "tag": "div",
      "text": { "$item": "text" }
    }
  }
}
```

### Event Handling

```json
{
  "tag": "button",
  "text": "Add",
  "$on": {
    "click": {
      "action": "@core/createTodo",
      "payload": {
        "text": { "$context": "newTodoText" }
      }
    }
  }
}
```

### Context Access

```json
{
  "tag": "h1",
  "text": { "$context": "title" }
}
```

## 🎯 Success Criteria

- ✅ Load and parse all `.maia` files
- ✅ Render todo UI in Shadow DOM with styles
- ✅ Add new todos via input + button
- ✅ Toggle todo done state with checkmark
- ✅ Delete todos with X button
- ✅ Brand styles applied via Constructable Stylesheet
- ✅ Actor styles override brand (purple primary color)
- ✅ Complete style isolation (inspect shadow roots)
- ✅ All DSL operations work ($context, $item, $if, $each, $on)
- ✅ Clean code architecture ready for Jazz integration

## 🔮 Future: Jazz Integration

**Current (Hardcoded):**
```javascript
const brand = await fetch('./maia/co_brand_001.style.maia');
```

**Future (Jazz CoMaps):**
```javascript
const brand = root.schemata.get('co_brand_001');
// → Returns reactive Jazz CoMap
// → StyleEngine subscribes to changes
// → Auto-recompiles CSS on token updates
```

**Benefits:**
1. **Reactive updates** - Change token → all actors update instantly
2. **Shared state** - Multiple actors reference same CoMap (memory efficient)
3. **User customization** - Users can fork design systems
4. **Versioning** - Jazz handles version control
5. **Collaboration** - Shared design systems across team

## 🐛 Debugging

**DevTools Console:**
```javascript
// Engines available globally
window.MaiaOS.actorEngine
window.MaiaOS.viewEngine
window.MaiaOS.styleEngine
window.MaiaOS.evaluator

// Get actor instance
const actor = window.MaiaOS.actorEngine.getActor('actor_todo_001');
console.log(actor.context);

// Manually trigger action
window.MaiaOS.actorEngine.handleAction('@core/createTodo', { text: 'Debug todo' });
```

**Shadow DOM:**
- Inspect `#actor-container` → `#shadow-root`
- See isolated DOM tree
- See adopted stylesheets
- CSS variables scoped to `:host`

## 📝 Key Learnings

1. **Shadow DOM works perfectly** for actor isolation
2. **Constructable Stylesheets** are efficient for shared brand tokens
3. **Deep merge + CSS cascade** gives clean override semantics
4. **Pure DSL approach** (no inline logic) keeps views declarative
5. **Three-engine separation** provides clean architecture boundaries
6. **Fake CoMap IDs** smoothly simulate Jazz pattern
7. **Zero dependencies** proves the concepts are sound

## 🎓 Next Steps

1. **Add more DSL operations** - `$each` with index, `$switch`, `$map`
2. **Improve reactivity** - Fine-grained updates instead of full re-render
3. **Add animations** - CSS transitions, view transitions API
4. **Jazz integration** - Replace fake IDs with real CoMaps
5. **Performance** - Virtual DOM diffing, keyed lists
6. **DevTools** - Custom inspector for .maia files
7. **Hot reload** - Auto-refresh on file changes

---

Built with ❤️ as a proof-of-concept for MaiaOS architecture.
