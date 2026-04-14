# API Reference

Complete API reference for `@MaiaOS/runtime` package.

---

## Exported Engines and Runtime

All engines are exported from `@MaiaOS/runtime`:

```javascript
import {
  ActorEngine,
  ViewEngine,
  ProcessEngine,
  StyleEngine,
  DataEngine,
  MaiaScriptEvaluator,
  ModuleRegistry,
  Runtime,
} from '@MaiaOS/runtime';
```

**Note:** Inbox logic is in ActorEngine; binary ops (uploadBinary, loadBinaryAsBlob, uploadToCoBinary) are in DataEngine.

---

## Using Engines Directly

### Custom Evaluator

```javascript
import { Evaluator as MaiaScriptEvaluator } from '@MaiaOS/runtime';

const evaluator = new MaiaScriptEvaluator();

const result = await evaluator.evaluate(
  { $if: { condition: true, then: 'yes', else: 'no' } },
  { context: {}, item: {} }
);
```

### Custom View Renderer

```javascript
import { ViewEngine, MaiaScriptEvaluator, ModuleRegistry } from '@MaiaOS/runtime';

const evaluator = new MaiaScriptEvaluator();
const registry = new ModuleRegistry();
const viewEngine = new ViewEngine(evaluator, null, registry);

await viewEngine.render(viewDef, { context: {} }, shadowRoot, [], 'custom');
```

### Data Operations (maia.do)

```javascript
// maia = booted MaiaOS instance (from MaiaOS.boot())

const store = await maia.do({
  op: 'read',
  factory: 'co_zTodos123'
});

console.log('Current data:', store.value);

const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

---

## Package Exports

Defined in `libs/maia-runtime/package.json`:

```json
{
  "exports": {
    ".": "./src/index.js",
    "./modules/*": "./src/modules/*",
    "./engines/*": "./src/engines/*"
  }
}
```

---

## Related Documentation

- [README.md](./README.md) - Package overview
- [engines/](./engines/) - Detailed engine descriptions
- [modules.md](./modules.md) - Module system
- [expressions.md](./expressions.md) - Expression language
- [patterns.md](./patterns.md) - Common patterns
