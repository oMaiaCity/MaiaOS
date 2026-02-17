# Milestone 4: Spark Ecosystem (5 Players)

## Goal
Enable true Spark diversity. Multiple players can found different Sparks in different domains. Introduce basic inter-Spark dependencies and resource flows.

## User Story
5 players create an ecosystem: Alice founds SolarSpark, Bob founds FoodSpark, Charlie founds WaterSpark. Players invest across multiple Sparks. Each Spark generates revenue from consumption. Players earn from diversified portfolios.

## Technical Requirements

### 1. Multi-Spark Creation
- **Any player can found any Spark:**
  - SolarSpark (energy)
  - FoodSpark (agriculture)
  - WaterSpark (water)
  - TransitSpark (transportation)
  - Custom name (player-defined)
- **Founding flow:**
  - Choose domain and name
  - Invest Hearts (min 5,000, max remaining balance)
  - Receive 50% SparkMinds as founder
  - Spark appears in city marketplace

### 2. Spark Marketplace
- **Browse all Sparks:**
  - Grid/list view of all created Sparks
  - Show: Name, domain, founder, total treasury, owners count
  - Performance metrics: Revenue/day, owner count
  - "Invest" button on each
- **Investment from marketplace:**
  - Select Spark
  - Choose Hearts amount
  - Receive SparkMinds (50/50 split)
  - Become co-owner

### 3. Diversified Consumption
- **Simulate consumption across domains:**
  - Electricity: -3 SolarMinds/day per player
  - Food: -5 FoodMinds/day per player
  - Water: -2 WaterMinds/day per player
  - Transit: -4 TransitMinds/day per player
- **Initial distribution:**
  - New players receive small amount of each SparkMind to start consuming
  - Or: Players must acquire via investment first (creates urgency)

### 4. Portfolio Dashboard
- **Multi-Spark holdings:**
  - List all SparkMinds player holds
  - Show: Amount, ownership %, daily revenue
  - Calculate total daily earnings across all
  - Show net position (earnings - consumption)
- **Example display:**
  - MaiaMinds: 31,250 (20% ownership, +40/day)
  - SolarMinds: 8,000 (16% ownership, +9.6/day, -3/day usage = +6.6/day net)
  - FoodMinds: 5,000 (25% ownership, +12.5/day, -5/day usage = +7.5/day net)

### 5. Founder Badges
- Visual indicator for Spark founders
- Founders shown in Spark details
- Reputation/status starts emerging
- Encourages competitive founding

### 6. Basic Analytics
- **Per-Spark metrics:**
  - Total revenue generated (lifetime)
  - Daily revenue rate
  - Number of owners
  - Founder's stake percentage
- **Player metrics:**
  - Total earnings across all Sparks
  - Total consumption across all domains
  - Net daily position
  - Number of Sparks invested in

## Success Criteria
- 5 players can create 3-5 different Sparks
- All players can invest in each other's Sparks
- Consumption works across multiple domains
- Revenue distributes correctly across all Sparks
- Players understand diversified portfolio benefits
- Clear winners/losers emerge (some Sparks outperform)

## What We Learn
- Do players naturally diversify or concentrate?
- Which Spark domains attract most investment?
- Does competitive founding emerge?
- Is multi-Spark portfolio management intuitive?
- Do players understand earning from multiple sources?

## Out of Scope
- Trading SparkMinds between players
- Property/housing
- Spark governance/voting
- Inter-Spark transactions
- Complex Spark configurations

## Technical Challenges
- Managing N different currency types
- Revenue distribution across M Sparks with N owners
- Performance with multiple simultaneous streams
- UI clarity with many balances

## Database Schema Additions
```
sparks:
  - domain (energy, food, water, transit, etc.)
  - metadata (description, icon)
  
consumption_logs:
  - user_id
  - spark_id
  - amount_per_day
  - auto_enabled
```

---

**Outcome:** Ecosystem of Sparks emerges. Players experience diversified ownership. Foundation for complex economy.
