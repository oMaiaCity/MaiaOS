- ✅ No `$if` conditionals - all handled by state machine + CSS

## View Best Practices

### ✅ DO:

- **Keep views declarative** - Zero logic, only structure
- **Use semantic HTML** - `<button>` not `<div onclick>`
- **Structure hierarchically** - Logical parent-child relationships
- **Use clear event names** - `CREATE_TODO` not `submit` or `click`
- **Use data-attributes for styling** - State machine computes, CSS styles
- **Use `$each` for lists** - Don't manually duplicate structures
- **Use `$on` for events** - Consistent with other DSL operations
- **Use `$slot` for composition** - Consistent with other DSL operations
- **Reference context values directly** - `"data": "$listButtonActive"`
- **Extract hardcoded strings** - Use context variables for all UI text (e.g., `"text": "$toggleButtonText"`)
- **Use generic template variables** - Match context key names (e.g., `$$fromRole`, `$$toRole` for log entries)

### ❌ DON'T:

- **Don't use `$if` in views** - All conditionals handled by state machine + CSS
- **Don't put logic in views** - Use state machines to compute boolean flags
- **Don't hardcode data** - Use context references
- **Don't duplicate structures** - Use `$each` loops
- **Don't use `on` (use `$on`)** - Maintain DSL consistency
- **Don't use `slot` (use `$slot`)** - Maintain DSL consistency
- **Don't create deep nesting** - Extract to sub-views (future feature)
- **Don't mix concerns** - Separate layout from data
- **Don't hardcode strings** - Extract all UI text to context variables (e.g., don't use `"text": "✓"`, use `"text": "$toggleButtonText"`)
- **Don't use specific names** - Use generic template variable names that match context keys

## Shadow DOM Isolation

Each actor renders into its own Shadow DOM:

```html
<div id="actor-todo">
  #shadow-root (open)
    <style>/* Actor styles */</style>
    <div class="todo-app">
      <!-- View rendered here -->
    </div>
</div>
```

**Benefits:**
- ✅ Style isolation (no CSS leakage)
- ✅ DOM encapsulation (clean inspector)
- ✅ Multiple instances (no ID conflicts)

## Accessing DOM Elements

Views are rendered to Shadow DOM, accessible via:

```javascript
// Get shadow root
const shadowRoot = actor.container.shadowRoot;

// Query elements
const input = shadowRoot.querySelector('input');
const buttons = shadowRoot.querySelectorAll('button');

// Inspect in DevTools
// Click actor container → Expand #shadow-root
```

## View Debugging

```javascript
// Expose actor globally
window.actor = actor;

// Inspect view definition
console.log(actor.viewDef);

// Trigger manual re-render
actor.actorEngine.rerender(actor);

// Log events
const originalSend = actor.actorEngine.stateEngine.send;
actor.actorEngine.stateEngine.send = function(machineId, event, payload) {
  console.log('Event sent:', event, payload);
  return originalSend.call(this, machineId, event, payload);
};
```

## Expression Syntax

### Context References (`$`)
```json
{"value": "$newTodoText"}        // context.newTodoText
{"class": "$viewMode"}            // context.viewMode
{"data": "$listButtonActive"}     // Maps to data-list-button-active attribute
```

### Item References (`$$`) (in `$each` loops)
```json
{"text": "$$text"}                // item.text
{"data-id": "$$id"}               // item.id
```

### Item Lookup Syntax (`$contextObject.$$itemKey`)
```json
{"data": {"isDragged": "$draggedItemIds.$$id"}}  // Looks up draggedItemIds[item.id]
```

**How it works:**
- `$draggedItemIds` → context object `{ "item-123": true, "item-456": false }`
- `$$id` → current item's ID (e.g., `"item-123"`)
- ViewEngine evaluates `draggedItemIds["item-123"]` → `true`
- Sets `data-is-dragged="true"` on element

### Special Event Values (`@`)
```json
{"payload": {"text": "@inputValue"}}     // input.value
{"payload": {"checked": "@checked"}}      // input.checked
{"payload": {"column": "@dataColumn"}}   // element.getAttribute("data-column")
```

## Allowed Operations

Views support only these operations:

| Operation | Syntax | Purpose |
|-----------|--------|---------|
| `$each` | `{"$each": {"items": "$todos", "template": {...}}}` | List rendering |
| `$on` | `{"$on": {"click": {...}}}` | Event handlers |
| `$slot` | `{"$slot": "$currentView"}` | Actor composition |
| `$contextKey` | `"$viewMode"`, `"$$id"` | Variable references |

**Removed Operations:**
- ❌ `$if` - **Templates are dumb!** Use state machine + data-attributes + CSS instead
- ❌ `slot` - Migrated to `$slot` for consistency
- ❌ `on` - Migrated to `$on` for consistency

**Remember the Architecture:**
- **State Machines** → Define state (all logic)
- **Context** → Realtime reactive snapshot of current state reflection
- **Templates** → Dumb, just render context (zero logic)

## Next Steps

- Learn about [State Machines](./05-state.md) - How views trigger events
- Explore [Context](./04-context.md) - What views display
- Understand [Brand](./08-brand.md) - Design system for views
- Read [Style](./09-style.md) - Additional styling
