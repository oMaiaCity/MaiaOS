# DSL Guide (Developer)

**For developers** who want to extend MaiaScript DSL with new definition types and expression syntax.

## What is MaiaScript DSL?

**MaiaScript** is a declarative JSON-based language for defining actors, state machines, views, styles, tools, and skills. It's designed to be:

- ✅ **Human-readable** - JSON with clear semantics
- ✅ **AI-compatible** - LLMs can read and generate it
- ✅ **Schema-validated** - Type-safe definitions validated against JSON Schema
- ✅ **Expression-rich** - Context references (`$`), item references (`$$`)

All MaiaScript files are automatically validated against JSON schemas when loaded. See [Schema System](./schemas.md) for details.

## DSL Types

### Core DSL Types

| Type | File Extension | Purpose | Engine |
|------|----------------|---------|--------|
| `actor` | `.actor.maia` | Actor definition | ActorEngine |
| `state` | `.state.maia` | State machine | StateEngine |
| `view` | `.view.maia` | UI structure | ViewEngine |
| `style` | `.style.maia` | Styling | StyleEngine |
| `tool` | `.tool.maia` | Tool metadata | ToolEngine |
| `skill` | `.skill.maia` | AI interface | SkillEngine (v0.5) |

## Expression Syntax

### Context References (`$`)

Access actor context fields:

```json
{
  "text": "$newTodoText",
  "mode": "$viewMode",
  "count": "$todos.length"
}
```

Evaluated by `MaiaScriptEvaluator`:

```javascript
evaluate(expression, data) {
  if (typeof expression === 'string' && expression.startsWith('$')) {
    const path = expression.slice(1);
    return this._resolvePath(data.context, path);
  }
  return expression;
}
```

### Item References (`$$`)

Access current item in `for` loops:

```json
{
  "for": "$todos",
  "forItem": "todo",
  "children": [
    {
      "text": "$$text",
      "data-id": "$$id"
    }
  ]
}
```

### Special Event References (`@`)

Access DOM event values:

```json
{
  "on": {
    "input": {
      "send": "UPDATE_INPUT",
      "payload": {
        "value": "@inputValue",     // input.value
        "checked": "@checked",       // input.checked
        "selectedValue": "@selectedValue"  // select.value
      }
    }
  }
}
```

## Creating a New DSL Type

### Example: Animation DSL

**Goal:** Define animations that can be applied to actors.

#### 1. Define DSL Schema

```json
{
  "$type": "animation",
  "$id": "anim_fade_in_001",
  "name": "fadeIn",
  
  "keyframes": {
    "0%": {
      "opacity": "0",
      "transform": "translateY(-10px)"
    },
    "100%": {
      "opacity": "1",
      "transform": "translateY(0)"
    }
  },
  
  "duration": "300ms",
  "easing": "ease-out",
  "fillMode": "forwards",
  
  "triggers": {
    "onEnter": true,
    "onStateChange": ["creating", "updating"]
  }
}
```

#### 2. Create Engine/Compiler

```javascript
// o/engines/AnimationEngine.js
export class AnimationEngine {
  constructor(evaluator) {
    this.evaluator = evaluator;
    this.animations = new Map();
    this.activeAnimations = new Map();
  }
  
  /**
   * Register animation definition
   */
  registerAnimation(animDef) {
    if (animDef.$type !== 'animation') {
      throw new Error('Invalid animation definition');
    }
    
    // Compile to CSS animation
    const css = this._compileToCSS(animDef);
    
    this.animations.set(animDef.$id, {
      definition: animDef,
      css,
      name: animDef.name
    });
    
    console.log(`✅ Registered animation: ${animDef.name}`);
  }
  
  /**
   * Apply animation to actor
   */
  applyAnimation(actor, animationId, target = 'root') {
    const animation = this.animations.get(animationId);
    if (!animation) {
      throw new Error(`Animation not found: ${animationId}`);
    }
    
    // Inject CSS into actor's Shadow DOM
    const shadowRoot = actor.container.shadowRoot;
    if (!shadowRoot) return;
    
    let styleElement = shadowRoot.querySelector('style[data-animations]');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.setAttribute('data-animations', '');
      shadowRoot.appendChild(styleElement);
    }
    
    styleElement.textContent += animation.css;
    
    // Apply animation class to target element
    const targetElement = target === 'root'
      ? shadowRoot.querySelector(':host > *')
      : shadowRoot.querySelector(target);
    
    if (targetElement) {
      targetElement.style.animation = `${animation.name} ${animation.definition.duration} ${animation.definition.easing} ${animation.definition.fillMode}`;
      
      // Track active animation
      this.activeAnimations.set(`${actor.id}_${target}`, {
        actor,
        animation: animation.name,
        element: targetElement
      });
      
      // Remove after animation completes
      const duration = parseFloat(animation.definition.duration);
      setTimeout(() => {
        this.activeAnimations.delete(`${actor.id}_${target}`);
      }, duration);
    }
  }
  
  /**
   * Compile keyframes to CSS
   */
  _compileToCSS(animDef) {
    let css = `@keyframes ${animDef.name} {\n`;
    
    for (const [offset, props] of Object.entries(animDef.keyframes)) {
      css += `  ${offset} {\n`;
      for (const [prop, value] of Object.entries(props)) {
        const cssProperty = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `    ${cssProperty}: ${value};\n`;
      }
      css += `  }\n`;
    }
    
    css += `}\n`;
    return css;
  }
  
  /**
   * Cleanup
   */
  destroyActorAnimations(actorId) {
    for (const [key, data] of this.activeAnimations) {
      if (key.startsWith(`${actorId}_`)) {
        data.element.style.animation = 'none';
        this.activeAnimations.delete(key);
      }
    }
  }
}
```

#### 3. Integrate with Kernel

```javascript
// o/kernel.js
import { AnimationEngine } from './engines/AnimationEngine.js';

export class MaiaOS {
  static async boot(config) {
    const os = {...};
    
    // Initialize animation engine
    os.animationEngine = new AnimationEngine(os.evaluator);
    
    return os;
  }
}
```

#### 4. Load Animations

```javascript
// o/engines/ActorEngine.js
async createActor(actorPath, container, os) {
  // ... load actor definition ...
  
  // Load animations if present
  if (actorDef.animationRefs) {
    for (const animRef of actorDef.animationRefs) {
      const animPath = `${basePath}/${animRef}.animation.maia`;
      const animDef = await this._loadJSON(animPath);
      os.animationEngine.registerAnimation(animDef);
      
      // Apply on enter if configured
      if (animDef.triggers?.onEnter) {
        os.animationEngine.applyAnimation(actor, animDef.$id);
      }
    }
  }
  
  // ... rest of actor creation ...
}
```

#### 5. Hook into State Changes

```javascript
// o/engines/StateEngine.js
async transition(machineId, event, payload) {
  // ... existing transition logic ...
  
  // Trigger animations on state change
  const machine = this.machines.get(machineId);
  const actor = this._getActorForMachine(machineId);
  
  if (actor && actor.animationRefs) {
    for (const animRef of actor.animationRefs) {
      const animDef = this.os.animationEngine.animations.get(animRef);
      if (animDef?.definition.triggers?.onStateChange?.includes(machine.currentState)) {
        this.os.animationEngine.applyAnimation(actor, animRef);
      }
    }
  }
}
```

#### 6. Usage

**`animations/fadeIn.animation.maia`:**
```json
{
  "$type": "animation",
  "$id": "anim_fade_in",
  "name": "fadeIn",
  "keyframes": {
    "0%": {"opacity": "0", "transform": "translateY(-10px)"},
    "100%": {"opacity": "1", "transform": "translateY(0)"}
  },
  "duration": "300ms",
  "easing": "ease-out",
  "fillMode": "forwards",
  "triggers": {
    "onEnter": true,
    "onStateChange": ["creating"]
  }
}
```

**`todo.actor.maia`:**
```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "stateRef": "todo",
  "viewRef": "todo",
  "animationRefs": ["fadeIn"],  // ← Load animation
  "context": {...}
}
```

## Extending Expression Syntax

### Adding Custom Operators

**Goal:** Add `#` prefix for computed properties.

#### 1. Update Evaluator

```javascript
// o/engines/MaiaScriptEvaluator.js
evaluate(expression, data = {}) {
  // Existing: $ for context
  if (typeof expression === 'string' && expression.startsWith('$')) {
    const path = expression.slice(1);
    return this._resolvePath(data.context || {}, path);
  }
  
  // Existing: $$ for item
  if (typeof expression === 'string' && expression.startsWith('$$')) {
    const path = expression.slice(2);
    return this._resolvePath(data.item || {}, path);
  }
  
  // NEW: # for computed properties
  if (typeof expression === 'string' && expression.startsWith('#')) {
    const computedName = expression.slice(1);
    return this._evaluateComputed(computedName, data.context);
  }
  
  // ... rest of evaluation ...
}

_evaluateComputed(name, context) {
  // Define computed properties
  const computed = {
    todosCount: () => context.todos?.length || 0,
    completedCount: () => context.todos?.filter(t => t.done).length || 0,
    progressPercent: () => {
      const total = context.todos?.length || 0;
      const completed = context.todos?.filter(t => t.done).length || 0;
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    },
    now: () => Date.now(),
    today: () => new Date().toISOString().split('T')[0]
  };
  
  if (computed[name]) {
    return computed[name]();
  }
  
  throw new Error(`Unknown computed property: ${name}`);
}
```

#### 2. Usage

```json
{
  "tag": "p",
  "text": "You've completed #progressPercent% of your tasks"
}

{
  "tag": "span",
  "text": "#todosCount tasks remaining"
}

{
  "tag": "input",
  "attrs": {
    "value": "#today"
  }
}
```

### Adding Custom Guards

**Goal:** Add `$between` guard operator.

```javascript
// o/engines/StateEngine.js
_evaluateGuard(guard, context, eventPayload = {}) {
  // ... existing operators ...
  
  // NEW: $between operator
  if (guard.$between) {
    const [value, min, max] = guard.$between;
    const val = this.evaluator.evaluate(value, { context, item: eventPayload });
    const minVal = this.evaluator.evaluate(min, { context, item: eventPayload });
    const maxVal = this.evaluator.evaluate(max, { context, item: eventPayload });
    return val >= minVal && val <= maxVal;
  }
  
  // ... rest of guards ...
}
```

Usage:
```json
{
  "guard": {
    "$between": ["$age", 18, 65]
  }
}
```

## DSL Validation

### Schema Validation

```javascript
// o/validators/ActorValidator.js
export class ActorValidator {
  static validate(actorDef) {
    const errors = [];
    
    // Check required fields
    if (actorDef.$type !== 'actor') {
      errors.push('$type must be "actor"');
    }
    
    if (!actorDef.$id) {
      errors.push('$id is required');
    }
    
    if (!actorDef.id) {
      errors.push('id is required');
    }
    
    if (!actorDef.stateRef) {
      errors.push('stateRef is required');
    }
    
    if (!actorDef.context || typeof actorDef.context !== 'object') {
      errors.push('context must be an object');
    }
    
    // Check references
    if (actorDef.viewRef && typeof actorDef.viewRef !== 'string') {
      errors.push('viewRef must be a string');
    }
    
    if (actorDef.styleRef && typeof actorDef.styleRef !== 'string') {
      errors.push('styleRef must be a string');
    }
    
    if (errors.length > 0) {
      throw new Error(`Actor validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
  }
}
```

### Runtime Validation

```javascript
// o/engines/ActorEngine.js
async createActor(actorPath, container, os) {
  const actorDef = await this._loadJSON(actorPath);
  
  // Validate before creating
  ActorValidator.validate(actorDef);
  
  // ... rest of actor creation ...
}
```

## DSL Best Practices

### ✅ DO:

- **Use JSON schemas** - Validate structure
- **Namespace types** - Use `$type` consistently
- **Document fields** - Add `description` properties
- **Version definitions** - Include version field
- **Keep declarative** - No functions or logic
- **Support expressions** - Use `$`, `$$`, `@` where appropriate

### ❌ DON'T:

- **Don't embed logic** - Keep definitions pure data
- **Don't use functions** - Not JSON-serializable
- **Don't create circular refs** - Will break serialization
- **Don't hardcode values** - Use context references
- **Don't skip validation** - Always validate inputs

## DSL Transformation

### Preprocessing DSL

```javascript
// o/transformers/DSLPreprocessor.js
export class DSLPreprocessor {
  /**
   * Transform shorthand syntax to full syntax
   */
  static transform(dsl) {
    if (dsl.$type === 'view') {
      return this._transformView(dsl);
    }
    if (dsl.$type === 'state') {
      return this._transformState(dsl);
    }
    return dsl;
  }
  
  static _transformView(viewDef) {
    // Transform shorthand: "text": "Hello" → "text": {"$eval": "Hello"}
    // (Example: add metadata for debugging)
    return this._transformElement(viewDef.root);
  }
  
  static _transformElement(element) {
    if (!element) return element;
    
    // Add source tracking
    element._source = {
      file: element.$source || 'unknown',
      line: element.$line || 0
    };
    
    // Transform children recursively
    if (element.children) {
      element.children = element.children.map(c => this._transformElement(c));
    }
    
    return element;
  }
}
```

### Compiling DSL to Another Format

```javascript
// o/compilers/ViewToReact.js
export class ViewToReact {
  /**
   * Compile MaiaScript view to React JSX
   */
  static compile(viewDef) {
    return this._compileElement(viewDef.root);
  }
  
  static _compileElement(element) {
    const { tag, attrs, text, children } = element;
    
    let jsx = `<${tag}`;
    
    // Add attributes
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        jsx += ` ${key}="${value}"`;
      }
    }
    
    jsx += '>';
    
    // Add text
    if (text) {
      jsx += text;
    }
    
    // Add children
    if (children) {
      jsx += children.map(c => this._compileElement(c)).join('\n');
    }
    
    jsx += `</${tag}>`;
    
    return jsx;
  }
}
```

## Next Steps

- Read [Engines Guide](./engines.md) - Creating custom engines
- Read [Tools Guide](./tools.md) - Creating tool modules
- Read [MaiaOS Guide](./maiaos.md) - Understanding the system
- Explore [VIBE Docs](../vibe/) - User-facing documentation
