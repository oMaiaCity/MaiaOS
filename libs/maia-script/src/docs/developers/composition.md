# Actor Composition (Developer Guide)

**For developers** who want to understand how composite/leaf actor patterns work in MaiaOS.

## Overview

MaiaOS supports **composable actor architecture** where actors can be composed hierarchically:
- **Composite Actors**: Container actors with slots for child actors
- **Leaf Actors**: Terminal actors that render UI or perform tasks
- **Pure Message Passing**: All actor-to-actor communication via inbox/subscriptions

## Composite vs Leaf Views

### Leaf View

A **leaf view** has a `root` property and renders directly to DOM:

```json
{
  "$type": "view",
  "root": {
    "tag": "div",
    "text": "$title"
  }
}
```

**Characteristics:**
- Has `root` property (not `container`)
- Renders directly to Shadow DOM
- No slots or child actors
- Terminal in composition tree

### Composite View

A **composite view** has a `container` property with slots:

```json
{
  "$type": "view",
  "container": {
    "tag": "div",
    "class": "dashboard",
    "slots": {
      "header": "@header",
      "content": "@content",
      "sidebar": "@sidebar"
    }
  }
}
```

**Characteristics:**
- Has `container` property (not `root`)
- Defines slots using `@slotName` syntax
- Child actors fill slots
- Can nest composite → composite → leaf

## Slot Resolution

Slots use `@slotName` syntax to reference child actors:

```json
{
  "container": {
    "slots": {
      "header": "@header",      // Resolves to children.header actor ID
      "content": "@content"      // Resolves to children.content actor ID
    }
  }
}
```

**Resolution Process:**
1. ViewEngine detects `@slotName` reference
2. Looks up `actor.config.children[slotName]` to get child actor ID
3. Renders child actor's Shadow DOM root into slot position
4. Recursively renders nested composites

## Actor Children Map

Actors define children in their `.actor.maia` file:

```json
{
  "$type": "actor",
  "$id": "actor_dashboard_001",
  "children": {
    "header": "actor_header_001",
    "content": "actor_content_001"
  }
}
```

**Key Points:**
- `children` is a map: `slotName → actorId`
- Child actors are created recursively before parent renders
- Parent auto-subscribes to all children
- Children maintain their own Shadow DOM (isolated)

## ViewEngine Composite Rendering

**Flow:**
1. `ViewEngine.render()` detects composite vs leaf
2. Composite: calls `renderComposite()` with container definition
3. For each slot:
   - Resolves `@slotName` to child actor ID
   - Gets child actor instance
   - Clones child's Shadow DOM root into slot
4. Leaf: calls `renderNode()` normally

**Code Reference:**
- `ViewEngine._isCompositeView()` - Detects view type
- `ViewEngine._resolveSlot()` - Resolves `@slotName` to actor ID
- `ViewEngine.renderComposite()` - Renders container with slots

## ActorEngine Child Creation

**Flow:**
1. `ActorEngine.createActor()` checks for `config.children`
2. For each child:
   - Resolves actor ID to filename
   - Loads child actor config
   - Creates child container element
   - Recursively calls `createActor()` for child
   - Stores child reference in `actor.children[slotName]`
   - Auto-subscribes parent to child

**Code Reference:**
- `ActorEngine.resolveActorIdToFilename()` - Maps actor ID to file
- `ActorEngine.createActor()` - Recursive child creation

## Message Passing Between Actors

**Parent → Child:**
- Parent publishes message via `publishMessage()`
- Message validated against parent's `interface.publishes`
- Sent to all actors in parent's `subscriptions` list
- Child receives in inbox, validated against `interface.inbox`

**Child → Parent:**
- Child publishes message
- Parent receives in inbox (if subscribed)
- Parent's state machine processes message

**Example:**
```javascript
// Child actor publishes TODO_CREATED
actorEngine.publishMessage('actor_todo_input_001', 'TODO_CREATED', {
  id: 'todo_123',
  text: 'New todo'
});

// Parent receives in inbox
// Parent's state machine processes TODO_CREATED event
```

## Interface Validation

**Outgoing Messages (Publishes):**
- Validated against `interface.publishes` schema
- Rejected if message type not defined
- Rejected if payload structure doesn't match

**Incoming Messages (Inbox):**
- Validated against `interface.inbox` schema
- Rejected if message type not defined
- Rejected if payload structure doesn't match

**Validation Code:**
- `ActorEngine._validateMessage()` - Validates message against interface
- `ActorEngine.publishToSubscriptions()` - Validates before publishing
- `ActorEngine.sendMessage()` - Validates before adding to inbox

## Recursive Composition

Composite actors can contain other composite actors:

```
vibe_root (composite)
├── @header (view_switcher - leaf)
├── @list (todo_list - composite)
│   └── @item (todo_item - leaf, repeated)
└── @kanban (kanban_view - leaf)
```

**Rendering Order:**
1. Create `vibe_root` actor
2. Create `view_switcher` child → render leaf
3. Create `todo_list` child → render composite
4. Create `todo_item` children → render leaves (repeated)
5. Create `kanban_view` child → render leaf
6. Render `vibe_root` composite with all slots filled

## Best Practices

**✅ DO:**
- Use composite views for layout containers
- Use leaf views for terminal UI components
- Define clear interfaces for message contracts
- Keep children isolated (own Shadow DOM)
- Use descriptive slot names

**❌ DON'T:**
- Don't expose context directly (use message passing)
- Don't create circular child dependencies
- Don't skip interface definitions
- Don't use prop drilling (use messages)

## Future: Jazz CoMap Integration

When migrating to Jazz-native architecture:
- Each actor becomes a CoMap
- `children` map stored in CoMap
- `inbox` becomes CoFeed
- `subscriptions` becomes CoList
- Context dynamically queried (not stored)

**Migration Path:**
- Current: File-based actor definitions
- Future: CoMap-based actor definitions
- Interface validation remains the same
- Message passing becomes CoFeed operations
