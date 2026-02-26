# Milestone 6: Property and Housing (13 Players)

## Goal
Introduce property layer. Sparks can lease land from MaiaSpark and build housing. Players rent apartments, streaming payments to housing Sparks. Two-layer market (land + buildings) established.

## User Story
Alice founds HousingSpark. She bids for land lease from MaiaSpark, wins, and builds 10 virtual apartments. Players browse apartments, choose one, and stream HousingMinds as rent. Alice earns as HousingSpark majority owner. All players earn from land lease as MaiaMind holders.

## Technical Requirements

### 1. Land Parcel System
- **Virtual city map:**
  - Grid of land parcels (10×10 = 100 parcels to start)
  - Each parcel has: Location (downtown, suburbs, etc.), size, status (empty/leased)
- **Visual map:**
  - Simple grid visualization
  - Color-coded: Empty (grey), Leased (colored by Spark)
  - Click parcel to see details

### 2. Land Lease Auction (Sparks Only)
- **Sparks bid for land:**
  - Only Spark founders can bid (not individual players)
  - Continuous auction: Current lessee can be outbid anytime
  - Minimum bid increment: 10%
- **Bidding flow:**
  - Alice (HousingSpark founder) selects empty parcel
  - Bids 1,000 MaiaMinds/month
  - If highest bid, lease granted
  - Continuous streaming from Spark treasury → MaiaSpark
- **Land lease revenue:**
  - Flows to MaiaSpark treasury
  - Distributes to all MaiaMind holders

### 3. Building Construction
- **After winning land lease:**
  - Founder chooses building type: Apartments (housing), Offices (commercial)
  - Specify: Number of units (1-20 per parcel)
  - Construction cost: One-time from Spark treasury
  - Instant build (no waiting)
- **Building appears on map:**
  - Parcel shows building visual
  - Units available for rent

### 4. Apartment Rental (Open Market)
- **Browse apartments:**
  - Filter by: Price, size, location
  - See: Building image, HousingSpark name, monthly cost
  - Preview: "Costs 100 HousingMinds/month"
- **Rent flow:**
  - Player clicks "Rent this apartment"
  - Auto-streams HousingMinds from player → HousingSpark
  - Player's avatar appears in building
  - Can switch apartments anytime (stop one stream, start another)

### 5. HousingSpark Creation
- **New Spark domain: Housing**
- Players can found housing cooperatives
- HousingMinds minted when players invest
- Revenue from rental streams
- Distributed to HousingMind holders

### 6. Two-Layer Revenue Display
- **Layer 1 (Land owner - MaiaMind holders):**
  - "Land lease revenue: +30 MaiaMinds/day"
  - "Infrastructure fees: +20 MaiaMinds/day"
  - Total Layer 1: +50 MaiaMinds/day
- **Layer 2 (Building owner - HousingMind holders if invested):**
  - "Rental revenue: +150 HousingMinds/day"
  - "Net after costs: +80 HousingMinds/day"
- **Your position:**
  - You earn from Layer 1 (mandatory MaiaMind holding)
  - You earn from Layer 2 (if you invested in HousingSpark)

## Success Criteria
- Players can found housing Sparks
- Sparks can bid for land successfully
- Buildings appear on map visually
- Players can rent apartments
- Rent streams to housing Sparks correctly
- Two-layer revenue flows work
- Players understand they earn from both layers

## What We Learn
- Do players found housing Sparks?
- Does land auction create competition?
- Do players understand two-layer model?
- Does visual map help comprehension?
- Is rental market working?

## Out of Scope
- Complex property types
- Property improvements
- Inter-Spark transactions
- Governance over property
- Multiple buildings per Spark

## Database Schema Additions
```
land_parcels:
  - id
  - location_x
  - location_y
  - current_lessee_spark_id
  - lease_price_per_month
  - lease_started_at

buildings:
  - parcel_id
  - spark_id (owner)
  - building_type (residential, commercial)
  - units (array of apartments/offices)
  
rental_agreements:
  - user_id
  - building_id
  - unit_number
  - monthly_cost
  - started_at
```

---

**Outcome:** Complete two-layer property market operational. Players understand land (underground) vs. buildings (above-ground) split. Housing becomes revenue source.
