# Clean Context Architecture

## Principle: Generic & Reusable Across All Actors

**NO special edge cases. NO exceptions. ONE consistent pattern.**

---

## Data Structure (ActorRenderer → Views)

All actors pass data to their views using this **exact structure**:

```typescript
const dataForViews = {
  context: resolvedContextWithQueries,  // Actor's context + populated queries
  childActors,                          // Child actor CoStates (for rendering)
  item,                                 // Item from foreach loop (if applicable)
  accountCoState                        // Global Jazz account
}
```

### Key Properties:

1. **`context`** - The actor's context object containing:
   - `visible` - Visibility flag
   - `queries` - Query definitions with populated `items`
   - Any custom context properties (e.g., `newTodoText`, `error`)

2. **`childActors`** - Array of child actor CoStates

3. **`item`** - Current item in a `foreach` loop (optional)

4. **`accountCoState`** - Global Jazz account for skills

---

## Path Resolution Rules

### ✅ Always Use `context.*` Prefix

All actor context properties MUST be accessed via `context.*`:

```typescript
// ✅ CORRECT - Generic & Reusable
valuePath: 'context.newTodoText'
items: 'context.queries.todos.items'
buttonDisabled: "!context.newTodoText || context.newTodoText.trim() === ''"
errorVisible: "context.error"
```

```typescript
// ❌ WRONG - Inconsistent & Brittle
valuePath: 'newTodoText'
items: 'queries.todos.items'
buttonDisabled: "!newTodoText"
```

### Recognized Data Path Roots

The `resolvePayload` and `resolveValue` functions recognize these prefixes:

- `context.` - Actor context properties
- `item.` - Current foreach item properties
- `queries.` - Legacy support (prefer `context.queries.*`)
- `view.` - Legacy support (prefer `context.*`)
- `data.` - Explicit data object access (rarely needed)

---

## Example: Clean Todo Input Actor

```typescript
const inputSectionActor = Actor.create({
  context: {
    visible: true,
    newTodoText: '',
    error: ''
  },
  view: createInputSectionComposite({
    valuePath: 'context.newTodoText',           // ✅ Explicit context path
    submitPayload: { name: 'context.newTodoText' }, // ✅ Explicit context path
    buttonDisabled: "!context.newTodoText || context.newTodoText.trim() === ''", // ✅ Explicit context path
    errorVisible: "context.error",              // ✅ Explicit context path
    errorText: 'context.error'                  // ✅ Explicit context path
  }),
  // ... rest of actor definition
});
```

---

## Example: Clean List Actor

```typescript
const listActor = Actor.create({
  context: {
    visible: true,
    queries: {
      todos: {
        schemaName: 'Todo',
        items: [] // Populated by ActorRenderer
      }
    }
  },
  view: {
    container: {
      layout: 'flex',
      class: 'flex-col gap-2'
    },
    foreach: {
      items: 'context.queries.todos.items', // ✅ Explicit context path
      key: 'id',
      composite: {
        // ... item rendering
      }
    }
  },
  // ... rest of actor definition
});
```

---

## Benefits of This Architecture

1. **No Naming Conflicts** - `context`, `childActors`, `item`, `accountCoState` are clearly separated
2. **Explicit & Clear** - Always know where data comes from
3. **Generic & Reusable** - Same pattern for ALL actors, no exceptions
4. **Easy to Debug** - Clear data structure in logs
5. **Prevents Bugs** - No accidental property overwrites from spreading

---

## Migration Checklist

When creating or updating actors:

- [ ] Actor context properties accessed via `context.*` prefix
- [ ] Query items accessed via `context.queries.<queryName>.items`
- [ ] Conditional expressions use `context.*` (e.g., `!context.value`)
- [ ] Submit payloads use `context.*` for data paths
- [ ] Error messages use `context.error`
- [ ] No direct property access without `context.` prefix
- [ ] No special edge cases or exceptions

---

## Logging Best Practices

Use the actor logger to trace data flow:

```typescript
logger.log('Data structure:', {
  context: Object.keys(resolvedContextWithQueries),
  hasChildActors: !!childActors,
  hasItem: !!item,
  hasAccountCoState: !!accountCoState
});
```

This shows the clean structure at runtime for debugging.
