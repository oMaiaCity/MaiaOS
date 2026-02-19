# Milestone 7: Governance and Competition (21 Players)

## Goal
Introduce collective governance. Players vote on Spark decisions. Competition between Sparks in same domain. Leaderboards show top performers. Path to Phase 2 selection becomes visible.

## User Story
21 players operate a diverse economy. Multiple housing Sparks compete for residents. Energy Sparks compete for customers. Players vote on Spark proposals (capital allocation, partnerships, improvements). Top performers ranked visibly. Players understand who's likely selected for Phase 2.

## Technical Requirements

### 1. Spark Governance
- **Proposal system:**
  - Any Spark owner can submit proposal
  - Types: Capital investment, partnership, policy change, distribution change
  - Proposal shows: Description, impact, voting deadline
- **Voting mechanism:**
  - Weight by SparkMind holdings (ownership %)
  - Simple: Yes/No/Abstain
  - Quorum required (50% of owners must vote)
  - Result executes automatically if passed
- **Governance dashboard:**
  - Active proposals for Sparks you own
  - Voting history
  - Execution results

### 2. Competitive Sparks
- **Multiple Sparks per domain:**
  - 3 different housing Sparks competing
  - 2 energy Sparks
  - 2 food Sparks
- **Competition metrics:**
  - Market share (% of domain consumption)
  - User count (how many citizens consuming)
  - Revenue per owner
  - Growth rate
- **Quality differentiation:**
  - Some Sparks offer better service (cost more)
  - Some optimize for price (lower margins)
  - Players choose based on preference

### 3. Performance Leaderboards
- **Spark rankings:**
  - Top 10 Sparks by revenue
  - Top 10 by owner earnings
  - Top 10 by user count
  - Fastest growing Sparks
- **Player rankings:**
  - Top earners (most revenue from ownership)
  - Top founders (most successful Sparks created)
  - Most diversified portfolios
  - Community reputation
- **Phase 2 indicator:**
  - "Top 100 Sparks" section (showing current leaders)
  - "Top 1,000 Contributors" section (showing likely Valley selections)
  - Updates in real-time

### 4. Spark Competition Mechanics
- **Players can switch consumption:**
  - Currently consuming from SolarSpark A
  - Switch to SolarSpark B (better price or quality)
  - Revenue shifts between competing Sparks
  - Market share changes dynamically
- **Founder response:**
  - See customers leaving
  - Adjust pricing or improve service
  - Governance votes on strategy changes

### 5. Community Features
- **Spark forums:**
  - Discussion per Spark (for owners)
  - Propose ideas, discuss strategy
  - Build community around Sparks
- **Citizen directory:**
  - See all 21 players
  - View their portfolios (public)
  - See which Sparks they founded
  - Basic profiles

### 6. Revenue Optimization Tools
- **Portfolio analyzer:**
  - Shows: Which Sparks earning most
  - Suggests: Rebalance recommendations
  - Compares: Your returns vs. average player
- **Spark comparison:**
  - Side-by-side metrics of competing Sparks
  - Help players choose best investments

## Success Criteria
- 21 players actively voting on proposals
- Multiple Sparks per domain competing
- Players switching between providers
- Leaderboards showing clear rankings
- Top performers recognized
- Governance participation high
- Players understand Phase 2 path

## What We Learn
- Do players participate in governance?
- Does competition improve Spark quality?
- Do leaderboards drive engagement?
- Are players strategic about Phase 2 selection?
- Which governance models work best?

## Out of Scope
- Complex governance (just simple proposals)
- Spark-to-Spark transactions
- Advanced analytics
- Social features beyond basics
- AI agent visibility (they operate behind scenes)

## Technical Challenges
- Governance execution logic
- Weighted voting calculations
- Real-time leaderboard updates
- Performance at scale (21 players, 10+ Sparks)
- Managing competition fairly

## Database Schema Additions
```
proposals:
  - spark_id
  - proposer_id
  - type
  - description
  - voting_deadline
  - yes_votes
  - no_votes
  - status (active, passed, rejected)

votes:
  - proposal_id
  - user_id
  - vote (yes/no/abstain)
  - weight (based on holdings)
  - timestamp

spark_metrics:
  - spark_id
  - daily_revenue
  - user_count
  - market_share
  - growth_rate
  - calculated_at
```

---

**Outcome:** Full governance operational. Competition drives quality. Top performers emerge. Path to Phase 2 visible. Players understand who's likely to become Valley founders.
