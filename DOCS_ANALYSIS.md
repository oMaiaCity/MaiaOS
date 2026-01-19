# MaiaOS Documentation Analysis & Restructuring Plan

**Date:** 2026-01-19  
**Scope:** `libs/maia-docs/` folder analysis

---

## Executive Summary

After reviewing the documentation structure and recent changes to the codebase (especially the rule file updates), here's what needs attention in the maia-docs folder.

---

## 🔄 NEEDS UPDATE (Refactor with Recent Changes)

### 1. `developers/07_cojson.md` - **HIGH PRIORITY**
**Issues:**
- References old `libs/maia-script/docs/` paths (should be `libs/maia-docs/`)
- Contains "MaiaCojson" terminology (now renamed to "MaiaDB")
- Extremely technical and dense (needs simplification per new rule guidelines)
- References old package names: `@maiaos/maia-cojson` (verify current package structure)
- 1500+ lines of highly technical content that could be broken down

**Recommendations:**
- Split into multiple smaller docs:
  - `07_database-basics.md` - Simple intro to MaiaDB (beginner-friendly)
  - `07_database-api.md` - API reference (operations-based approach)
  - `07_database-advanced.md` - Advanced topics (schemas, CRDTs, internals)
- Rewrite intro sections to match new "explain like they're 12" tone
- Update all path references from `maia-script/docs` to `maia-docs`
- Replace "MaiaCojson" with "MaiaDB" throughout
- Add more diagrams and analogies

### 2. `developers/README.md` - **MEDIUM PRIORITY**
**Issues:**
- References `08_tools.md` (doesn't exist yet - needs creation)
- May have outdated cross-references after potential restructuring

**Recommendations:**
- Update doc links after restructuring is complete
- Verify all numbered docs still exist
- Add brief descriptions to help readers choose their path

### 3. `creators/README.md` - **MEDIUM PRIORITY**
**Issues:**
- References `11_operations.md` (not visible in current folder listing)
- May need updates to reflect operations-based API approach

**Recommendations:**
- Verify if `11_operations.md` exists (might be new/unlisted)
- Update if operations doc is added or restructured
- Ensure consistency with developer docs

### 4. `getting-started/01_concept.md` - **MEDIUM PRIORITY**
**Issues:**
- References old "vibecreators" terminology
- Some technical explanations could be simplified
- Might reference outdated architecture concepts

**Recommendations:**
- Update terminology consistently (vibecreators → creators)
- Simplify explanations of core concepts
- Add more "real world" analogies (per new doc guidelines)
- Verify architecture diagrams are current

### 5. `creators/00-vibes.md` - **MEDIUM PRIORITY**
**Issues:**
- References `./02-actors.md#default-vibe-pattern-service--composite--ui` (verify link works)
- Contains technical concepts that could be simplified

**Recommendations:**
- Verify all internal links still work
- Simplify explanations of service actors
- Add more visual examples (diagrams of structure)

### 6. `agents/README.md` - **LOW PRIORITY**
**Issues:**
- References old commands: `bun run build:docs`, `bun run dev:docs` (should be `bun run docs:generate`, `bun run docs:watch`)
- References old file names: `LLM_Vibecreator.md` (is it now `LLM_Creators.md`?)
- Shows different path structure than current

**Recommendations:**
- Update script commands to match package.json
- Verify actual generated file names
- Update file size estimates if they've changed

---

## ❌ NEEDS DELETION (Outdated or Redundant)

### 1. Any lingering references to:
- "MaiaCojson" (renamed to MaiaDB)
- Old package paths
- Deprecated API methods

**Note:** After reviewing visible docs, no files need complete deletion, but sections within files may need removal.

---

## 🆕 NEEDS CREATION (Missing Documentation)

### 1. `developers/08_tools.md` - **HIGH PRIORITY**
**Status:** Referenced in `developers/README.md` but doesn't exist

**Should Include:**
- CLI tools overview
- Build system documentation
- Testing framework guide
- Debugging tools and techniques
- Code generation tools

### 2. `developers/09_authentication.md` - **HIGH PRIORITY**
**Status:** Referenced in `developers/README.md` but doesn't exist

**Should Include:**
- Authentication architecture
- Account management
- Session handling
- Security best practices
- Integration with Jazz/cojson auth

### 3. `creators/11_operations.md` - **HIGH PRIORITY**
**Status:** Referenced in `developers/07_cojson.md` but may not exist

**Should Include:**
- Operations-based API overview
- `o.db({ op })` syntax guide
- Common operation patterns
- CRUD operations examples
- Error handling

### 4. `getting-started/05_quickstart.md` - **MEDIUM PRIORITY**
**Status:** Natural progression from install guide

**Should Include:**
- "Hello World" example
- First vibe creation
- Common starter patterns
- Where to go next

### 5. `architecture/testing-strategy.md` - **MEDIUM PRIORITY**
**Status:** Referenced in `07_cojson.md` (Zero Mocks Policy)

**Should Include:**
- Testing philosophy (Zero Mocks Policy)
- How to write tests with real CRDTs
- Testing patterns and examples
- Integration test strategies

---

## 🔀 NEEDS RESTRUCTURING (Better Organization)

### 1. Split Large Files

**`developers/07_cojson.md` (1500+ lines)** → Split into:
- `developers/07a_database-basics.md` - Intro, concepts, getting started
- `developers/07b_database-operations.md` - CRUD operations, API reference
- `developers/07c_database-schemas.md` - Schema system, validation, references
- `developers/07d_database-advanced.md` - Internals, performance, troubleshooting

### 2. Consolidate Related Content

**Architecture folder** - Consider organizing by:
- `core-architecture/` - System-level design
- `security/` - Auth, permissions, crypto
- `data/` - Database, sync, CRDTs
- `patterns/` - Best practices, anti-patterns

### 3. Add Cross-Reference Index

**Create `docs-index.md`** at root with:
- Concept map showing relationships between docs
- "If you want to X, read Y" guide
- Common learning paths for different roles

---

## 📝 SPECIFIC CONTENT IMPROVEMENTS

### 1. Add More Diagrams
**Files needing visual aids:**
- `getting-started/01_concept.md` - System architecture diagram
- `creators/00-vibes.md` - Vibe → Actor → View flow diagram
- `developers/04_engines.md` - Engine interaction diagram
- `developers/07_cojson.md` - Schema/Data layer separation diagram

### 2. Simplify Technical Explanations
**Apply "explain like they're 12" approach to:**
- All getting-started docs (critical for beginners)
- Intro sections of all docs
- Error message explanations

### 3. Add Troubleshooting Sections
**Files needing "Common Issues" sections:**
- All creator docs (especially operations and database)
- Getting started guides
- Developer guides for complex topics

### 4. Update Code Examples
**Ensure all examples:**
- Use current API (operations-based, not old methods)
- Include comments explaining each line
- Show expected output
- Highlight common mistakes

---

## 🔍 VERIFICATION CHECKLIST

After making updates, verify:

- [ ] No references to "MaiaCojson" (should be "MaiaDB")
- [ ] All paths use `libs/maia-docs/` (not `libs/maia-script/docs/`)
- [ ] All commands match current `package.json` scripts
- [ ] All internal links work (no 404s)
- [ ] All code examples use current API
- [ ] No references to `vibecreators` (use `creators`)
- [ ] Agent docs regenerated: `bun run docs:generate`
- [ ] All new files added to appropriate README indexes

---

## 📊 PRIORITIZATION MATRIX

### Immediate (Week 1)
1. Fix `developers/07_cojson.md` terminology and paths
2. Create missing docs: `08_tools.md`, `09_authentication.md`, `11_operations.md`
3. Update all path references across docs
4. Verify and fix all internal links

### Short-term (Week 2-3)
1. Split large files (especially `07_cojson.md`)
2. Simplify getting-started docs
3. Add troubleshooting sections to all creator docs
4. Create architecture folder reorganization

### Medium-term (Month 1-2)
1. Add diagrams to all major concepts
2. Create comprehensive doc index
3. Write testing strategy guide
4. Create quickstart guide

### Long-term (Ongoing)
1. Continuously refine tone and clarity
2. Add more real-world examples
3. Gather feedback and iterate
4. Keep docs in sync with code changes

---

## 🎯 SUCCESS METRICS

After restructuring, documentation should:
- ✅ Be understandable by someone new to MaiaOS
- ✅ Have no broken internal links
- ✅ Use consistent terminology throughout
- ✅ Include working code examples for all concepts
- ✅ Be organized by user role (creator vs developer)
- ✅ Have clear "next steps" in each document

---

## 💡 SUGGESTED WORKFLOW

1. **Phase 1: Critical Fixes** (Do first)
   - Update paths and terminology
   - Fix broken links
   - Create missing critical docs

2. **Phase 2: Content Restructuring** (Do second)
   - Split large files
   - Reorganize architecture folder
   - Add diagrams

3. **Phase 3: Content Enhancement** (Do third)
   - Simplify language
   - Add troubleshooting
   - Improve examples

4. **Phase 4: Polish & Maintenance** (Ongoing)
   - Gather user feedback
   - Refine based on common questions
   - Keep in sync with code

---

**Remember:** After ANY documentation update, regenerate agent docs:
```bash
bun run docs:generate
```

This ensures LLM agents have the latest context.
