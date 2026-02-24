# Engine Method Reference

Quick reference for engine methods. See [00-overview.md](./00-overview.md) for descriptions.

---

## ActorEngine

- `createActor(actorConfig, containerElement, agentKey)` - Create view-attached actor
- `spawnActor(actorConfig, options)` - Spawn headless actor
- `destroyActor(actorId)` - Destroy single actor
- `destroyActorsForAgent(agentKey)` - Destroy all actors for agent
- `destroyActorsForContainer(containerElement)` - Destroy all actors for container
- `deliverEvent(senderId, targetId, type, payload)` - Deliver event to actor inbox
- `processEvents(actorId)` - Process pending inbox messages
- `rerender(actorId)` - Trigger rerender (batched)

---

## ViewEngine

- `attachViewToActor(actor, containerElement, actorConfig, agentKey, onBeforeRender)` - Attach view to actor
- `render(viewDef, context, shadowRoot, styleSheets, actorId)` - Render view definition
- `renderNode(nodeDef, data, actorId)` - Render single node
- `renderEach(eachDef, data, actorId)` - Render list items

---

## ProcessEngine

- `createProcess(processDef, actor)` - Create process instance
- `send(processId, event, payload)` - Send event to process (routes to handlers[event])

**Actions in handlers:** `ctx` (context updates), `op` (DB operations), `tell`/`ask` (messaging), `function` (executable)

---

## StyleEngine

- `getStyleSheets(actorConfig, actorId)` - Get compiled CSSStyleSheet array
- `compileToCSS(tokens, components, selectors, containerName)` - Compile full CSS

---

## InboxEngine

- `resolveInboxForTarget(targetId)` - Resolve inbox co-id for target actor
- `deliver(targetId, message)` - Validate and deliver message to inbox
- `validateMessage(actor, message)` - Validate message type and payload

---

## DataEngine

- `execute({ op, ...params })` - Execute any operation
- `registerOperation(opName, { execute })` - Register custom operation

---

## Runtime

- `createActorForView(config, container, agentKey)` - Create view actor
- `destroyActor(id)` - Destroy actor
- `destroyActorsForAgent(key)` - Destroy all for agent
- `destroyActorsForContainer(containerElement)` - Destroy all for container
- `getActorConfig(actorCoId)` - Load actor config from DB
- `start()` - Start inbox watchers
- `watchInbox(inboxCoId, actorId, actorConfig)` - Watch inbox for messages

---

## Event Flow

```
User Action (DOM Event)
  ↓
ViewEngine._handleEvent() - Extracts DOM values, resolves expressions
  ↓
ActorEngine.deliverEvent() - Routes to actor's inbox (InboxEngine)
  ↓
Inbox subscription fires → ActorEngine.processEvents()
  ↓
ProcessEngine.send() - Routes to handlers[event]
  ↓
ProcessEngine._executeActions() - ctx, op, tell, ask, function
  ↓
Context CoValue updated (CRDT)
  ↓
ReactiveStore subscription triggers
  ↓
ViewEngine.rerender() - Re-renders view
```

---

## ModuleRegistry

- `registerModule(name, module, config)` - Register a module
- `getModule(name)` - Get module by name
- `loadModule(name)` - Dynamically load a module
- `listModules()` - List all registered modules

**Import:** `import { Registry as ModuleRegistry } from '@MaiaOS/engines'`

---

## Related Documentation

- [00-overview.md](./00-overview.md) - Engine summaries
- [01-detail.md](./01-detail.md) - Architecture and DataEngine details
- [../api-reference.md](../api-reference.md) - Complete API reference
