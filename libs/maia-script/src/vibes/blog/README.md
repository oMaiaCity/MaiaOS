# MaiaOS Blog - Operations-Based Demo

A simple, clean blog built with the new operations-based API (`o.db({ op })`).

## Features

- ✅ **Operations-only API** - All interactions through `o.db({ op })`
- ✅ **Schema-as-CoMaps** - Dynamic schemas stored as CRDTs
- ✅ **Deep resolution** - Nested reference loading
- ✅ **3 tabs**: Blog, Schemas, Inspector
- ✅ **Real CRDTs** - Full cojson backing (zero mocks)
- ✅ **Clean UI** - Liquid glass design with earthy colors

## Running the App

The blog runs as part of the main MaiaScript dev server:

```bash
# From workspace root:
cd libs/maia-script
bun dev
```

Then open: **http://localhost:4200/vibes/blog/**

Or click "Blog App" from the marketplace: **http://localhost:4200/**

## What's Demonstrated

### Operations API

All database operations use the unified `o.db({ op })` format:

```javascript
// Schema registration
await o.db({
  op: "registerSchema",
  name: "Post",
  definition: { type: "co-map", properties: {...} }
});

// Create
await o.db({
  op: "create",
  schema: schemaId,
  data: { title: "Hello", content: "World", likes: 0 }
});

// Read
await o.db({
  op: "read",
  target: { id: postId }
});

// Update (with nested operations!)
await o.db({
  op: "update",
  target: { id: postId },
  changes: {
    title: "New Title",
    likes: { op: "increment", by: 1 }
  }
});

// Delete
await o.db({
  op: "delete",
  target: { id: postId }
});

// Inspector
await o.db({
  op: "allLoaded"
});
```

### UI Features

1. **Blog Tab**
   - View all posts
   - Create random posts
   - Edit post titles (click to edit)
   - Like posts (increment operation)
   - Delete posts

2. **Schemas Tab**
   - View all registered schemas
   - Expandable schema definitions
   - Shows MetaSchema (self-referencing)
   - Real-time schema loading

3. **Inspector Tab** (NEW!)
   - View all loaded CoValues
   - Type statistics (CoMaps, CoLists, etc.)
   - Size calculations
   - Property inspection
   - Debug tool for development

## Architecture

### Package Flow

```
Blog App (vibes/blog/)
  ↓ imports
o.js (MaiaOS context)
  ↓ imports
Operations Engine
  ↓ imports
maia-cojson kernel (wrappers, SchemaStore, etc.)
  ↓ imports
cojson (raw CRDTs)
```

### Operations-Only Philosophy

**NO direct mutations** - Everything via operations:

```javascript
// ❌ Direct assignment (not used)
post.likes = 42;

// ✅ Update operation (used)
await o.db({
  op: "update",
  target: { id: post.$id },
  changes: { likes: { op: "set", value: 42 } }
});
```

## Technical Details

- **Real CRDTs**: Every post, author, and schema is a real cojson CoValue
- **Ephemeral accounts**: New account created each session (demo mode)
- **In-memory sync**: No persistence (refresh = new data)
- **Zero mocks**: All data backed by actual CRDTs
- **Schema validation**: Every operation validated against JSON Schema

## Notes

- This is a demo app showing the operations API
- Data is ephemeral (resets on refresh)
- For production, add persistence and sync servers
- Inspector tab is a debug tool (shows all loaded CoValues)

## Learn More

See `libs/maia-script/src/o/engines/operations-engine/README.md` for full API documentation.
