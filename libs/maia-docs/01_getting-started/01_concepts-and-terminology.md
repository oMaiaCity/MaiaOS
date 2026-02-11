# MaiaOS Concepts and Terminology

**Version:** 0.4  
**Last Updated:** January 2026

## The Simple Version

MaiaOS lets you build apps by writing **JSON files** instead of code. You describe what your app should do (like a recipe), and engines run it. No building, no compiling—just save a file and see it run. AI can read and edit these files too, so you can build apps by talking to an AI.

---

## What is MaiaOS?

MaiaOS is a **100% runtime-based, AI-LLM native platform** for building AI-composable applications. It's a declarative operating system where everything is defined in JSON, executed by engines, and orchestrated by AI agents.

## Core Philosophy

### Pure Declarative Runtime

**Everything is JSON:** No JavaScript in your app code, no compiled bundles, no build steps. Pure `.maia` files loaded at runtime.

### AI-LLM Native

LLMs can read and generate `.maia` files natively. Skills provide AI-readable interface specifications. Tools are defined with JSON schemas. AI agents can build entire apps by generating `.maia` files—no code generation, no syntax errors.

### 100% Runtime-Based

```
Traditional:  Write Code → Compile → Bundle → Deploy → Run
MaiaOS:       Write .maia → Run
```

Hot reload everything: change a view, modify a state machine, update styles—instant update. No webpack, no vite.

## Three-Layer Architecture

**Definition Layer:** Pure JSON (actor, context, state, view, style, skill). No logic, just configuration.

**Execution Layer:** JavaScript engines interpret definitions (ActorEngine, StateEngine, ViewEngine, ToolEngine, StyleEngine, DBEngine, SubscriptionEngine, MessageQueue).

**Intelligence Layer:** AI agents orchestrate via skills. Agents generate events based on user intent; system executes via state machines.

## Why MaiaOS?

**Vibecreators:** No JavaScript required, instant hot reload, AI-assisted development, component isolation.

**AI Agents:** Native JSON, schema-defined tools, discoverable skills, composable actors, predictable state machines.

**Developers:** Modular architecture, schema-agnostic tools, clean separation, extensible engines.

## Key Differentiators

| vs. Traditional Frameworks | vs. Low-Code |
|----------------------------|--------------|
| JSON instead of JS/TS | Text (`.maia`) instead of visual GUI |
| No build process | Git version control |
| Native AI generation | Native AI integration |
| Shadow DOM isolation | Open source extensibility |

## Service/UI Actor Pattern

**Service Actors:** Entry point, business logic, coordinate UI actors.  
**UI Actors:** Render interfaces, handle interactions, send events to service actors.  
**Pattern:** `Vibe → Service Actor → Composite Actor → UI Actors`

---

## Terminology Glossary

### Core Concepts

**MaiaOS** - The operating system. A runtime-based, AI-native platform for declarative applications. Think: "an OS for apps" that runs in the browser.

**Kernel** - Single entry point (`o/kernel.js`). Boots the system, loads modules, initializes engines.

**MaiaScript** - JSON-based DSL for defining actors, views, states, styles, tools. Expressions: `$context`, `$$item`, `@inputValue`.

### Definition Layer

**Actor** - Pure declarative spec (`.actor.maia`). References other components. Zero logic—just IDs and references.

**Context** - Runtime data (`.context.maia`). Collections, UI state, form values. Inline or separate file.

**State Machine** - Behavior flow (`.state.maia`). XState-like: states, transitions, guards, actions. Defines WHAT happens WHEN.

**View** - UI structure (`.view.maia`). Declarative DOM tree with expressions, loops, conditionals. Renders to Shadow DOM.

**Style** - Appearance (`.style.maia`). Design tokens + component styles. Types: Brand (shared) or Local (actor-specific).

**Skill** - AI agent interface (`.skill.maia`). Describes capabilities, events, context schema for LLM orchestration.

### Execution Layer

**Engine** - JavaScript machinery that interprets definitions. ActorEngine, StateEngine, ViewEngine, ToolEngine, StyleEngine, DBEngine, SubscriptionEngine, MessageQueue, MaiaScriptEvaluator.

**Tool** - Executable function (`.tool.js` + `.tool.maia`). The ONLY place imperative code lives. Tools mutate context or execute operations.

**Module** - Collection of tools (`.module.js`). Built-in: `db`, `core`, `dragdrop`, `interface`.

### Intelligence Layer

**Vibecreator** - Person who builds MaiaOS apps. Writes `.maia` files. No JavaScript required.

**Agent/LLM** - AI assistant that reads skills and generates events.

### Data Flow

**Event** - Message to state machine triggering a transition.  
**Payload** - Data with event. Expressions: `$field` (context), `$$field` (item), `@inputValue` (DOM).  
**Guard** - Condition for transition.  
**Transition** - State change in response to event.  
**Action** - Tool invocation or context update during transition.

### UI Concepts

**Shadow DOM** - Browser-native encapsulation. Each actor has isolated styles and DOM.

**Component** - In MaiaOS, component = actor. Reusable, isolated unit with state, view, behavior.

### File Conventions

**Naming:** `{name}.{type}.maia` (e.g., `todo.actor.maia`, `todo.context.maia`)

**Types:** actor, context, state, view, style, skill, tool

---

## Next Steps

- [Architecture](./03_architecture/) - Deep dive into system design
- [Installation](./04_install.md) - Get started building
