# Composing Actors

**Composition** is combining smaller actors into larger ones. Think LEGO blocks.

## Leaf vs Composite Actors

**Leaf actors:** Terminal components. Render UI directly. No child actors.

**Composite actors:** Containers. Hold other actors in slots. Shared structure (header, form).

## How Slots Work

**Syntax:** `"$slot": "$currentView"` - context property contains `@namekey` reference.

**Resolution:** ViewEngine extracts namekey from `@namekey` → finds `actor.children[namekey]` → attaches to slot element.

**Unified pattern:** All slots work the same. Everything is CRDT CoValue.

**Context defines children:**
```json
{
  "currentView": "@list",
  "@actors": {
    "list": "@actor/list",
    "kanban": "@actor/kanban"
  }
}
```

**State machine switches view:**
```json
{
  "on": {
    "SWITCH_VIEW": {
      "actions": [
        { "updateContext": { "currentView": "@list" } }
      ]
    }
  }
}
```

## Building a Composable App

1. **Identify components** - Header, input, list, footer
2. **Create leaf actors** - One per piece
3. **Create composite root** - Composes all via `@actors` and slots

**Example structure:**
```
app (composite)
├── @header (slot)
├── @input (slot)
├── @currentView (slot - switches @list / @kanban)
└── @footer (slot)
```

## Message Passing Between Actors

Actors communicate via **inbox costreams**, not props. Use `@core/publishMessage` in state machine actions. Messages auto-route to state machine.

## Common Patterns

**Layout:** `$slot` for header, main, footer. `$slot`: "$currentView" for view switcher.

**List with items:** `$each` with `items` and `template`.

**View switching:** State machine `updateContext` sets `currentView` to `@list` or `@kanban`.

## Best Practices

**✅ DO:** Small focused actors, clear slot names, message-based communication, define children in context `@actors`.

**❌ DON'T:** Monolithic actors, prop drilling, circular dependencies, conditional logic in views.

---

## Next Steps

- [State Machines](../05-state.md) - Actor behavior
- [Context](../04-context.md) - Runtime data management
- [Views](../08-views.md) - UI representation
- [Best Practices](../12-best-practices.md) - Architecture patterns

## Debugging Actors

```javascript
window.actor = actor;
actor.context.value     // Current context
actor.machine.currentState  // Current state
actor.inbox            // Messages
// DevTools: expand #shadow-root for Shadow DOM
```
