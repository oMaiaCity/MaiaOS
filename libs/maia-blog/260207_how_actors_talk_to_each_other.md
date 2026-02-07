---
title: "How Actors Talk to Each Other: The Magic of Message Types and Inboxes"
date: "2026-02-07"
authors: ["Agent Maia", "Samuel Andert"]
tags: ["architecture", "actors", "messaging", "distributed-systems"]
---

# How Actors Talk to Each Other: The Magic of Message Types and Inboxes

When building distributed applications, one of the fundamental challenges is communication: how do different parts of your system talk to each other reliably, especially when they might be running on different devices or networks?

In MaiaOS, we solve this with an actor-based architecture where actors communicate through **typed messages** sent to **inboxes**. This might sound abstract, but once you understand the pattern, it becomes a powerful and elegant way to build distributed systems.

Let me walk you through how this works, starting with what actors are and why we built the system this way.

## What Are Actors? A Quick Introduction

Before diving into messaging, it helps to understand what an actor actually is in MaiaOS.

Think of an actor like a self-contained unit of your application. Each actor has four key parts:

1. **A State Machine** - The actor's "brain" that defines how it behaves and responds to events
2. **A View** - The actor's "face" that renders UI (if it's a UI actor)
3. **A Context** - The actor's "memory" that stores its data and current state
4. **An Inbox** - The actor's "mailbox" where it receives messages

The beautiful thing about actors is that they're **autonomous**. Each actor manages its own state, renders its own UI, and processes its own messages. You compose actors together to build larger applications, like snapping LEGO pieces together.

For example, in a todo app, you might have:
- **A Todo Actor** - Manages todo creation, deletion, and toggling
- **A List Actor** - Displays todos in a list format
- **A Logs Actor** - Shows a history of completed todos

Each actor is independent, but they need to communicate. When you click "Add Todo" in the UI, the Todo Actor needs to know about it. When a todo gets created, the List Actor needs to update to show the new item.

This is where messaging comes in.

## The Challenge: Communication in Distributed Systems

Here's the interesting part: **actors can be on different devices**. Your todo actor might be running on your phone, while your list actor is on your laptop. They're in a **distributed system** - meaning they're spread out across devices and networks, but they still need to work together seamlessly.

This creates a fundamental challenge: how do you ensure reliable communication when:
- Messages might arrive out of order
- Devices might be offline
- Network connections might be unreliable
- Different parts of the system need to stay in sync

Traditional approaches often involve complex message queues, event buses, or direct function calls. But these can become brittle in distributed environments. We needed something better.

## The Solution: Typed Messages + Inboxes

Imagine you're building a todo app. You have different "actors" - think of them like little robots, each with their own job:

- **The Todo Actor**: Manages your todos (create, delete, toggle them)
- **The List Actor**: Shows your todos in a list
- **The Logs Actor**: Shows what you've done

Now, here's the thing: these actors need to talk to each other! When you click "Add Todo" in the UI, the Todo Actor needs to know about it. When a todo gets created, the List Actor needs to update to show the new todo.

But here's the catch: **actors can be on different devices!** Your todo actor might be on your phone, while your list actor is on your laptop. They're in a **distributed system** - meaning they're spread out, but they still need to work together.

Our solution is elegantly simple: every actor has an **inbox** - a persistent, append-only stream of messages. Think of it like a mailbox, but one that's automatically synced across all your devices using CRDTs (Conflict-free Replicated Data Types).

### What's an Inbox?

An inbox is a CoStream - an append-only list that automatically syncs across devices. Each actor has their own inbox, and when someone (or some other actor) wants to communicate with them, they send a message to that inbox.

The message gets persisted immediately and syncs to all devices. Even if your phone is offline when a message is sent, it will appear in the inbox once the device comes back online.

### The Power of Message Types

Here's where it gets interesting: **every message has a type**. Instead of sending generic "messages," we send typed messages like `CREATE_BUTTON`, `TOGGLE_BUTTON`, or `DELETE_BUTTON`. 

This type system serves multiple purposes:
- **Clarity**: The actor immediately knows what kind of action is being requested
- **Validation**: We can validate that the message payload matches what's expected for that type
- **Documentation**: The message types act as a contract, documenting what messages an actor accepts
- **Type Safety**: Like TypeScript for messages, but enforced at runtime across distributed systems

### A Concrete Example: Creating a Todo

Let's trace through what happens when you create a todo in our app. When you type "Buy milk" and click the Add button:

1. **The View sends a typed message**: The button click creates a message with type `CREATE_BUTTON` and a payload containing the actual data:
   ```json
   {
     "type": "CREATE_BUTTON",
     "payload": {
       "text": "Buy milk"
     }
   }
   ```

2. **The message is persisted to the inbox**: This message gets added to the Todo Actor's inbox (a CoStream). The message is immediately persisted to CoJSON, which means it's stored locally and will sync to other devices automatically.

3. **The actor processes the message**: The ActorEngine periodically checks the inbox for new messages. When it finds the `CREATE_BUTTON` message, it routes it to the actor's state machine.

4. **The state machine handles the transition**: The state machine looks at the message type and current state, then decides what to do. It might transition from "idle" to "creating" state, triggering actions that actually create the todo in the database.

## Why Message Types Matter

At first glance, message types might seem like unnecessary ceremony. Why not just send generic messages with arbitrary payloads?

The answer lies in the challenges of distributed systems. When actors can be on different devices, running at different times, and communicating over unreliable networks, you need stronger guarantees.

### 1. **Type Safety Across the Network**

Imagine sending a message to create a todo, but forgetting to include the text field. Without type checking, this error might not surface until much later, or might cause different behavior on different devices.

With message types, we define **exactly** what each message needs using JSON Schema:

```json
{
  "type": "CREATE_BUTTON",
  "payload": {
    "text": "Buy milk"  // REQUIRED - validated before processing
  }
}
```

This creates a contract: "If you send me a `CREATE_BUTTON` message, you MUST include a `text` field that's a non-empty string." The system validates this before the message even reaches the state machine.

### 2. **Self-Documenting Actor Contracts**

When an actor declares what message types it accepts, it's creating an explicit API contract. For example, our Todo Actor might declare:

```json
{
  "messageTypes": [
    "CREATE_BUTTON",
    "TOGGLE_BUTTON",
    "DELETE_BUTTON",
    "UPDATE_INPUT",
    "SWITCH_VIEW"
  ]
}
```

Now any developer (or any other actor) can look at this declaration and immediately understand what messages this actor accepts. It's self-documenting and always up-to-date, because it's part of the actor definition itself.

### 3. **Early Validation and Error Prevention**

Before a message reaches the actor's state machine, we validate it at multiple levels:

- ✅ **Message type validation**: Does this actor accept this message type?
- ✅ **Payload schema validation**: Does the payload match the expected schema for this message type?
- ✅ **Data validity**: Are all required fields present? Are they the correct types?

If validation fails, we reject the message immediately with a clear error. This prevents invalid messages from causing unpredictable behavior in the state machine. It's like having a gatekeeper that checks everything before it enters the system.

## The Two-Layer Architecture: Validation vs. Conditional Logic

One of the key architectural decisions we made was to separate **validation** (is this message valid?) from **conditional logic** (should we process this message right now?).

This separation creates a clean, maintainable system where each layer has a single, well-defined responsibility.

### Layer 1: Validation (ActorEngine)

**Question**: "Is this message structurally valid?"

This happens in the **ActorEngine** before the message reaches the state machine. We check:

- ✅ Does the actor accept this message type? (Is it in the actor's `messageTypes` list?)
- ✅ Does the payload match the message type's schema? (Are all required fields present? Are they the correct types?)

**Example**: If someone sends a `CREATE_BUTTON` message without a `text` field, or with `text` as a number instead of a string, we reject it here. The message never reaches the state machine, preventing invalid data from causing unpredictable behavior.

### Layer 2: Conditional Logic (StateEngine)

**Question**: "Should this transition happen given the current state?"

This happens in the **StateEngine** after validation passes. We check:

- ✅ Is the actor in a state that can handle this message? (Can it process this message type in its current state?)
- ✅ Do the guard conditions pass? (Is `context.canCreate` true? Is the actor not already processing another request?)

**Example**: Even if a `CREATE_BUTTON` message is valid, if the actor is already in the "creating" state (perhaps processing a previous request), the guard might prevent starting another creation. This is conditional logic based on runtime state, not message validity.

This separation is crucial: validation catches structural problems early, while conditional logic handles runtime behavior. They serve different purposes and shouldn't be mixed.

## A Complete Example: Creating a Todo

Let's trace through the complete flow of what happens when you create a todo, from button click to database persistence.

### Step 1: User Interaction

You type "Buy milk" in the input field and click the Add button. The view (UI layer) captures this interaction and prepares a message.

**Important detail**: The view **resolves all expressions before sending**. It doesn't send `"$newTodoText"` (a reference to a context variable) - it resolves that expression and sends the actual value `"Buy milk"`. 

Why? Because in distributed systems, expressions require evaluation context that might not exist on remote devices. Messages must contain only resolved, concrete values that can be serialized to JSON and synced across devices.

### Step 2: Message Persistence

The resolved message gets added to the Todo Actor's inbox:
```json
{
  "type": "CREATE_BUTTON",
  "payload": {
    "text": "Buy milk"
  }
}
```

The inbox is a CoStream - an append-only list that automatically syncs across all devices using CRDTs. Even if your phone is offline, the message will sync once it reconnects.

### Step 3: Validation Layer (ActorEngine)

The ActorEngine processes messages from the inbox. For each message, it performs validation:

- ✅ **Message type check**: Does the Todo Actor accept `CREATE_BUTTON` messages? (Yes, it's declared in the actor's `messageTypes`)
- ✅ **Schema validation**: Does the payload match the schema for `CREATE_BUTTON`? (Yes, `text` is a non-empty string)

If validation fails, the message is rejected with a clear error, and it never reaches the state machine. If validation passes, the message proceeds to the state machine.

### Step 4: State Machine Processing (StateEngine)

The StateEngine receives the validated message and evaluates it against the current state machine configuration:

```json
{
  "idle": {
    "on": {
      "CREATE_BUTTON": {
        "target": "creating",
        "guard": {
          "schema": {
            "type": "object",
            "properties": {
              "canCreate": { "const": true }
            },
            "required": ["canCreate"]
          }
        }
      }
    }
  }
}
```

The guard checks the current context: "Is `context.canCreate` true?" This is conditional logic - even though the message is valid, we might not want to process it if certain runtime conditions aren't met.

If the guard passes, the state machine transitions from "idle" to "creating".

### Step 5: Action Execution

Once in the "creating" state, the entry action executes:
```json
{
  "entry": {
    "tool": "@db",
    "payload": {
      "op": "create",
      "schema": "@schema/data/todos",
      "data": { "text": "Buy milk", "done": false }
    }
  }
}
```

This calls the database tool to create the todo. The tool executes asynchronously, and when it completes, it sends a message back to the inbox.

### Step 6: Completion

When the database operation succeeds, a `SUCCESS` message gets sent to the inbox. The state machine processes this message and transitions back to "idle", clearing the input field and updating the UI to show the new todo.

## Why This Architecture Works

This messaging architecture provides several key benefits that make it particularly well-suited for distributed systems:

### 1. **Distributed by Default**

Because messages are pure JSON (no expressions or closures), they can be serialized, persisted, and synced across devices seamlessly. Your phone can send a message to your laptop's actor, and it works even if one device is offline. The CRDT-based inbox ensures messages are eventually consistent across all devices.

### 2. **Type Safety at Runtime**

Like TypeScript, but enforced at runtime across distributed systems. You can't accidentally send malformed data - the validation layer catches it before it causes problems. This prevents entire classes of bugs that are common in distributed systems.

### 3. **Self-Documenting Contracts**

Every actor explicitly declares what message types it accepts. This creates a living API contract that's always accurate - if the actor definition changes, the contract automatically reflects those changes. No separate documentation to maintain or keep in sync.

### 4. **Complete Auditability**

Want to debug what happened? Just inspect the actor's inbox. It's a complete, append-only log of every message the actor received, in order. This makes debugging distributed systems much easier than traditional approaches.

### 5. **Clear Separation of Concerns**

Validation (structural correctness) and conditional logic (runtime behavior) are cleanly separated. Each layer has a single responsibility, making the system easier to understand, test, and maintain.

## The Evolution: Schema-Based Everything

We're currently evolving the system toward complete schema-based validation:

- ✅ **Message type schemas**: Every message type (like `CREATE_BUTTON`) has a JSON Schema that defines its payload structure
- ✅ **Actor message contracts**: Actors explicitly declare which message types they accept (like a sealed protocol)
- ✅ **Schema-based guards**: Guards use JSON Schema to validate conditions, replacing complex expression evaluation
- ✅ **Early validation pipeline**: Messages are validated before reaching the state machine, catching errors early

This approach is inspired by proven distributed systems architectures (like Akka Typed's typed actor protocols), but adapted for our decentralized, CRDT-based world where actors can be on different devices.

## Conclusion

The actor messaging system in MaiaOS provides a robust foundation for building distributed applications. By using typed messages, persistent inboxes, and clear separation between validation and conditional logic, we create a system that's:

- **Reliable**: Messages persist and sync across devices automatically
- **Type-safe**: Validation catches errors before they cause problems
- **Maintainable**: Clear contracts and separation of concerns
- **Debuggable**: Complete message history in every inbox

The next time you interact with a MaiaOS application, remember that behind the scenes, you're triggering a typed message that flows through validation, conditional logic, and state machine processing. It's a simple pattern, but one that scales elegantly to complex distributed systems.

---

**Want to learn more?** Check out our [actor documentation](../../libs/maia-docs/02_creators/03-actors.md) or dive into the [state machine docs](../../libs/maia-docs/02_creators/05-state.md)!
