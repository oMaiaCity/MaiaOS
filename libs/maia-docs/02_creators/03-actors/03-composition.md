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

Actors communicate via **inbox costreams**, not props. Use the `sendEvent` action in state machines: `{"sendEvent":{"target":"°Maia/...","type":"EVENT_TYPE","payload":{...}}}`. Messages auto-route to the target's state machine.

## Common Patterns

**Layout:** `$slot` for header, main, footer. `$slot`: "$currentView" for view switcher.

**List with items:** `$each` with `items` and `template`.

**View switching:** State machine `updateContext` sets `currentView` to `@list` or `@kanban`.

## Headless Intent Pattern

**Intent actors** should be minimal orchestrators: a root container with a single `$slot` to a **layout actor**. All concrete UI lives in maia-actors layout components.

**Benefits:**
- Intent views contain only structure (e.g. `{"tag":"div","class":"stack","$slot":"$layout"}`)
- Layout actors are reusable across agents (e.g. `headerWithViewSwitcher` for Todos and Creator)
- New agents can reuse layouts without copying view markup

**Example - Headless Todos Intent:**
```json
// intent.view.maia
{"content":{"tag":"div","class":"stack","$slot":"$layout"}}

// intent.context.maia
{"layout":"@layout","@actors":{"layout":"°Maia/actor/views/layout-todos"}}
```

The layout actor (`layout-todos`) owns the header, view switcher, and content slot. See `libs/maia-actors/src/views/` for available layouts.

## Layout Actors (maia-actors)

Layout actors encapsulate shared UI patterns. Available layouts:

| Layout | Used By | Structure |
|--------|---------|-----------|
| `headerWithViewSwitcher` | Todos, Creator | Title + 2 view buttons + content slot |
| `formWithSplit` | Sparks | Form + error + split (list + detail slot) |
| `grid` | Humans | Header + grid of cards |
| `modalChat` | Chat | Paper slot + modal (messages + input) |

Create new layouts in `libs/maia-actors/src/views/{layoutName}/` and register in `seed-config.js`.

## Best Practices

**✅ DO:** Small focused actors, clear slot names, message-based communication, define children in context `@actors`. Use headless intents with layout actors.

**❌ DON'T:** Monolithic actors, prop drilling, circular dependencies, conditional logic in views. Don't embed full UI in intent views.

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
