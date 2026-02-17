# Milestone 1: The Beginning (1 Player)

## Vision
Alice enters a minimal 3D world with nothing but a tent. She experiences the transformation from having nothing to owning and earning—the core magic of MaiaCity distilled to its essence.

## Core Experience

### The 3D World
A simple, beautiful 3D environment rendered with ThreeJS. Fullscreen, navigable, alive. This is the backdrop for everything.

**Starting scene:**
- Infinite plane (ground texture: grass or earth)
- One tent (GLTF asset) in the center
- Sky gradient (day/night cycle optional but beautiful)
- Ambient sound (wind, nature)
- Alice's camera positioned near the tent

**Navigation:**
- WASD or arrow keys to move
- Mouse to look around
- Smooth, responsive controls
- Simple character controller (first-person or third-person)

**The tent:**
- Alice's home base
- Simple GLTF model
- Glows slightly when nearby
- Clicking/entering opens the economy interface

This 3D world is always present. Always the background. The city will grow here as more players join.

### The UI Layer: Liquid Glass Overlay

All interface elements float above the 3D world as glassmorphic overlays. Think Apple Vision Pro aesthetic—translucent, blurred backgrounds, subtle borders, depth.

**Design principles:**
- Translucent backgrounds (20% opacity)
- Backdrop blur (gaussian)
- Subtle borders (1px, white/20%)
- Rounded corners (16px)
- Floating shadows
- Smooth animations
- Minimal, spacious layouts

**No traditional UI chrome.** No navigation bars, no sidebars. Just floating cards that appear when needed, disappear when not.

## The Journey: Step by Step

### Step 1: Passkey Signup

Alice arrives at the game. A single glassmorphic card floats center screen over the 3D world:

**Signup card:**
- Title: "Welcome to MaiaCity"
- Subtitle: "Create your citizen identity"
- Input: Choose your name (e.g., "Alice")
- Button: "Create Passkey"
- No email, no password, just WebAuthn

**Technical:**
- WebAuthn/passkey registration
- Store credential + user identity
- Generate unique user ID
- Create account in database

**After signup:**
- Card fades out
- Camera begins moving toward the tent
- Fade to black
- Fade in: Alice standing near her tent
- New card appears: "Welcome, Alice"

### Step 2: Receive Your Hearts

A new card appears floating above the tent:

**Hearts card:**
- "You've received 125,000 AliceHearts"
- Visual: Number counting up from 0 to 125,000 (2-second animation)
- Explanation: "Your investment power. You can only invest them, not sell them."
- Button: "Continue"

**Visual feedback:**
- Particles or light emanating from tent during count-up
- Sound effect (positive, magical)
- Feels like receiving a gift

### Step 3: The Mandatory Investment

The Hearts card transitions to investment card:

**Investment card:**
- "First, invest in the city itself"
- "Invest 50,000 AliceHearts into MaiaSpark"
- Visual: Shows split animation
  - 50,000 Hearts → 25,000 to you, 25,000 to city
  - Particle effect showing split
- Explanation: "You'll own part of everything and earn from city operations"
- Button: "Invest"

**On click:**
- Dramatic animation
  - Hearts swirl from card into the ground
  - Ground glows
  - 25,000 MaiaMinds rise up toward camera
  - Counter displays new balance
- Sound: Deep, resonant, satisfying
- Duration: 3-4 seconds (make it feel important)

**Result card appears:**
- "You now own MaiaSpark"
- "Ownership: 100% (you're the first citizen)"
- "MaiaMind balance: 25,000"
- "Hearts remaining: 75,000"
- Button: "Continue"

### Step 4: Revenue Begins

The result card transitions to revenue card:

**Revenue streaming card:**
- "Your city is operating"
- Large counter: "25,000 MaiaMinds"
- Below counter: "+0.00116 MaiaMinds/second" (ticking visibly)
- Daily rate: "+100 MaiaMinds/day"
- Explanation: "You're earning continuously from city operations"
- Visual: Small particles flowing from ground to counter (representing revenue stream)

**The magic moment:**
Alice watches the counter tick up. 25,000.001... 25,000.002... 25,000.003...

She's not doing anything. She's just earning. The numbers go up by themselves.

**This is the core magic: Ownership generates wealth passively.**

### Step 5: The Dashboard

After 30 seconds watching revenue stream, a new button appears: "View Dashboard"

**Dashboard card (glassmorphic, floating):**

**Top section: Your Wealth**
- Hearts: 75,000 (available to invest)
- MaiaMinds: 25,000.023 (ticking up continuously)

**Middle section: Your Ownership**
- MaiaSpark: 25,000 MaiaMinds (100% ownership)
- Revenue rate: +100 MaiaMinds/day

**Bottom section: Quick Actions**
- Button: "Invest More Hearts" (greyed out - no other Sparks yet)
- Button: "Close" (return to 3D world)

**Persistent HUD elements (minimal):**
- Top right corner: MaiaMind counter (always visible, ticking)
- Top left corner: Hearts balance
- Bottom right: Menu icon (opens dashboard)

**The 3D world remains:**
When dashboard card appears, the 3D world continues behind it (slightly dimmed or blurred). Alice can still see her tent, the world, everything. The UI is a layer on top, not a replacement.

## Technical Specification

### 1. ThreeJS 3D World
- **Scene setup:**
  - PerspectiveCamera (FOV: 75)
  - Renderer (WebGL, antialiasing)
  - Basic lighting (ambient + directional)
  - Ground plane (infinite or very large)
  - Sky (gradient or solid color)
  
- **GLTF tent asset:**
  - Load using GLTFLoader
  - Position at origin (0, 0, 0)
  - Scale appropriately
  - Add simple click/interact detection
  
- **Camera controls:**
  - FirstPersonControls or PointerLockControls
  - WASD movement
  - Mouse look
  - Collision detection (simple, with ground)
  
- **Performance:**
  - Target 60fps
  - Minimal draw calls (one tent, one ground)
  - Simple shaders

### 2. Glassmorphic UI System
- **CSS properties:**
  ```css
  .glass-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }
  ```

- **Component library:**
  - GlassCard (container)
  - GlassButton
  - GlassInput
  - GlassCounter (for ticking numbers)
  
- **Layout:**
  - Svelte components overlay ThreeJS canvas
  - Position: fixed/absolute over canvas
  - z-index layering
  - Pointer events managed

### 3. State Management
- **User state:**
  ```typescript
  {
    id: string,
    name: "Alice",
    hearts: 75000,
    holdings: {
      MaiaMinds: 25000.023
    },
    created_at: timestamp
  }
  ```

- **MaiaSpark state:**
  ```typescript
  {
    id: "MaiaSpark",
    treasury: 25000,
    total_citizen_holdings: 25000,
    revenue_rate: 100 // per day
  }
  ```

- **Real-time updates:**
  - setInterval calculating revenue
  - Update state every 100ms
  - Smooth counter animation
  - Persist to localStorage (no backend yet for 1 player)

### 4. Revenue Streaming Calculation
```typescript
const REVENUE_PER_DAY = 100;
const REVENUE_PER_SECOND = REVENUE_PER_DAY / 86400;
const REVENUE_PER_TICK = REVENUE_PER_SECOND * 0.1; // 100ms ticks

// Every 100ms:
user.holdings.MaiaMinds += REVENUE_PER_TICK;
```

### 5. Animation Sequences
- **Investment animation:**
  - Hearts particle system (ThreeJS points)
  - Swirl effect from UI card into ground
  - Ground pulse/glow
  - MaiaMinds particles rise up
  - Duration: 3-4 seconds
  
- **Counter animation:**
  - Smooth number interpolation
  - No jumps, continuous flow
  - Decimal precision (6 places)
  - Color pulse on increment

### 6. User Flow Architecture
```
[Enter game]
    ↓
[3D world loads → Tent appears]
    ↓
[Glassmorphic signup card overlays]
    ↓
[Passkey creation]
    ↓
[Hearts received card (125,000)]
    ↓
[Investment card (50,000 → MaiaSpark)]
    ↓
[Investment animation (3-4 seconds)]
    ↓
[Revenue streaming card (counter ticking)]
    ↓
[Dashboard available (menu button appears)]
    ↓
[Free exploration (3D world + persistent HUD)]
```

## Visual Design Details

### Color Palette
- **Primary:** Soft blues and whites (trust, clarity)
- **Accents:** Warm gold (value, wealth)
- **Background:** Dark blues or greys (depth)
- **Text:** White or light grey (readability over blur)

### Typography
- **Headers:** 24-32px, medium weight
- **Body:** 16-18px, regular weight
- **Numbers:** Monospace font, 20-24px
- **Counters:** Large (32-48px), bold

### Spacing
- Generous padding (24-32px in cards)
- Clear visual hierarchy
- Breathing room between elements
- Not cramped

### Cards
- **Max width:** 480px (readable, not wide)
- **Center aligned** when appearing
- **Fade in/out:** 300ms transitions
- **Stack:** Multiple cards can overlay (z-index management)

## The Tent Detail

The tent is your home base in the 3D world. It represents your stake in the city.

**Visual evolution potential (future milestones):**
- Milestone 1: Simple tent
- Milestone 2-3: Tent gets flag/detail as you invest more
- Milestone 4-5: Tent becomes small structure
- Eventually: Full building/house representing your wealth

For now: **Just a simple, beautiful tent.** One GLTF asset. But it's yours, and it's where your journey begins.

## Success Criteria

**Technical:**
- 3D world renders smoothly (60fps)
- GLTF tent loads and displays
- Navigation feels responsive
- Passkey auth completes in <30 seconds
- Investment animation is satisfying (3-4 sec)
- Counter ticks visibly, continuously
- Glassmorphic UI is beautiful and readable
- No performance issues

**Emotional:**
- Alice feels immersed in the world
- The tent feels like hers
- The investment moment feels significant
- Watching earnings tick up feels magical
- She understands: "I own something now, and it's making me money"
- She wants to keep playing

## Technical Stack

**Frontend:**
- SvelteKit (routing, components)
- ThreeJS (3D rendering)
- CSS (glassmorphic styling)
- WebAuthn (passkey)

**State:**
- LocalStorage (no backend for 1 player)
- Svelte stores (reactive state)

**Assets:**
- 1 GLTF tent model
- Ground texture
- Particle systems (for effects)

## What We Learn

**Does it feel magical?**
- Is the 3D world immersive?
- Does the tent create emotional connection?
- Is the investment moment satisfying?
- Does watching earnings feel rewarding?

**Is it clear?**
- Does Alice understand what happened?
- Is the Hearts → MaiaMinds transformation clear?
- Does she grasp that she owns something earning money?

**Do they want more?**
- Does Alice want to invest remaining 75,000 Hearts?
- Does she want to explore more of the world?
- Does she return the next day to check earnings?

## Out of Scope

- Multiple players (comes in Milestone 2)
- Custom Sparks (comes in Milestone 3)
- Complex 3D assets
- Property/buildings
- Trading
- Governance
- Any feature beyond core loop

## The Foundation

This milestone establishes:
- The 3D world foundation (scales to full city)
- The glassmorphic UI system (used for all future interfaces)
- The core loop (invest → own → earn)
- The emotional hook (ownership feels good)
- The technical architecture (ThreeJS + Svelte)

Everything that follows builds on this foundation. Get this right, and the rest flows naturally.

---

**Outcome:** One player experiences the magic of ownership in a beautiful 3D world with seamless glass UI overlays. The foundation is perfect.
