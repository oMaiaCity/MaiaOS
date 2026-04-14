# Common Patterns and Troubleshooting

Common usage patterns and solutions to frequent problems.

---

## Common Patterns

### Pattern 1: Custom Module with Tools

```javascript
// Built-in modules are defined in libs/maia-runtime/src/modules/registry.js
// To add a custom module, extend BUILTIN_MODULES or register at boot:
// registry.registerModule('mymodule', module, config)

// Actor definitions and functions live in @MaiaOS/actors
// Tools are referenced by actor co-id (e.g. @maia/actor/os/db)
// Load module during boot: modules: ['db', 'core', 'ai', 'mymodule']
```

---

### Pattern 2: Custom Expression Evaluator

```javascript
const evaluator = new MaiaScriptEvaluator(null, {
  maxDepth: 100,
  validateExpressions: true
});

// Use in custom context
const result = await evaluator.evaluate(expression, { context: myData });
```

---

### Pattern 3: Direct Database Access

```javascript
// DataEngine receives MaiaDB (from MaiaOS.boot)
// Use maia.do() or dataEngine.execute():

const store = await maia.do({
  op: 'read',
  factory: '°Maia/factory/todos'  // Factory co-id or registry key
});

console.log('Current data:', store.value);

const unsubscribe = store.subscribe((data) => {
  console.log('Data updated:', data);
});
```

---

## Troubleshooting

### Problem: Expression evaluation fails

**Solution:** Check expression syntax and validation:

```javascript
// ❌ Wrong - invalid syntax
{ "$if": { "condition": true } } // Missing 'then' and 'else'

// ✅ Correct
{ "$if": { "condition": true, "then": "yes", "else": "no" } }
```

---

### Problem: Module not loading

**Solution:** Check module registration:

```javascript
// Ensure module exports register function
export async function register(registry) {
  return await MyModule.register(registry);
}

// Ensure module is in boot config
const os = await MaiaOS.boot({
  modules: ['mymodule'] // Add your module
});
```

---

### Problem: Tool not found

**Solution:** Check tool registration:

```javascript
// Tools are actor-based; ensure actor is in @MaiaOS/actors and module references it
// Module tools array: tools: ['@maia/actor/os/db'] etc.
// Actor path in ACTORS: 'maia/actor/os/db'
```

---

### Problem: Expression depth exceeded

**Solution:** Increase depth limit or simplify expression:

```javascript
// Increase depth limit
const evaluator = new MaiaScriptEvaluator(null, {
  maxDepth: 100 // Default is 50
});

// Or simplify nested expressions
```

---

## Related Documentation

- [Main README](./README.md) - Package overview
- [engines/](./engines/) - Engine details
- [modules.md](./modules.md) - Module system
- [expressions.md](./expressions.md) - Expression language
- [api-reference.md](./api-reference.md) - API reference
