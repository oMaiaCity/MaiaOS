# Engines Guide (Developer)

**For developers** who want to create custom engines to extend MaiaOS capabilities.

## What Are Engines?

Engines are the **execution machinery** of MaiaOS. They interpret declarative definitions and execute imperative operations.

### Built-in Engines

| Engine | Purpose | Input | Output |
|--------|---------|-------|--------|
| `ActorEngine` | Actor lifecycle | Actor definitions | Running actors |
| `SubscriptionEngine` | Reactive data | Context query objects | Auto-updating context |
| `StateEngine` | State machines | State definitions + events | State transitions |
| `ViewEngine` | UI rendering | View definitions | Shadow DOM |
| `ToolEngine` | Action execution | Tool names + payloads | Side effects |
| `StyleEngine` | Style compilation | Style definitions | CSS |
| `DBEngine` | Database operations | @db tool payloads | CRUD results |
| `ModuleRegistry` | Module loading | Module names | Registered modules |
| `MaiaScriptEvaluator` | Expression eval | DSL expressions | Evaluated values |

## Engine Architecture

### Core Responsibilities

1. **Interpret Definitions** - Parse and validate DSL using JSON schemas
2. **Execute Operations** - Perform imperative actions
3. **Manage State** - Track runtime state (not actor state!)
4. **Handle Errors** - Graceful failure and recovery
5. **Emit Events** - Notify other engines (if needed)

All engines automatically validate their input data against JSON schemas when loading definitions. See [Schema System](./schemas.md) for details.

### SubscriptionEngine - Context-Driven Reactivity

**SubscriptionEngine** is the central reactive system that makes data automatically update your UI. It's the "magic" behind automatic re-rendering when data changes.

#### What It Does

**The problem it solves:** You want your UI to automatically update when data changes, without writing manual subscription code.

**How it works:**

1. **Scans actor context** - When an actor is created, SubscriptionEngine looks at its context
2. **Identifies query objects** - Finds objects with a `schema` field (e.g., `{ "schema": "@schema/todos", "filter": null }`)
3. **Auto-subscribes** - Creates database subscriptions for each query object
4. **Updates context** - When data changes, updates `actor.context[key]` with new data
5. **Triggers re-renders** - Schedules actor re-render (batched in microtask)
6. **Cleans up** - Unsubscribes when actor is destroyed (prevents memory leaks)

#### Architecture

**Location:** `libs/maia-script/src/o/engines/subscription-engine/subscription.engine.js`

```javascript
export class SubscriptionEngine {
  constructor(dbEngine, actorEngine) {
    this.dbEngine = dbEngine;
    this.actorEngine = actorEngine;
    this.pendingRerenders = new Set();  // Batching system
    this.batchTimer = null;
    this.debugMode = true;
  }
  
  // Initialize subscriptions for an actor
  async initialize(actor) {
    await this._subscribeToContext(actor);
  }
  
  // Watch context for query objects
  async _subscribeToContext(actor) {
    for (const [key, value] of Object.entries(actor.context)) {
      // Query object → reactive subscription
      if (value?.schema?.startsWith('@')) {
        const unsubscribe = await this.dbEngine.execute({
          op: 'query',
          schema: value.schema,
          filter: value.filter || null,
          callback: (data) => this._handleDataUpdate(actor.id, key, data)
        });
        
        actor._subscriptions.push(unsubscribe);
      }
    }
  }
  
  // Handle data updates
  _handleDataUpdate(actorId, contextKey, data) {
    const actor = this.actorEngine.getActor(actorId);
    if (!actor) return;
    
    // Deduplication check
    if (this._isSameData(actor.context[contextKey], data)) {
      return; // Skip if data hasn't changed
    }
    
    // Update context
    actor.context[contextKey] = data;
    
    // Schedule batched re-render
    if (actor._initialRenderComplete) {
      this._scheduleRerender(actorId);
    }
  }
  
  // Batching system
  _scheduleRerender(actorId) {
    this.pendingRerenders.add(actorId);
    
    if (!this.batchTimer) {
      this.batchTimer = queueMicrotask(() => {
        this._flushRerenders();
      });
    }
  }
  
  _flushRerenders() {
    const actorIds = Array.from(this.pendingRerenders);
    this.pendingRerenders.clear();
    this.batchTimer = null;
    
    for (const actorId of actorIds) {
      this.actorEngine.rerender(actorId);
    }
  }
  
  // Cleanup
  cleanup(actor) {
    actor._subscriptions.forEach(unsubscribe => unsubscribe());
    actor._subscriptions = [];
    this.pendingRerenders.delete(actor.id);
  }
}
```

#### Integration with ActorEngine

**In ActorEngine:**

```javascript
class ActorEngine {
  constructor(styleEngine, viewEngine, ..., subscriptionEngine) {
    // ... other initialization
    this.subscriptionEngine = subscriptionEngine;
  }
  
  async createActor(actorPath, container, os) {
    // ... create actor instance
    
    // Initialize subscriptions
    if (this.subscriptionEngine) {
      await this.subscriptionEngine.initialize(actor);
    }
    
    // ... render view
  }
  
  destroyActor(actorId) {
    const actor = this.actors.get(actorId);
    if (actor) {
      // Cleanup subscriptions
      if (this.subscriptionEngine) {
        this.subscriptionEngine.cleanup(actor);
      }
      // ... rest of cleanup
    }
  }
}
```

#### Query Object Format

A **query object** in context declares a reactive data subscription:

```json
{
  "todos": {
    "schema": "@schema/todos",
    "filter": null
  }
}
```

**Properties:**
- `schema` (required): Database collection ID (must start with `@`)
- `filter` (optional): Filter criteria (null = get all)

**Examples:**

```json
// All todos
{ "schema": "@schema/todos", "filter": null }

// Incomplete todos only
{ "schema": "@schema/todos", "filter": { "done": false } }

// Completed todos only
{ "schema": "@schema/todos", "filter": { "done": true } }
```

#### Batching and Deduplication

**Batching** - Multiple updates in quick succession are batched into a single re-render:

```
Update 1 → Schedule re-render (microtask)
Update 2 → Already scheduled, add to batch
Update 3 → Already scheduled, add to batch
  ↓
Microtask runs → Re-render ONCE
```

**Result:** 3 updates = 1 re-render (instead of 3 re-renders)

**Deduplication** - If data hasn't changed, skip re-render:

```javascript
// Old: [{ id: "1", text: "Buy milk" }]
// New: [{ id: "1", text: "Buy milk" }]
// Result: Skip re-render (data is the same)
```

**Result:** No unnecessary re-renders!

#### Debug Logging

SubscriptionEngine logs all operations in development mode:

```javascript
[SubscriptionEngine] Initialized
[SubscriptionEngine] Initializing actor_list_001
[SubscriptionEngine] ✅ actor_list_001 → @schema/todos → $todos
[SubscriptionEngine] actor_list_001 initialized with 1 subscription(s)
[SubscriptionEngine] 📥 actor_list_001.$todos initial data (3)
[SubscriptionEngine] 🔄 actor_list_001.$todos updated (4)
[SubscriptionEngine] 🎨 Batched re-render: 1 actor(s) [actor_list_001]
```

**Emoji legend:**
- ✅ Subscription created
- 📥 Initial data received
- 🔄 Data updated
- ⏭️ Skipped (no change)
- 🎨 Re-rendering
- 🧹 Cleaning up

#### Why This Architecture?

**Before (scattered subscriptions):**
- Subscription logic in ActorEngine, StateEngine, query tools
- Manual subscription tracking
- Memory leaks from forgotten unsubscribes
- Inconsistent patterns
- Hard to debug

**After (centralized SubscriptionEngine):**
- ✅ All reactivity in one place
- ✅ Context-driven (declarative)
- ✅ Automatic cleanup (no memory leaks)
- ✅ Batched re-renders (performance)
- ✅ Deduplicated updates (efficiency)
- ✅ Clean debug logs (visibility)
- ✅ Future-ready (CoJSON migration)

**Key insight:** Actors never think about subscriptions. They just declare what data they need in context, and SubscriptionEngine handles everything.

See [Reactive Data System](./06_reactive-queries.md) for detailed usage examples.

### Engine Interface Pattern

```javascript
class CustomEngine {
  constructor(dependencies) {
    // Store dependencies (other engines, registries)
    this.evaluator = dependencies.evaluator;
    this.registry = new Map();  // Internal state
  }
  
  // Primary operations
  async initialize() {...}
  async execute(...args) {...}
  
  // State management
  register(id, definition) {...}
  get(id) {...}
  
  // Cleanup
  destroy(id) {...}
}
```

## Creating a Custom Engine

### Example: ThreeJS Rendering Engine

**Goal:** Render 3D scenes alongside 2D UI actors.

#### 1. Define DSL Schema

```json
{
  "$type": "scene",
  "$id": "scene_cube_001",
  
  "camera": {
    "type": "perspective",
    "fov": 75,
    "position": [0, 0, 5]
  },
  
  "objects": [
    {
      "type": "mesh",
      "geometry": "box",
      "material": {
        "color": "$primaryColor"
      },
      "position": [0, 0, 0],
      "rotation": [0, "$rotation", 0]
    }
  ],
  
  "lights": [
    {
      "type": "ambient",
      "color": 0xffffff,
      "intensity": 0.5
    }
  ]
}
```

#### 2. Implement Engine

```javascript
// o/engines/ThreeJSEngine.js
import * as THREE from 'three';

export class ThreeJSEngine {
  constructor(evaluator) {
    this.evaluator = evaluator;
    this.scenes = new Map();
    this.renderers = new Map();
    this.animationLoops = new Map();
  }
  
  /**
   * Create and register a 3D scene
   */
  async createScene(sceneId, sceneDef, container, actor) {
    // Validate definition
    if (sceneDef.$type !== 'scene') {
      throw new Error('Invalid scene definition');
    }
    
    // Initialize Three.js
    const scene = new THREE.Scene();
    const camera = this._createCamera(sceneDef.camera);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    
    // Create objects (evaluate context references)
    for (const objDef of sceneDef.objects) {
      const obj = await this._createObject(objDef, actor.context);
      scene.add(obj);
    }
    
    // Create lights
    for (const lightDef of sceneDef.lights) {
      const light = this._createLight(lightDef);
      scene.add(light);
    }
    
    // Store scene data
    this.scenes.set(sceneId, {
      scene,
      camera,
      renderer,
      definition: sceneDef,
      actor,
      container
    });
    
    this.renderers.set(sceneId, renderer);
    
    // Start render loop
    this._startRenderLoop(sceneId);
    
    console.log(`✅ Created 3D scene: ${sceneId}`);
    return sceneId;
  }
  
  /**
   * Update scene based on actor context changes
   */
  async updateScene(sceneId) {
    const sceneData = this.scenes.get(sceneId);
    if (!sceneData) return;
    
    const { scene, definition, actor } = sceneData;
    
    // Re-evaluate object properties with current context
    scene.children.forEach((child, index) => {
      if (index < definition.objects.length) {
        const objDef = definition.objects[index];
        
        // Update rotation (evaluate $rotation from context)
        if (objDef.rotation) {
          const rotation = objDef.rotation.map(
            r => typeof r === 'string' && r.startsWith('$')
              ? actor.context[r.slice(1)]
              : r
          );
          child.rotation.set(...rotation);
        }
        
        // Update material color (evaluate $primaryColor)
        if (objDef.material?.color && typeof objDef.material.color === 'string') {
          const color = this.evaluator.evaluate(
            objDef.material.color,
            { context: actor.context }
          );
          child.material.color.set(color);
        }
      }
    });
  }
  
  /**
   * Render loop
   */
  _startRenderLoop(sceneId) {
    const sceneData = this.scenes.get(sceneId);
    if (!sceneData) return;
    
    const { scene, camera, renderer } = sceneData;
    
    const animate = () => {
      const loopId = requestAnimationFrame(animate);
      this.animationLoops.set(sceneId, loopId);
      
      renderer.render(scene, camera);
    };
    
    animate();
  }
  
  /**
   * Cleanup
   */
  destroyScene(sceneId) {
    // Stop animation loop
    const loopId = this.animationLoops.get(sceneId);
    if (loopId) {
      cancelAnimationFrame(loopId);
      this.animationLoops.delete(sceneId);
    }
    
    // Dispose Three.js resources
    const sceneData = this.scenes.get(sceneId);
    if (sceneData) {
      sceneData.scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      sceneData.renderer.dispose();
      sceneData.container.removeChild(sceneData.renderer.domElement);
    }
    
    // Remove from registry
    this.scenes.delete(sceneId);
    this.renderers.delete(sceneId);
    
    console.log(`🗑️ Destroyed scene: ${sceneId}`);
  }
  
  // Helper methods
  _createCamera(cameraDef) {
    const { type, fov, position } = cameraDef;
    if (type === 'perspective') {
      const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(...position);
      return camera;
    }
    throw new Error(`Unknown camera type: ${type}`);
  }
  
  async _createObject(objDef, context) {
    // Evaluate material color (may reference context)
    let color = objDef.material?.color;
    if (typeof color === 'string' && color.startsWith('$')) {
      color = context[color.slice(1)];
    }
    
    // Create geometry
    let geometry;
    if (objDef.geometry === 'box') {
      geometry = new THREE.BoxGeometry(1, 1, 1);
    } else if (objDef.geometry === 'sphere') {
      geometry = new THREE.SphereGeometry(1, 32, 32);
    }
    
    // Create material
    const material = new THREE.MeshStandardMaterial({ color });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...objDef.position);
    
    // Evaluate rotation (may reference context)
    const rotation = objDef.rotation.map(
      r => typeof r === 'string' && r.startsWith('$')
        ? context[r.slice(1)]
        : r
    );
    mesh.rotation.set(...rotation);
    
    return mesh;
  }
  
  _createLight(lightDef) {
    if (lightDef.type === 'ambient') {
      return new THREE.AmbientLight(lightDef.color, lightDef.intensity);
    }
    if (lightDef.type === 'directional') {
      const light = new THREE.DirectionalLight(lightDef.color, lightDef.intensity);
      if (lightDef.position) light.position.set(...lightDef.position);
      return light;
    }
    throw new Error(`Unknown light type: ${lightDef.type}`);
  }
}
```

#### 3. Integrate with Kernel

```javascript
// o/kernel.js
import { ThreeJSEngine } from './engines/ThreeJSEngine.js';

export class MaiaOS {
  static async boot(config) {
    const os = {...};
    
    // Initialize existing engines
    os.evaluator = new MaiaScriptEvaluator(os.moduleRegistry);
    // ... other engines ...
    
    // Initialize ThreeJS engine
    os.threeEngine = new ThreeJSEngine(os.evaluator);
    
    return os;
  }
}
```

#### 4. Update Actor Creation

```javascript
// o/engines/ActorEngine.js
async createActor(actorPath, container, os) {
  // ... load actor definition ...
  
  // Load scene if present
  if (actorDef.sceneRef) {
    const scenePath = `${basePath}/${actorDef.sceneRef}.scene.maia`;
    const sceneDef = await this._loadJSON(scenePath);
    actor.sceneDef = sceneDef;
    
    // Create 3D scene
    await os.threeEngine.createScene(
      sceneDef.$id,
      sceneDef,
      sceneContainer,
      actor
    );
  }
  
  // ... rest of actor creation ...
}
```

#### 5. Hook into Rerender

```javascript
// o/engines/ActorEngine.js
async rerender(actor) {
  // Re-render view (2D UI)
  if (actor.viewDef && actor.container.shadowRoot) {
    this.viewEngine.render(actor.container, actor.viewDef, actor, this);
  }
  
  // Update 3D scene
  if (actor.sceneDef && this.os.threeEngine) {
    await this.os.threeEngine.updateScene(actor.sceneDef.$id);
  }
  
  console.log(`✅ Re-render complete for: ${actor.id}`);
}
```

#### 6. Usage in Actor Definition

```json
{
  "$type": "actor",
  "$id": "actor_cube_001",
  "id": "actor_cube_001",
  
  "stateRef": "cube",
  "viewRef": "cubeUI",
  "sceneRef": "cube",    // ← References cube.scene.maia
  
  "context": {
    "rotation": 0,
    "primaryColor": "#3b82f6"
  }
}
```

## Engine Best Practices

### ✅ DO:

- **Accept dependencies via constructor** - Don't use globals
- **Validate inputs** - Check definition schemas
- **Handle errors gracefully** - Don't crash the system
- **Log operations** - Help debugging
- **Clean up resources** - Implement `destroy()` methods
- **Use evaluator for context refs** - Leverage `$` and `$$` syntax
- **Document public API** - Clear JSDoc comments

### ❌ DON'T:

- **Don't store actor state** - Use `actor.context`
- **Don't mutate definitions** - Treat as immutable
- **Don't create global state** - Instance-based only
- **Don't bypass other engines** - Use proper APIs
- **Don't block the main thread** - Use Web Workers if needed

## Testing Engines

```javascript
// test-three-engine.js
import { ThreeJSEngine } from './o/engines/ThreeJSEngine.js';
import { MaiaScriptEvaluator } from './o/engines/MaiaScriptEvaluator.js';

// Mock dependencies
const evaluator = new MaiaScriptEvaluator();

// Create engine
const threeEngine = new ThreeJSEngine(evaluator);

// Test scene creation
const sceneDef = {
  $type: 'scene',
  $id: 'test_scene',
  camera: { type: 'perspective', fov: 75, position: [0, 0, 5] },
  objects: [
    { type: 'mesh', geometry: 'box', material: { color: '#ff0000' }, position: [0, 0, 0] }
  ],
  lights: [{ type: 'ambient', color: 0xffffff, intensity: 0.5 }]
};

const mockActor = {
  context: { rotation: 0, primaryColor: '#ff0000' }
};

const container = document.createElement('div');
document.body.appendChild(container);

await threeEngine.createScene('test_scene', sceneDef, container, mockActor);

// Test update
mockActor.context.rotation = Math.PI / 4;
await threeEngine.updateScene('test_scene');

// Test cleanup
threeEngine.destroyScene('test_scene');
```

## Advanced Patterns

### Engine-to-Engine Communication

```javascript
class CustomEngine {
  constructor(stateEngine, viewEngine) {
    this.stateEngine = stateEngine;
    this.viewEngine = viewEngine;
  }
  
  async doSomething(actor) {
    // Trigger state machine event
    this.stateEngine.send(actor.machine.id, 'CUSTOM_EVENT', {
      data: 'from engine'
    });
    
    // Force UI re-render
    await this.viewEngine.render(actor.container, actor.viewDef, actor, actor.actorEngine);
  }
}
```

### Async Initialization

```javascript
class DatabaseEngine {
  constructor() {
    this.db = null;
    this.ready = false;
  }
  
  async initialize() {
    this.db = await openDatabase();
    this.ready = true;
    console.log('✅ Database engine ready');
  }
  
  async query(sql) {
    if (!this.ready) {
      throw new Error('DatabaseEngine not initialized');
    }
    return await this.db.execute(sql);
  }
}

// In kernel
os.dbEngine = new DatabaseEngine();
await os.dbEngine.initialize();
```

### Resource Management

```javascript
class AudioEngine {
  constructor() {
    this.audioContext = new AudioContext();
    this.buffers = new Map();
    this.sources = new Map();
  }
  
  async loadSound(id, url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.buffers.set(id, audioBuffer);
  }
  
  play(id) {
    const buffer = this.buffers.get(id);
    if (!buffer) return;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(0);
    
    this.sources.set(id, source);
  }
  
  stop(id) {
    const source = this.sources.get(id);
    if (source) {
      source.stop();
      this.sources.delete(id);
    }
  }
  
  destroy() {
    // Stop all sources
    for (const [id, source] of this.sources) {
      source.stop();
    }
    this.sources.clear();
    
    // Close audio context
    this.audioContext.close();
  }
}
```

## Next Steps

- Read [Tools Guide](./tools.md) - Creating tool modules
- Read [DSL Guide](./dsl.md) - Defining new DSL types
- Read [MaiaOS Guide](./maiaos.md) - Understanding the system
