# Milestone 5: SparkMind Exchange (8 Players)

## Goal
Enable trading between different SparkMind types. Players can exchange MaiaMinds for SolarMinds, or any combination. Introduces basic AMM (Automated Market Maker) for liquidity and price discovery.

## User Story
Alice needs SolarMinds to pay for electricity but only has MaiaMinds. She uses a liquidity pool to exchange. Bob provides liquidity and earns trading fees. Markets find prices based on supply and demand.

## Technical Requirements

### 1. Simple AMM Implementation
- **Constant product formula: x × y = k**
- One pool to start: MaiaMinds ↔ SolarMinds
- Initial liquidity seeded by system or early player
- **Trade interface:**
  - Select: "I have MaiaMinds, I want SolarMinds"
  - Input: Amount to trade
  - Preview: "You'll receive ~X SolarMinds"
  - Show: Price and slippage
  - Confirm trade

### 2. Liquidity Provision (Optional)
- **"Add Liquidity" button:**
  - Deposit equal value of both assets
  - Receive LP (Liquidity Provider) tokens
  - Earn 0.3% fee on all trades
- **Simple LP rewards:**
  - Track fees accumulated
  - Distribute proportionally to LP token holders
  - Withdraw liquidity + earned fees anytime

### 3. Price Discovery
- **Market price displays:**
  - Current ratio: "1 MaiaMind = 1.2 SolarMinds"
  - Updated after each trade
  - Price history chart (simple line graph)
- **Arbitrage opportunities:**
  - If consumption drives SolarMind demand up
  - Price rises → Signal to invest more in SolarSpark
  - Market reflects Spark performance

### 4. Need-Based Trading
- **When player runs low on specific SparkMind:**
  - Warning: "SolarMind balance low, consumption paused"
  - Suggestion: "Trade MaiaMinds for SolarMinds"
  - One-click shortcut to exchange
- Creates natural trading flow from consumption needs

### 5. Market Dashboard
- **New section: Markets**
  - Available pools (MaiaMinds ↔ SolarMinds initially)
  - Each pool shows: Liquidity depth, 24h volume, current price
  - Trade button launches modal
- **Your LP positions:**
  - Pools you've provided liquidity to
  - Your share %
  - Fees earned

### 6. Trading History
- Log all trades
- Show: Amount in, amount out, price, timestamp
- Personal trading history per player
- Learn from past trades

## Success Criteria
- Players can exchange SparkMinds successfully
- AMM pricing works correctly (constant product maintained)
- Slippage calculation accurate
- LP providers earn fees
- Players acquire needed SparkMinds when running low
- Price reflects relative Spark values

## What We Learn
- Do players naturally trade when needed?
- Does AMM pricing feel fair?
- Do players provide liquidity for fees?
- Which SparkMinds are most valuable (price signals)?
- Does trading increase engagement?

## Out of Scope
- Multiple pools (just one to start)
- Complex routing (multi-hop trades)
- Property/housing
- Governance
- Advanced trading strategies

## Technical Challenges
- Atomic transactions (trade must be all-or-nothing)
- Race conditions in AMM (multiple simultaneous trades)
- Accurate slippage calculation
- LP reward distribution logic
- Price calculation efficiency

## Database Schema Additions
```
liquidity_pools:
  - spark_a_id
  - spark_b_id
  - reserve_a
  - reserve_b
  - constant_k
  - lp_token_supply

lp_positions:
  - user_id
  - pool_id
  - lp_tokens
  - fees_earned

trades:
  - user_id
  - pool_id
  - input_spark_id
  - input_amount
  - output_spark_id
  - output_amount
  - price
  - timestamp
```

---

**Outcome:** Players can trade between SparkMinds. Market pricing emerges. Liquidity provision creates new revenue stream. Economy becomes liquid.
