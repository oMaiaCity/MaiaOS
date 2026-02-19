# Milestone 3: First Custom Spark (3 Players)

## Goal
Enable players to create their first custom Spark beyond MaiaSpark. Introduce consumption mechanic where players spend SparkMinds and generate revenue for Spark owners.

## User Story
Alice, Bob, and Charlie all own MaiaSpark. Alice founds SolarSpark (energy cooperative). Bob and Charlie invest in it. Citizens consume simulated electricity and stream SolarMinds as payment. Revenue distributes to SolarSpark owners.

## Technical Requirements

### 1. Spark Creation Interface
- **"Create Spark" button** on dashboard
- Form:
  - Spark name (e.g., "SolarSpark")
  - Domain (energy, food, housing, transit, water, other)
  - Initial investment amount (from remaining Hearts)
- **Transaction:**
  - Burn Hearts from player
  - Mint SparkMinds (50% to founder, 50% to treasury)
  - Create Spark entity in database
  - Display new Spark in city

### 2. Multiple Currency Types
- **Track different SparkMinds:**
  - MaiaMinds (city infrastructure)
  - SolarMinds (energy - new!)
- Each has separate balance
- Each displays separately in UI
- Each has own treasury and holders

### 3. Consumption Simulation
- **Simulated electricity usage:**
  - Each player consumes 5 SolarMinds/day
  - Auto-deduct from player's SolarMind balance
  - Stream to SolarSpark treasury
  - If player has 0 SolarMinds, show "need to acquire SolarMinds"
- **Consumption drives revenue:**
  - 3 players × 5 SolarMinds/day = 15 SolarMinds/day to treasury
  - This becomes revenue to distribute

### 4. Revenue Distribution (Multi-Spark)
- **SolarSpark distribution:**
  - Treasury collects consumption payments
  - Distributes to all SolarMind holders proportionally
  - Example: Alice owns 60%, Bob 30%, Charlie 10%
  - Revenue: 15/day → Alice gets 9, Bob gets 4.5, Charlie gets 1.5
- **MaiaSpark continues distributing independently**

### 5. Spark Investment Interface
- **View all Sparks:**
  - List: MaiaSpark, SolarSpark
  - Show: Name, domain, total treasury, number of owners
  - Click to see details
- **Invest button:**
  - Choose amount of Hearts to invest
  - See preview: "You'll receive X SparkMinds, treasury gets X"
  - Confirm transaction
  - Update balances

### 6. Multi-Currency Dashboard
- **Balances section:**
  - Hearts: 0 (all invested)
  - MaiaMinds: 31,250 (+100/day)
  - SolarMinds: 10,000 (+9/day, -5/day consumption = +4/day net)
- **Revenue streams:**
  - From MaiaSpark: +100 MaiaMinds/day
  - From SolarSpark: +9 SolarMinds/day
- **Consumption:**
  - Electricity: -5 SolarMinds/day

## Success Criteria
- Alice can create SolarSpark successfully
- Bob and Charlie can invest in it
- Consumption mechanic works (auto-deduct)
- Revenue distributes correctly to all owners
- Multiple currency balances display clearly
- Players understand they're earning from consumption

## What We Learn
- Can players create custom Sparks?
- Does consumption → revenue pattern make sense?
- Is multi-currency UI confusing?
- Do players invest in each other's Sparks?

## Out of Scope
- Trading SparkMinds between players
- Property/housing
- More than one custom Spark type
- Complex governance

## Database Schema Additions
```
sparks:
  - id
  - name
  - domain
  - founder_id
  - treasury_balance
  - total_supply
  - created_at

consumption_events:
  - user_id
  - spark_id
  - amount
  - timestamp
```

---

**Outcome:** Players can create and invest in custom Sparks. Consumption drives revenue. Multi-currency system established.
