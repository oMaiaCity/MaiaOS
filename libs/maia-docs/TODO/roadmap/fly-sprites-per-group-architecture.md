---
name: Fly.io Sprites Per-Group Architecture
overview: Future evolution to scale sync server using Fly.io Sprites - one Sprite per group/user with Hypercore/RocksDB storage, sync server acts as gateway/router. This is a SECOND refactor after the first implementation that persists in the sync service itself.
todos:
  - id: milestone-0
    content: "Prerequisites: Complete first implementation (server-side Hypercore persistence)"
    status: pending
  - id: milestone-1
    content: "Design Sprite Architecture: Define Sprite lifecycle, routing, storage model"
    status: pending
  - id: milestone-2
    content: "Implement Sprite Gateway: Route requests to group-specific Sprites"
    status: pending
  - id: milestone-3
    content: "Implement Sprite Storage: Hypercore/RocksDB on Sprite's object storage"
    status: pending
  - id: milestone-4
    content: "Implement Sprite Lifecycle: Auto-create, scale-to-zero, wake-on-demand"
    status: pending
  - id: milestone-5
    content: "Testing & Documentation: Verify Sprite routing, persistence, scaling"
    status: pending
isProject: false
---

# Fly.io Sprites Per-Group Architecture

## Problem Statement

After implementing server-side Hypercore persistence in the sync service itself, we need to scale horizontally. The current architecture stores all groups' data in a single sync server, which becomes a bottleneck as we scale.

**First Principles:**

- **What MUST be true:** Each group's data must be isolated and independently scalable
- **What can we eliminate:** Single-point-of-failure sync server, shared storage bottlenecks
- **Irreducible core:** Per-group isolation → Per-group Sprite → Per-group storage

## Success Criteria

- **Desirable**: Unlimited horizontal scaling (one Sprite per group/user)
- **Feasible**: Use Fly.io Sprites for instant VM creation, scale-to-zero, persistent storage
- **Viable**: Cost-effective (only pay for active Sprites), simple routing logic

## Solution Approach

**Architecture: Sync Server (Gateway) → Fly.io Sprites (Per-Group) → Hypercore/RocksDB Storage**

**Key Innovation:**

- **Sync Server** = Stateless gateway/router (no persistence)
- **Fly.io Sprites** = One per group/user (isolated, scalable)
- **Each Sprite** = Runs its own Hypercore/RocksDB storage
- **Scale-to-Zero** = Sprites auto-sleep when inactive, wake on-demand

**Prerequisites:**

- ✅ **First Implementation Complete**: Server-side Hypercore persistence working in sync service
- ✅ **Hyperbee Storage Backend**: StorageAPI implementation using Hyperbee/Corestore
- ✅ **Group Ownership Model**: Groups as trust root, owning CoValues

## Architecture Overview

### Current State (After First Implementation)

```
Sync Server (libs/maia-sync/src/sync-server.js)
├─ LocalNode (cojson)
├─ Storage: Hyperbee/Corestore (persistent) ✅
│  ├─ ALL groups' data in one Corestore
│  ├─ ALL sessions in one storage directory
│  └─ Single point of storage
└─ WebSocket: Receives messages from browsers ✅
```

**Limitations:**
- Single sync server handles all groups
- All data in one storage directory
- Cannot scale horizontally
- Single point of failure

### Target State (Sprite Architecture)

```
┌─────────────────────────────────────────────────────────┐
│ Sync Server (Gateway/Router - Stateless)                │
│ ├─ WebSocket: Receives messages from browsers            │
│ ├─ Routing Logic: Routes to group-specific Sprite       │
│ └─ NO persistence (stateless gateway)                     │
└─────────────────────────────────────────────────────────┘
                         ↓ Routes to
┌─────────────────────────────────────────────────────────┐
│ Fly.io Sprite (Group: co_zABC...)                       │
│ ├─ LocalNode (cojson)                                    │
│ ├─ Storage: Hypercore/RocksDB (persistent)              │
│ │  ├─ Group's Corestore instance                        │
│ │  ├─ Group's Hypercores (sessions)                     │
│ │  └─ Group's Hyperbee (CoValue metadata)               │
│ ├─ 100GB durable storage (object storage backed)        │
│ └─ Auto-sleep when inactive, wake on-demand            │
└─────────────────────────────────────────────────────────┘
                         ↓ Routes to
┌─────────────────────────────────────────────────────────┐
│ Fly.io Sprite (Group: co_zXYZ...)                       │
│ ├─ LocalNode (cojson)                                    │
│ ├─ Storage: Hypercore/RocksDB (persistent)              │
│ └─ Isolated from other groups                            │
└─────────────────────────────────────────────────────────┘
```

### Sprite Storage Architecture

**How Sprites Persist Storage:**

Based on Fly.io's Sprite implementation ([source](https://fly.io/blog/design-and-implementation/)):

1. **Object Storage Root**: Sprites use S3-compatible object storage as the root of storage
2. **JuiceFS Model**: Storage split into:
   - **Data chunks** → Stored on object storage (immutable, durable)
   - **Metadata** → Fast local storage (SQLite with Litestream for durability)
3. **NVMe Cache**: Sparse 100GB NVMe volume attached for read-through caching
4. **Checkpoint/Restore**: Fast metadata shuffling (not data copying)

**Hypercore/RocksDB on Sprite Storage:**

- **RocksDB** (`hypercore-storage`) can use Sprite's filesystem directly
- Sprite's filesystem is backed by object storage (durable)
- RocksDB writes → Sprite filesystem → Object storage chunks
- **Perfect fit**: RocksDB needs a filesystem, Sprites provide a durable one

**Storage Flow:**

```
Hypercore/RocksDB → Sprite Filesystem → JuiceFS → Object Storage (S3)
                                    ↓
                            NVMe Cache (read-through)
```

## Implementation Milestones

### Milestone 0: Prerequisites

**CRITICAL: This MUST be completed before all other milestones**

**Prerequisites:**

- ✅ Complete first implementation (`server-side-hypercore-persistence.md`)
  - Corestore adapter working
  - Hyperbee storage backend implemented
  - Session-to-Hypercore mapping complete
  - Group permissions mapping complete
- ✅ Verify server-side persistence works correctly
- ✅ Test group isolation and ownership

**Output**: First implementation complete and verified

**Human Checkpoint:** ✋ Verify first implementation before proceeding

### Milestone 1: Design Sprite Architecture

**Goal:** Design the Sprite-based architecture and routing model

**Architecture Design:**

- **Sprite Lifecycle:**
  - Create Sprite on-demand when group first accessed
  - Sprite name = `group-${groupID}` (deterministic)
  - Sprite auto-sleeps after inactivity (30s default)
  - Sprite wakes on-demand when request arrives
- **Routing Logic:**
  - Extract `groupID` from WebSocket message or request
  - Route to Sprite: `group-${groupID}`
  - If Sprite doesn't exist → Create it
  - If Sprite is sleeping → Wake it (Fly.io API)
- **Storage Model:**
  - Each Sprite has its own Corestore instance
  - Storage path: `/data/hypercore-storage` (Sprite's persistent filesystem)
  - Use `hypercore-storage` (RocksDB) for performance
  - Storage backed by Sprite's object storage (durable)

**Key Design Decisions:**

- **Stateless Gateway**: Sync server has no storage, only routing logic
- **Per-Group Isolation**: Each group's data completely isolated in its own Sprite
- **Scale-to-Zero**: Sprites sleep when inactive, cost-effective
- **Deterministic Naming**: Sprite name = `group-${groupID}` (always same Sprite for same group)

**Output**: Architecture design document with routing logic, Sprite lifecycle, storage model

**Human Checkpoint:** ✋ Review architecture design before implementation

### Milestone 2: Implement Sprite Gateway

**Goal:** Transform sync server into stateless gateway/router

**Implementation:**

- Create `libs/maia-sync/src/sprite-gateway.js`
  - Extract `groupID` from WebSocket messages
  - Route to appropriate Sprite
  - Handle Sprite creation (if doesn't exist)
  - Handle Sprite wake (if sleeping)
- Update `libs/maia-sync/src/sync-server.js`
  - Remove storage initialization
  - Remove Corestore/Hyperbee setup
  - Add Sprite routing logic
  - Forward WebSocket messages to Sprites
- Implement Sprite API client
  - Create Sprite: `sprite create group-${groupID}`
  - Wake Sprite: `sprite wake group-${groupID}`
  - Get Sprite URL: `sprite url group-${groupID}`
  - Forward WebSocket connection to Sprite

**Key Implementation:**

```javascript
// libs/maia-sync/src/sprite-gateway.js
import { FlyAPI } from '@fly.io/api'; // Hypothetical Fly.io API client

export class SpriteGateway {
  constructor() {
    this.flyAPI = new FlyAPI();
    this.spriteCache = new Map(); // Cache Sprite URLs
  }

  async routeToSprite(groupID, wsMessage) {
    const spriteName = `group-${groupID}`;
    
    // Check if Sprite exists
    let sprite = await this.flyAPI.getSprite(spriteName);
    
    if (!sprite) {
      // Create Sprite on-demand
      sprite = await this.flyAPI.createSprite({
        name: spriteName,
        image: 'maia-sync-sprite:latest',
        storage: { size: '100GB' }
      });
    }
    
    // Wake Sprite if sleeping
    if (sprite.state === 'sleeping') {
      await this.flyAPI.wakeSprite(spriteName);
      await this.waitForSpriteReady(spriteName);
    }
    
    // Get Sprite WebSocket URL
    const spriteURL = await this.flyAPI.getSpriteWebSocketURL(spriteName);
    
    // Forward WebSocket message to Sprite
    return this.forwardToSprite(spriteURL, wsMessage);
  }

  async waitForSpriteReady(spriteName, timeout = 5000) {
    // Wait for Sprite to be ready (wake up)
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const sprite = await this.flyAPI.getSprite(spriteName);
      if (sprite.state === 'running') return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Sprite ${spriteName} did not wake in time`);
  }
}
```

**Cleanup & Migration:**

- Remove Corestore/Hyperbee initialization from sync server
- Remove storage directory configuration
- Update sync server to use Sprite gateway
- Verify 100% migration to gateway pattern

**Human Checkpoint:** ✋ Pause for manual testing and feedback

### Milestone 3: Implement Sprite Storage

**Goal:** Implement Hypercore/RocksDB storage in Sprites

**Implementation:**

- Create Sprite image/Dockerfile
  - Base image with Node.js/Bun
  - Install `hypercore-storage`, `corestore`, `hyperbee`
  - Copy sync server code (Sprite version)
- Create `libs/maia-sync/src/sprite-sync-server.js`
  - Similar to current sync server, but runs in Sprite
  - Initialize Corestore with `hypercore-storage` (RocksDB)
  - Storage path: `/data/hypercore-storage` (Sprite's persistent filesystem)
  - Single group per Sprite (no routing needed)
- Update Sprite startup script
  - Extract `groupID` from Sprite name
  - Initialize LocalNode for that group
  - Set up Hyperbee storage backend
  - Start WebSocket server

**Key Implementation:**

```javascript
// libs/maia-sync/src/sprite-sync-server.js
import { LocalNode } from 'cojson';
import { WasmCrypto } from 'cojson/crypto/WasmCrypto';
import Corestore from 'corestore';
import Storage from 'hypercore-storage';
import Hyperbee from 'hyperbee';

export async function createSpriteSyncServer(groupID) {
  // Initialize RocksDB storage
  const storage = new Storage('/data/hypercore-storage');
  const store = new Corestore(storage);
  
  // Initialize crypto
  const crypto = await WasmCrypto.create();
  const agentSecret = crypto.newRandomAgentSecret();
  const agentID = crypto.getAgentID(agentSecret);
  const sessionID = crypto.newRandomSessionID(agentID);
  
  // Create LocalNode
  const localNode = new LocalNode(agentSecret, sessionID, crypto);
  
  // Set up Hyperbee storage backend
  const metadataBee = await store.createHyperbee('metadata');
  const storageBackend = new HyperbeeStorage(store, metadataBee);
  localNode.setStorage(storageBackend);
  
  // Enable garbage collector
  localNode.enableGarbageCollector();
  
  console.log(`[sprite-sync] Group ${groupID} ready`);
  
  return {
    // WebSocket handler for this Sprite
    async open(ws) {
      // Handle WebSocket connection
      const peer = createWebSocketPeer(ws);
      localNode.sync.addPeer(peer);
    }
  };
}
```

**Storage Backend:**

- **RocksDB via hypercore-storage**: Better performance than default disk storage
- **Sprite's filesystem**: Backed by object storage (durable, scalable)
- **Per-Sprite isolation**: Each Sprite has its own RocksDB instance

**Cleanup & Migration:**

- Remove shared storage logic from gateway
- Verify each Sprite has isolated storage
- Test storage persistence across Sprite restarts

**Human Checkpoint:** ✋ Pause for manual testing and feedback

### Milestone 4: Implement Sprite Lifecycle

**Goal:** Auto-create, scale-to-zero, wake-on-demand Sprites

**Implementation:**

- Implement Sprite creation logic
  - Create Sprite when group first accessed
  - Use deterministic naming: `group-${groupID}`
  - Configure Sprite with 100GB storage
  - Set auto-sleep timeout (30s inactivity)
- Implement Sprite wake logic
  - Detect when Sprite is sleeping
  - Wake Sprite via Fly.io API
  - Wait for Sprite to be ready
  - Forward request to Sprite
- Implement Sprite health checks
  - Monitor Sprite state (running/sleeping)
  - Handle Sprite failures (recreate if needed)
  - Cache Sprite URLs for performance

**Key Implementation:**

```javascript
// libs/maia-sync/src/sprite-lifecycle.js
export class SpriteLifecycle {
  async ensureSpriteExists(groupID) {
    const spriteName = `group-${groupID}`;
    
    try {
      let sprite = await this.flyAPI.getSprite(spriteName);
      
      if (!sprite) {
        // Create new Sprite
        sprite = await this.flyAPI.createSprite({
          name: spriteName,
          image: 'maia-sync-sprite:latest',
          storage: { size: '100GB' },
          env: { GROUP_ID: groupID },
          autoSleep: { timeout: 30000 } // 30s inactivity
        });
      }
      
      return sprite;
    } catch (error) {
      throw new Error(`Failed to ensure Sprite exists: ${error.message}`);
    }
  }

  async wakeSpriteIfNeeded(spriteName) {
    const sprite = await this.flyAPI.getSprite(spriteName);
    
    if (sprite.state === 'sleeping') {
      await this.flyAPI.wakeSprite(spriteName);
      await this.waitForSpriteReady(spriteName);
    }
    
    return sprite;
  }

  async waitForSpriteReady(spriteName, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const sprite = await this.flyAPI.getSprite(spriteName);
      if (sprite.state === 'running') {
        // Additional check: is WebSocket server ready?
        const health = await this.checkSpriteHealth(spriteName);
        if (health === 'ready') return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Sprite ${spriteName} did not become ready in time`);
  }
}
```

**Scale-to-Zero Benefits:**

- **Cost-effective**: Only pay for active Sprites
- **Automatic**: Sprites sleep after inactivity, wake on-demand
- **Fast**: Sprite wake time < 1 second (Fly.io Sprites)
- **Unlimited scale**: Each group gets its own Sprite (no shared bottlenecks)

**Cleanup & Migration:**

- Remove manual Sprite management
- Verify auto-sleep/wake works correctly
- Test Sprite creation on first access

**Human Checkpoint:** ✋ Pause for manual testing and feedback

### Milestone 5: Testing & Documentation

**Goal:** Verify Sprite architecture works correctly

**Testing:**

- Test Sprite routing
  - Create group, verify Sprite created
  - Access group, verify routes to correct Sprite
  - Multiple groups, verify isolation
- Test Sprite persistence
  - Write data to Sprite
  - Restart Sprite, verify data persists
  - Verify RocksDB storage works on Sprite filesystem
- Test scale-to-zero
  - Access group, verify Sprite wakes
  - Wait for inactivity, verify Sprite sleeps
  - Access again, verify Sprite wakes quickly
- Test WebSocket sync
  - Browser connects to sync server
  - Sync server routes to Sprite
  - Sprite handles sync correctly
  - Data persists in Sprite storage

**Documentation:**

- Update developer docs (`libs/maia-docs/03_developers/`)
  - Document Sprite architecture
  - Document routing logic
  - Document Sprite lifecycle
  - Document storage model (object storage + RocksDB)
- Update sync server README
  - Document gateway pattern
  - Document Sprite creation/wake logic
  - Document Fly.io setup
- ❌ Skip `libs/maia-docs/agents/LLM_*.md` (auto-generated)

**Human Checkpoint:** ✋ Final approval before shipping

## File Structure

**New Files:**

- `libs/maia-sync/src/sprite-gateway.js` - Sprite routing/gateway logic
- `libs/maia-sync/src/sprite-lifecycle.js` - Sprite creation/wake lifecycle
- `libs/maia-sync/src/sprite-sync-server.js` - Sync server running in Sprite
- `libs/maia-sync/Dockerfile.sprite` - Sprite container image
- `libs/maia-sync/fly.toml.sprite` - Fly.io Sprite configuration

**Modified Files:**

- `libs/maia-sync/src/sync-server.js` - Transform to stateless gateway
- `libs/maia-sync/package.json` - Add Fly.io API client, hypercore-storage

**Files NOT Modified:**

- ❌ Browser storage (IndexedDB) - stays in cojson universe
- ❌ Browser sync (WebSocket) - stays in cojson protocol
- ❌ All browser client code - no changes needed

## Architecture Comparison

### First Implementation (Current Plan)

```
Sync Server
├─ Storage: Hyperbee/Corestore (all groups)
├─ Single storage directory
└─ Single point of storage
```

**Pros:**
- Simple to implement
- Single server to manage
- Good for testing/development

**Cons:**
- Cannot scale horizontally
- Single point of failure
- All groups share storage

### Second Implementation (Sprite Architecture)

```
Sync Server (Gateway)
└─ Routes to → Sprites (one per group)
    └─ Each Sprite: Isolated storage
```

**Pros:**
- Unlimited horizontal scaling
- Per-group isolation
- Scale-to-zero (cost-effective)
- No single point of failure

**Cons:**
- More complex architecture
- Requires Fly.io infrastructure
- Sprite wake latency (< 1s)

## Storage Architecture Details

### Sprite Storage Stack

**Based on Fly.io Sprites implementation:**

1. **Object Storage (Root)**
   - S3-compatible object storage
   - Durable, scalable, trustworthy
   - Data chunks stored here

2. **JuiceFS Model**
   - **Data chunks** → Object storage (immutable)
   - **Metadata** → SQLite + Litestream (fast, durable)
   - **NVMe cache** → Read-through cache (performance)

3. **Hypercore/RocksDB on Sprite Filesystem**
   - RocksDB (`hypercore-storage`) uses Sprite's filesystem
   - Filesystem backed by object storage (durable)
   - **Perfect fit**: RocksDB needs filesystem, Sprites provide durable one

**Storage Flow:**

```
Hypercore/RocksDB
    ↓
Sprite Filesystem (/data/hypercore-storage)
    ↓
JuiceFS (chunks + metadata)
    ↓
Object Storage (S3) + NVMe Cache
```

### Why This Works

1. **RocksDB Compatibility:**
   - RocksDB needs a filesystem (POSIX-compatible)
   - Sprite provides a full Linux filesystem
   - Filesystem backed by object storage (durable)
   - ✅ RocksDB works perfectly on Sprite filesystem

2. **Durability:**
   - Sprite's filesystem is backed by object storage
   - Data chunks are immutable and durable
   - Metadata is replicated via Litestream
   - ✅ Data persists even if Sprite is destroyed/recreated

3. **Performance:**
   - NVMe cache for read-through performance
   - RocksDB optimized for random access
   - ✅ Fast reads/writes despite object storage backend

## Manual Testing Strategy

- **Gateway Testing**: 
  - Send WebSocket message, verify routes to correct Sprite
  - Create new group, verify Sprite created automatically
  - Access sleeping Sprite, verify wakes on-demand
- **Sprite Testing**: 
  - Write data to Sprite, restart Sprite, verify data persists
  - Verify RocksDB storage works on Sprite filesystem
  - Test multiple groups, verify isolation
- **Scale-to-Zero Testing**: 
  - Access group, verify Sprite wakes
  - Wait for inactivity, verify Sprite sleeps
  - Access again, verify Sprite wakes quickly (< 1s)

## Risks & Mitigation

**Risk 1: Sprite wake latency**

- **Mitigation**: Sprite wake time < 1s (Fly.io Sprites), acceptable for sync use case

**Risk 2: Sprite creation cost**

- **Mitigation**: Sprites only created on-demand, scale-to-zero reduces costs

**Risk 3: Object storage performance**

- **Mitigation**: NVMe cache + RocksDB optimize for performance, acceptable for sync use case

**Risk 4: Sprite failure recovery**

- **Mitigation**: Sprites backed by object storage, can recreate Sprite with same data

## Key Insights Summary

1. **Sprite Storage Model:**
   - Object storage root (S3-compatible)
   - JuiceFS model (chunks + metadata)
   - NVMe cache for performance
   - ✅ RocksDB works perfectly on Sprite filesystem

2. **Gateway Pattern:**
   - Sync server = stateless gateway/router
   - Routes requests to group-specific Sprites
   - No persistence in gateway (all in Sprites)

3. **Per-Group Isolation:**
   - One Sprite per group/user
   - Complete data isolation
   - Independent scaling

4. **Scale-to-Zero:**
   - Sprites auto-sleep when inactive
   - Wake on-demand (< 1s)
   - Cost-effective (only pay for active Sprites)

5. **Unlimited Scaling:**
   - Each group gets its own Sprite
   - No shared bottlenecks
   - Horizontal scaling to infinity

## Evolution Path

**Phase 1: First Implementation** (Current Plan)
- ✅ Server-side Hypercore persistence in sync service
- ✅ Single server, single storage directory
- ✅ Good for testing and initial deployment

**Phase 2: Sprite Architecture** (This Plan)
- 🔄 Transform sync server to gateway
- 🔄 One Sprite per group/user
- 🔄 Unlimited horizontal scaling
- 🔄 Scale-to-zero for cost efficiency

**Migration Strategy:**
- First implementation must be complete
- Test Sprite architecture alongside first implementation
- Gradually migrate groups to Sprites
- Eventually deprecate single-server storage
