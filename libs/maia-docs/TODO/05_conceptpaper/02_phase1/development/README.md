# Development Milestones: Fibonacci Rollout

## Strategy

Build the game iteratively following **Fibonacci sequence** for player counts. Each milestone unlocks when that many active players are reached. This ensures we build only what's needed, validate each layer, and scale complexity gradually.

**Business model:** One-time 89€ purchase per player.

## Milestone Sequence

### Milestone 0: Waitlist (Pre-Launch)
**Foundation:** Identity, community, notifications, payment

**Build:**
- Minimal landing page (maia.city)
- Passkey authentication (WebAuthn)
- Privacy policy & consent
- Web push notifications (daily updates + invite)
- **1€ waitlist fee (Stripe)**
- **Urgency messaging** (position, people ahead)
- Jazz local-first architecture
- Invite-only system
- Production deployment

**User flow:**
1. Join waitlist → Create passkey
2. Subscribe to push notifications
3. **Choose agent twin username** (@alice)
4. **Pay 1€ to reserve spot + username** (urgency: "246 ahead of you")
5. Receive daily progress updates
6. Get invited → @alice activated → Enter Milestone 1

**Validates:** 
- Does invite-only create desire?
- **Does 1€ fee validate real interest?**
- **Does username reservation add perceived value?**
- **Does urgency increase conversion?**
- Do passkeys work across devices?
- Do notifications maintain engagement?

---

### Milestone 1: Single Player (1 player)
**Core Loop:** Invest → Own → Earn

**Build:**
- ThreeJS 3D world (tent on infinite plane)
- Glassmorphic UI overlay system
- Mint 125,000 Hearts
- Invest 50,000 in MaiaSpark (mandatory)
- Revenue streaming simulation (counter ticking)
- Investment animation (3-4 seconds, satisfying)

**Validates:** Does the core loop feel rewarding?

---

### Milestone 2: Multiplayer Foundation (2 players)
**Core Addition:** Proportional ownership

**Build:**
- Backend infrastructure
- Shared MaiaSpark state
- Revenue distribution (50/50)
- Multiplayer presence

**Validates:** Does co-ownership work with multiple players?

---

### Milestone 3: First Custom Spark (3 players)
**Core Addition:** Player-created Sparks + Consumption

**Build:**
- Spark creation interface
- Multi-currency system (MaiaMinds, SolarMinds)
- Consumption simulation (electricity usage)
- Revenue from consumption

**Validates:** Can players create Sparks? Does consumption drive revenue?

---

### Milestone 4: Spark Ecosystem (5 players)
**Core Addition:** Multi-domain Sparks

**Build:**
- Any domain Spark creation (energy, food, water, transit)
- Spark marketplace
- Diversified consumption
- Portfolio dashboard

**Validates:** Does ecosystem diversity emerge? Do players diversify?

---

### Milestone 5: SparkMind Exchange (8 players)
**Core Addition:** Trading and liquidity

**Build:**
- AMM (Automated Market Maker)
- MaiaMinds ↔ SolarMinds pool
- Liquidity provision
- Price discovery

**Validates:** Do players trade when needed? Does market pricing work?

---

### Milestone 6: Property and Housing (13 players)
**Core Addition:** Two-layer property market

**Build:**
- Virtual city map (land parcels)
- Land lease auctions (Sparks bid)
- Building construction
- Apartment rentals (open market)

**Validates:** Does two-layer property model work? Do players understand dual earnings?

---

### Milestone 7: Governance and Competition (21 players)
**Core Addition:** Collective decisions + Competition

**Build:**
- Proposal and voting system
- Multiple competing Sparks per domain
- Performance leaderboards
- Phase 2 selection visibility

**Validates:** Do players govern collectively? Does competition improve quality?

---

**After Milestone 7:**
- Core systems fully operational
- Proven at 21-player scale
- Ready to scale to 34, 55, 89, 144... (Fibonacci continues)
- Foundation for 1.3M citizens established

## Technical Architecture Evolution

**Milestone 1:** Local state only  
**Milestone 2:** Add backend + database  
**Milestone 3:** Multi-currency system  
**Milestone 4:** Marketplace infrastructure  
**Milestone 5:** AMM/trading engine  
**Milestone 6:** Spatial map system  
**Milestone 7:** Governance engine  

Each milestone adds one major technical component, keeping complexity manageable.

## Validation at Each Stage

Every milestone answers specific questions:
- M1: Is core loop satisfying?
- M2: Does proportional distribution work?
- M3: Do players create Sparks?
- M4: Does diversity emerge naturally?
- M5: Do markets find prices?
- M6: Does property layer work?
- M7: Does governance scale?

If any answer is "no," we iterate before proceeding.

## What Comes After Milestone 7

**Milestone 8+:** Scale along Fibonacci (34, 55, 89, 144, 233, 377...)

Each adds:
- More Spark types
- More governance complexity
- More economic depth
- Eventually: 1.3M citizens

**The foundation is built in these first 7 milestones.**

Everything after is scaling what we've proven works.
