---
name: Bun-First Elimination
overview: Eliminate Vite completely; standardize maia and moai on Bun-only toolchain. SPA mode for maia stays intact.
todos:
  - id: m0
    content: Verify Bun capabilities (audit)
    status: in_progress
  - id: m1
    content: Bun dev server for maia (replace Vite)
    status: pending
  - id: m2
    content: Bun build for distros (client, server, vibes)
    status: pending
  - id: m3
    content: Bun build for maia SPA (SPA mode intact)
    status: pending
  - id: m4
    content: Unify Dockerfiles and deploy, remove Vite
    status: pending
  - id: m5
    content: Verify end-to-end
    status: pending
isProject: true
---

# Bun-First Elimination Plan

**SPA mode**: Kept intact. Maia remains a Single Page Application (index.html + main.js); only the build/dev tooling changes from Vite to Bun.
