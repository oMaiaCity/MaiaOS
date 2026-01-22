# Split Documentation into Digestible Chunks

## Problem Statement

Large documentation files (928 lines for maia-script, 525 lines for maia-kernel) are hard to navigate and digest. Documentation should be split into logical, digestible chunks of 250-300 lines maximum for better readability and maintainability.

## Success Criteria

- **Desirable**: Developers can quickly find specific information without scrolling through huge files
- **Feasible**: Logical clustering maintains related concepts together
- **Viable**: Documentation structure is maintainable and easy to update

## Solution Approach

Split large README files into focused sub-files organized by topic, with the main README serving as an index/navigation hub.

### maia-script Structure (928 lines → ~6 files)

1. **README.md** (~150 lines) - Overview, architecture, navigation
2. **engines.md** (~300 lines) - All engine descriptions
3. **modules.md** (~200 lines) - Module system and custom modules
4. **expressions.md** (~200 lines) - MaiaScript expression language
5. **api-reference.md** (~150 lines) - Complete API reference
6. **patterns.md** (~150 lines) - Common patterns and troubleshooting

### maia-kernel Structure (525 lines → ~4 files)

1. **README.md** (~150 lines) - Overview, two layers, navigation
2. **auth-layer.md** (~200 lines) - Identity & Authentication layer
3. **boot-process.md** (~200 lines) - Boot process and execution layer
4. **api-reference.md** (~150 lines) - Complete API reference
5. **patterns.md** (~100 lines) - Common patterns and troubleshooting

## Implementation Plan

### Milestone 1: Update writing-docs Rule

**File:** `.cursor/rules/writing-docs.mdc`

**Changes:**
- Add section on "Documentation File Size and Splitting"
- Specify max 250-300 lines per file
- Provide guidelines for logical clustering
- Explain when to split vs. when to keep together

### Milestone 2: Split maia-script Documentation

**Files to Create:**
- `libs/maia-docs/03_developers/04_maia-script/README.md` (overview, navigation)
- `libs/maia-docs/03_developers/04_maia-script/engines.md` (all engines)
- `libs/maia-docs/03_developers/04_maia-script/modules.md` (module system)
- `libs/maia-docs/03_developers/04_maia-script/expressions.md` (MaiaScript expressions)
- `libs/maia-docs/03_developers/04_maia-script/api-reference.md` (API reference)
- `libs/maia-docs/03_developers/04_maia-script/patterns.md` (patterns & troubleshooting)

**Content Distribution:**
- README.md: Overview, simple version, architecture diagram, navigation links
- engines.md: All 10 engine descriptions (MaiaScriptEvaluator, ActorEngine, ViewEngine, etc.)
- modules.md: Module system explanation, available modules, creating custom modules
- expressions.md: Expression syntax, all operations, validation, security
- api-reference.md: Exported engines, subpath exports
- patterns.md: Common patterns, troubleshooting

### Milestone 3: Split maia-kernel Documentation

**Files to Create:**
- `libs/maia-docs/03_developers/02_maia-kernel/README.md` (overview, navigation)
- `libs/maia-docs/03_developers/02_maia-kernel/auth-layer.md` (createMaiaOS)
- `libs/maia-docs/03_developers/02_maia-kernel/boot-process.md` (MaiaOS.boot())
- `libs/maia-docs/03_developers/02_maia-kernel/api-reference.md` (API reference)
- `libs/maia-docs/03_developers/02_maia-kernel/patterns.md` (patterns & troubleshooting)

**Content Distribution:**
- README.md: Overview, simple version, two layers explanation, navigation links
- auth-layer.md: Identity & Authentication layer (createMaiaOS), what you get, examples
- boot-process.md: Boot process deep dive, engine initialization, module loading
- api-reference.md: Complete API reference for all methods
- patterns.md: Common patterns, troubleshooting

### Milestone 4: Update Cross-References

**Files to Update:**
- `libs/maia-docs/03_developers/README.md` - Update links to point to new structure
- Any other docs that reference these files

## File Structure

### maia-script Structure

```
04_maia-script/
├── README.md              # Overview, architecture, navigation (~150 lines)
├── engines.md             # All engine descriptions (~300 lines)
├── modules.md             # Module system (~200 lines)
├── expressions.md         # MaiaScript expressions (~200 lines)
├── api-reference.md       # API reference (~150 lines)
└── patterns.md            # Patterns & troubleshooting (~150 lines)
```

### maia-kernel Structure

```
02_maia-kernel/
├── README.md              # Overview, two layers, navigation (~150 lines)
├── auth-layer.md          # Identity & Authentication (~200 lines)
├── boot-process.md        # Boot process & execution (~200 lines)
├── api-reference.md       # API reference (~150 lines)
└── patterns.md            # Patterns & troubleshooting (~100 lines)
```

## Logical Clustering Guidelines

### When to Split

Split documentation when:
- File exceeds 300 lines
- Multiple distinct topics that can stand alone
- Different audiences (e.g., API reference vs. concepts)
- Different use cases (e.g., getting started vs. advanced)

### How to Cluster

Cluster related concepts together:
- **By topic** - All engines together, all modules together
- **By audience** - Concepts vs. API reference
- **By use case** - Getting started vs. advanced patterns
- **By layer** - Auth layer vs. execution layer

### Main README Structure

Main README should:
- Provide overview and simple explanation
- Show architecture/high-level concepts
- Link to detailed sub-files
- Keep it concise (~150 lines max)

## Key Principles

1. **Main README = Navigation Hub** - Quick overview + links to details
2. **Sub-files = Focused Topics** - One topic per file, 250-300 lines max
3. **Logical Clustering** - Related concepts stay together
4. **Cross-References** - Each file links to related files
5. **Progressive Disclosure** - Overview → Details → Advanced

## Dependencies

- Update writing-docs rule first
- Then split maia-script
- Then split maia-kernel
- Finally update cross-references

## Notes

- Keep main README files as entry points with navigation
- Each sub-file should be self-contained but link to related files
- Maintain consistent structure across all sub-files
- Update any existing cross-references to point to new structure
