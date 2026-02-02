# Milestone 2: Multiplayer Foundation (2 Players)

## Goal
Introduce proportional ownership. Two players co-own MaiaSpark, and revenue distributes based on their stakes. Prove the circular economy with multiple stakeholders.

## User Story
Alice and Bob both invest in MaiaSpark. Alice owns 50%, Bob owns 50%. When city generates revenue, it splits evenly between them. They see each other's presence and understand shared ownership.

## Technical Requirements

### 1. Backend Infrastructure
- **Add backend** (previously all local)
- Player accounts stored in database
- Shared MaiaSpark state
- Revenue distribution engine
- Real-time sync between clients

### 2. Proportional Ownership Calculation
- **Track total MaiaSpark supply:**
  - Alice invests 50,000 Hearts → Receives 25,000 MaiaMinds
  - Bob invests 50,000 Hearts → Receives 25,000 MaiaMinds
  - Total supply: 50,000 MaiaMinds held by players
  - MaiaSpark treasury: 50,000 MaiaMinds
- **Calculate ownership %:**
  - Alice: 25,000 / 50,000 = 50%
  - Bob: 25,000 / 50,000 = 50%

### 3. Revenue Distribution
- **Simulated city revenue:**
  - MaiaSpark generates 200 MaiaMinds/day (scales with players)
  - Distribute proportionally:
    - Alice receives: 100 MaiaMinds/day (50%)
    - Bob receives: 100 MaiaMinds/day (50%)
- **Real-time streaming:**
  - Each player sees their counter ticking up
  - Both counters move at same rate (equal ownership)

### 4. Multiplayer UI
- **Dashboard additions:**
  - "Total citizens: 2"
  - "Your ownership: 50% of MaiaSpark"
  - "Other owners: 1 (Bob)"
  - Leaderboard: Simple list showing both players' MaiaMind balances
- **Presence indicators:**
  - See when other player is online
  - Simple avatar/name display

### 5. Database Schema
```
users:
  - id (passkey credential)
  - name
  - hearts_balance
  - created_at

spark_holdings:
  - user_id
  - spark_id (MaiaSpark)
  - amount (25,000 MaiaMinds)
  
sparks:
  - id (MaiaSpark)
  - treasury_balance
  - total_supply
```

## Success Criteria
- Two players can join and see each other
- Both invest in MaiaSpark
- Revenue splits exactly 50/50
- Both players understand they co-own the city
- No conflicts or race conditions in distribution

## What We Learn
- Does proportional distribution work correctly?
- Do players feel connected to each other?
- Is shared ownership concept clear?
- Does multiplayer state stay synchronized?

## Out of Scope
- Custom Sparks (only MaiaSpark exists)
- Trading between players
- Property
- More than 2 players (prove it works with 2 first)

## Technical Challenges
- Real-time state sync
- Race conditions in revenue distribution
- Fair calculation of proportions
- Database consistency

---

**Outcome:** Proven that multiple players can co-own and proportionally earn. Foundation for scaling to N players.
