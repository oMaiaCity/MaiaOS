# Hominio Documentation

**Welcome to the Hominio Documentation!**

---

## 📚 Main Documentation

### **[Vibes Architecture](./vibes/README.md)**

Complete documentation for the Hominio Vibes system - a Jazz-native, actor-based architecture for building real-time collaborative applications.

**Core Concepts**:
- **[Actors](./vibes/actors/README.md)** - Message-passing actor system
- **[Skills](./vibes/skills/README.md)** - Reusable business logic
- **[View Layer](./vibes/view/README.md)** - JSON-driven UI (Composite/Leaf)
- **[Jazz Integration](./vibes/jazz/README.md)** - Real-time collaborative data
- **[Schemata](./vibes/schemata/README.md)** - Type system for data and UI
- **[Vibes](./vibes/vibes/README.md)** - Complete applications

**Quick References**:
- **[Architecture Summary](./vibes/ARCHITECTURE_SUMMARY.md)** - Quick reference guide
- **[Migration Guide](./MIGRATION_GUIDE.md)** - Legacy to actor-based migration

---

## 🚀 Quick Start

### New to Hominio?

1. **Start with the overview**: Read **[Vibes Architecture](./vibes/README.md)**
2. **Understand actors**: Learn **[Actor Architecture](./vibes/actors/README.md)**
3. **Explore skills**: Study **[Skills System](./vibes/skills/README.md)**
4. **Build UI**: Practice with **[View Layer](./vibes/view/README.md)**
5. **Create a vibe**: Follow **[Vibes Guide](./vibes/vibes/README.md)**

### Migrating from Legacy?

See the **[Migration Guide](./MIGRATION_GUIDE.md)** for step-by-step instructions on converting from the old vibe-based architecture to the new actor-based system.

---

## 🎯 What You'll Learn

### Actors
- Each UI component is an actor with its own state machine
- Pure message passing (no prop drilling)
- ID-based relationships (explicit hierarchies)
- Jazz-native inboxes for receiving messages

### Skills
- Reusable business logic functions
- Central skill registry
- Entity, relation, UI, and custom skills
- LLM-ready with rich metadata

### View Layer
- JSON-driven UI definitions
- Composite (layout) and Leaf (content) pattern
- Container-query responsive design
- Schema-driven design system

### Jazz Integration
- Real-time collaborative data
- CoValues (CoMap, CoList, CoFeed)
- CoState for reactive Svelte subscriptions
- Offline-first architecture

### Schemata
- Unified type system for data and UI
- Entity and relation schemas
- UI component templates
- Runtime modifiable types

### Vibes
- Complete, self-contained applications
- Combining actors, skills, views, and data
- Database-ready (store entire apps in Jazz)
- Real-world examples

---

## 📖 Documentation Structure

```
docs/
├── README.md                    # This file
├── MIGRATION_GUIDE.md           # Legacy to actor-based migration
├── vibes/
│   ├── README.md                # Main vibes overview
│   ├── ARCHITECTURE_SUMMARY.md  # Quick reference
│   ├── actors/
│   │   └── README.md            # Actor architecture
│   ├── skills/
│   │   └── README.md            # Skills system
│   ├── view/
│   │   └── README.md            # View layer (Composite/Leaf)
│   ├── jazz/
│   │   └── README.md            # Jazz integration
│   ├── schemata/
│   │   └── README.md            # Type system
│   └── vibes/
│       └── README.md            # Complete applications
└── archive/
    └── LEGACY_*.md              # Archived legacy docs
```

---

## 🔧 Code Organization

The Hominio monorepo is organized as follows:

```
hominio/
├── services/
│   ├── me/                      # Main app service
│   │   └── src/lib/
│   │       ├── compositor/      # Core actor system
│   │       │   ├── actors/      # ActorRenderer, types
│   │       │   ├── skills/      # Skill registry & skills
│   │       │   └── view/        # Composite.svelte, Leaf.svelte
│   │       └── vibes/           # Vibe implementations
│   │           ├── humans/      # Humans vibe
│   │           ├── vibes/       # Vibes registry vibe
│   │           └── design-templates/  # UI templates
│   ├── website/                 # Landing page (port 4200)
│   └── wallet/                  # Auth service (port 4201)
└── libs/
    └── hominio-db/              # Shared database schemas
        └── src/
            ├── schema.ts        # Jazz schemas
            └── functions/       # CRUD operations
```

---

## 🎓 Learning Resources

### Tutorials
- **[Creating Your First Vibe](./vibes/vibes/README.md#creating-a-vibe)** - Step-by-step guide
- **[Building a CRUD List](./vibes/actors/README.md#pattern-1-list-with-items)** - Common pattern
- **[Custom Skills](./vibes/skills/README.md#creating-custom-skills)** - Extend functionality

### Examples
- **Humans Vibe** - `services/me/src/lib/vibes/humans/`
- **Vibes Registry Vibe** - `services/me/src/lib/vibes/vibes/`

### API Reference
- **[Actor Schema](./vibes/actors/README.md#actor-structure)** - Actor CoValue definition
- **[Skill Interface](./vibes/skills/README.md#skill-structure)** - Skill metadata & execute
- **[Composite/Leaf Types](./vibes/view/README.md#architecture)** - View definitions

---

## 🐛 Troubleshooting

### Common Issues

1. **Actors not rendering?**
   - Check actor exists in registry: `root.vibes.myapp`
   - Verify `$isLoaded`: `if (actor?.$isLoaded)`
   - Check children: `Array.from(actor.children)`

2. **Events not firing?**
   - Verify subscriptions: `Array.from(actor.subscriptions)`
   - Check state machine: `actor.states.idle.on`
   - Log in `handleEvent`

3. **Payload undefined?**
   - Use object format: `{ id: 'item.id' }`
   - Not string: `'{ id: item.id }'`

4. **Double creation on HMR?**
   - Add global lock (see examples)

See **[Debugging Actors](./vibes/actors/README.md#debugging-actors)** for more details.

---

## 🤝 Contributing

### Documentation
- Follow the established structure
- Include code examples
- Add cross-references
- Keep language clear and concise

### Code
- Follow the actor-based architecture
- Use skills for business logic
- Create template functions for reusable UI
- Write comprehensive state machines

---

## 📝 License

This documentation is part of the Hominio project. See the main repository for license information.

---

**Ready to build? Start with the [Vibes Architecture](./vibes/README.md)!**
