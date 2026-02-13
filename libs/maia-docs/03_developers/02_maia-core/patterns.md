# Common Patterns and Troubleshooting

Common usage patterns and solutions to frequent problems.

---

## Common Patterns

### Pattern 1: Full App Setup

```javascript
import { createMaiaOS, MaiaOS } from '@MaiaOS/core';
import { signInWithPasskey } from '@MaiaOS/self';

async function setupApp() {
  // Authenticate
  const { node, account } = await signInWithPasskey({ salt: "maia.city" });
  const o = await createMaiaOS({ node, account });
  
  // Boot OS
  const os = await MaiaOS.boot({
    modules: ['db', 'core', 'dragdrop']
  });
  
  // Load app
  const { vibe, actor } = await os.loadVibeFromDatabase(
    '@vibe/todos',
    document.getElementById('app')
  );
  
  return { o, os, vibe, actor };
}
```

---

### Pattern 2: Development Debugging

```javascript
const os = await MaiaOS.boot({ modules: ['db', 'core'] });

// Expose for debugging
window.os = os;
window.engines = os.getEngines();

// Inspect engines
console.log("ActorEngine:", os.getEngines().actorEngine);
console.log("ToolEngine:", os.getEngines().toolEngine);
```

---

### Pattern 3: Custom Module Loading

```javascript
// Load only what you need
const os = await MaiaOS.boot({
  modules: ['db', 'core'] // Skip dragdrop and interface
});
```

---

## Troubleshooting

### Problem: "Node and Account required"

**Solution:** You must call `signInWithPasskey()` first:

```javascript
// ❌ Wrong
const o = await createMaiaOS({});

// ✅ Correct
const { node, account } = await signInWithPasskey({ salt: "maia.city" });
const o = await createMaiaOS({ node, account });
```

---

### Problem: Module not found

**Solution:** Check module name and ensure it exists:

```javascript
// ❌ Wrong
await MaiaOS.boot({ modules: ['nonexistent'] });

// ✅ Correct
await MaiaOS.boot({ modules: ['db', 'core'] });
```

---

### Problem: Schema validation fails during boot

**Solution:** Check your schemas are valid JSON Schema:

```javascript
// Ensure schemas are valid before booting
const validationEngine = new ValidationEngine();
await validationEngine.initialize();
// ... validate schemas
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [auth-layer.md](./auth-layer.md) - Identity & Authentication layer
- [boot-process.md](./boot-process.md) - Boot process details
- [api-reference.md](./api-reference.md) - Complete API reference
