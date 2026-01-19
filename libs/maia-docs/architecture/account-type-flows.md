# Account Types & Flows: Visitor and Traveler

## What Are Visitors and Travelers?

MaiaOS has two types of accounts:

### 🎭 **Visitors** (Anonymous Accounts)
Think of a Visitor like trying out a video game **without creating an account**. You can:
- Play the game immediately (no signup required!)
- Save your progress on **this device** (using your browser's storage)
- Your name is "Smiling Visitor" 😊

**BUT**: Your progress only exists on this one device. If you switch computers or clear your browser, it's gone!

### ✈️ **Travelers** (Persistent Accounts)
Think of a Traveler like creating a **real game account with a password** (but cooler - you use your fingerprint/face instead!). You can:
- Save your progress **everywhere** (syncs across all your devices)
- Use your fingerprint or face (Touch ID, Face ID) to log in
- Choose your own name
- Never lose your data (it's stored in the cloud)

**KEY DIFFERENCE**: Travelers use **passkeys** (biometric authentication) to log in, which is way more secure than passwords!

---

## How Do Visitors Work?

### When You First Visit MaiaOS

```
1. You open MaiaOS in your browser
   ↓
2. MaiaOS automatically creates a Visitor account for you
   ↓
3. You start using the app immediately!
   ↓
4. Your data is saved locally in your browser
```

**Behind the scenes:**
- MaiaOS generates a **random secret key** (like a temporary password)
- This secret is stored in `localStorage` (your browser's storage)
- Your data is stored in `IndexedDB` (another browser storage)
- Your account state is marked as `'visitor'` in localStorage

### What Gets Stored (Visitor)

**In localStorage:**
```javascript
{
  maia_account_state: 'visitor',              // Account type
  maia_visitor_secret: {                       // Secret credentials
    accountID: 'co_z...',                      // Your account ID
    secretSeed: [1, 2, 3, ...]                 // Random secret (array of numbers)
  }
}
```

**In IndexedDB:**
- All your CoValues (data structures)
- Your DataGround (main data container)
- Your profile ("Smiling Visitor")

**Security Note:** The secret is **random** and **only on this device**. If you clear your browser data, it's gone forever!

---

## How Do Travelers Work?

### Creating a Traveler Account

```
1. You click "Upgrade to Traveler" or "Create Account"
   ↓
2. You create a passkey (Touch ID, Face ID, Windows Hello)
   ↓
3. Your fingerprint/face is stored in your device's Secure Enclave (hardware chip)
   ↓
4. MaiaOS derives a secret from your passkey (using PRF - Pseudo-Random Function)
   ↓
5. Your account ID is computed from this secret (always the same!)
   ↓
6. Your data syncs to Jazz Cloud (secure server)
```

**Behind the scenes:**
- Your passkey uses **PRF** (a math function) to generate a secret
- Same passkey + same salt = **same secret every time** (deterministic!)
- Your account ID is computed from the secret (also deterministic!)
- **NO secrets stored in localStorage** - everything computed from your passkey!

### What Gets Stored (Traveler)

**In localStorage:**
```javascript
{
  maia_account_state: 'traveler'  // That's it! No secrets!
}
```

**In IndexedDB:**
- All your CoValues (data structures)
- Your DataGround
- Your profile (your chosen name)

**In Secure Enclave (hardware chip in your device):**
- Your passkey (fingerprint/face data)
- Cannot be extracted or stolen!

**In Jazz Cloud (secure server):**
- All your data (encrypted)
- Syncs across all your devices

**Security Note:** No secrets in localStorage = **immune to XSS attacks** (a type of hack)!

---

## Upgrading from Visitor to Traveler

**The Problem:** You've been using MaiaOS as a Visitor and created some cool stuff. Now you want to upgrade to a Traveler account to sync across devices. **But how do we transfer your data?**

### The Upgrade Flow

```
VISITOR ACCOUNT                      TRAVELER ACCOUNT
┌─────────────────┐                 ┌─────────────────┐
│ Visitor         │                 │ Traveler        │
│ Random secret   │                 │ Passkey PRF     │
│ accountID: V123 │                 │ accountID: T456 │
│                 │                 │                 │
│ Default Group   │                 │ Default Group   │
│ ├─ DataGround ──┼──┐           ┌──┼─ DataGround     │
│ ├─ Profile      │  │           │  │ ├─ Profile      │
│ └─ Other data   │  │           │  │ └─ Other data   │
└─────────────────┘  │           │  └─────────────────┘
                     │           │
                     └───────────┘
                  DATA TRANSFERRED!
```

### Step-by-Step Upgrade Process

**What YOU see:**
1. Click "Upgrade to Traveler"
2. Enter your name (e.g., "Alice")
3. Create passkey (Touch ID prompt)
4. Done! All your data is still there!

**What happens behind the scenes:**

```
Step 1: Create Traveler Account
  → Create passkey with Touch ID
  → Derive secret from passkey (PRF magic!)
  → Compute accountID deterministically
  → Create new Traveler account
  
Step 2: Migrate Data (Group Permissions)
  → Get Visitor's Default Group (owns all data)
  → Get Visitor's DataGround (main data container)
  → Add Traveler as ADMIN to Visitor's Default Group
  → Traveler can now access all Visitor's data!
  
Step 3: Transfer Ownership
  → Copy DataGround co-id to Traveler account
  → Traveler now references the same DataGround
  → Visitor leaves the group
  → Traveler is now SOLE OWNER
  
Step 4: Cleanup
  → Clear Visitor credentials from localStorage
  → Update state: visitor → traveler
  → Shutdown Visitor node
  → Done!
```

**The Magic:** Jazz/cojson uses **group permissions** to transfer ownership. It's like giving someone the keys to your house and then moving out - they now own everything!

### Code Example (Upgrade)

```javascript
import { upgradeVisitorToTraveler } from '@MaiaOS/ssi';

// Get current Visitor account
const visitor = await loadVisitorAccount();

// Upgrade!
const traveler = await upgradeVisitorToTraveler({
  visitorAccount: visitor.account,
  visitorNode: visitor.node,
  name: "Alice",                     // Your chosen name
  salt: "maia.city",                 // Salt for passkey PRF
  onProgress: (step) => {             // Progress updates
    console.log(step);
  }
});

// All done! You're now a Traveler with all your data!
console.log("Upgraded to:", traveler.accountID);
```

---

## What If You Sign In With an Existing Passkey?

**The Problem:** You're a Visitor, but you already have a Traveler account on another device. You click "Sign In with Existing Passkey." **What happens to your Visitor data?**

### The Discard Flow

```
VISITOR ACCOUNT (This Device)       TRAVELER ACCOUNT (Existing)
┌─────────────────┐                 ┌─────────────────┐
│ Visitor         │                 │ Traveler        │
│ "Smiling Vis"   │                 │ "Alice"         │
│ Some temp data  │                 │ Real data       │
└─────────────────┘                 └─────────────────┘
         │                                   │
         │   Sign in with existing passkey   │
         │   →  Visitor data DISCARDED       │
         ↓                                   ↓
      🗑️  GONE                         ✅ LOADED
```

**What YOU see:**
1. Click "Sign In with Existing Passkey"
2. Warning: "You have Visitor data. Signing in will discard it. Continue?"
3. Confirm
4. Use Touch ID to sign in
5. Your Traveler account loads (Visitor data is gone)

**What happens behind the scenes:**

```
Step 1: Detect Visitor Account
  → Check localStorage: maia_account_state = 'visitor'
  → Load Visitor account
  
Step 2: Discard Visitor Data
  → Clear visitor credentials from localStorage
  → Clear account state
  → Shutdown Visitor node
  
Step 3: Sign In as Traveler
  → Use passkey to sign in
  → Load Traveler account from Jazz Cloud
  → Update state: visitor → traveler
  → Done!
```

**Why discard?** The Visitor account was temporary anyway! If you had important data, you should have upgraded instead.

### Code Example (Discard)

```javascript
import { signInAsTraveler, getAccountState } from '@MaiaOS/ssi';

// Check if Visitor exists
const accountState = getAccountState();

if (accountState === 'visitor') {
  // Warn user
  const confirmed = confirm("You have Visitor data. Signing in will discard it. Continue?");
  if (!confirmed) return;
}

// Sign in as Traveler (auto-discards Visitor if present)
const traveler = await signInAsTraveler({ salt: "maia.city" });

console.log("Signed in as:", traveler.accountID);
```

---

## Default Account Group & DataGround

Every account (Visitor or Traveler) has:

### 1. **Default Account Group**
Think of this like a **folder that owns all your stuff**. Every account gets ONE default group that:
- Is created automatically when you create an account
- Owns all your data (CoMaps, CoLists, etc.)
- Stored as `account._defaultGroup` (internal reference)

### 2. **DataGround** (was called "appRoot")
Think of this like your **main storage container** (like a backpack). It's a CoMap that:
- Holds references to all your important data
- Lives in your Default Group
- Stored as `account.dataGround`

**Why this matters for upgrades:** When you upgrade from Visitor to Traveler, we transfer ownership of the **Default Group** (which owns everything including DataGround). It's like giving someone your entire backpack - everything inside comes with it!

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MaiaOS ACCOUNT SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🎭 VISITOR (Anonymous)                                         │
│  ├─ Profile: "Smiling Visitor"                                  │
│  ├─ Random secret → localStorage                                │
│  ├─ accountID: co_z... (random)                                │
│  ├─ Default Group (owns all data)                              │
│  │   └─ DataGround (main container)                            │
│  ├─ Storage: IndexedDB + localStorage                          │
│  └─ Sync: Optional (if Jazz API key present)                   │
│                                                                  │
│            ↓                                                     │
│      [UPGRADE FLOW]                                             │
│            ↓                                                     │
│  1. Create Traveler account (passkey PRF)                       │
│  2. Add Traveler as admin to Visitor's Default Group           │
│  3. Copy DataGround co-id to Traveler                          │
│  4. Visitor leaves group → Traveler sole owner                  │
│  5. Clear Visitor credentials                                   │
│            ↓                                                     │
│                                                                  │
│  ✈️  TRAVELER (Persistent)                                      │
│  ├─ Profile: User-chosen name                                   │
│  ├─ Passkey PRF → deterministic secret                         │
│  ├─ accountID: co_z... (deterministic)                         │
│  ├─ Default Group (inherited from Visitor)                     │
│  │   └─ DataGround (same as Visitor's!)                        │
│  ├─ Storage: IndexedDB only (no localStorage secrets)          │
│  └─ Sync: Jazz Cloud (cross-device sync)                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Visitors
- ✅ **Pro**: Instant access, no signup
- ✅ **Pro**: Data persists across page reloads (same device)
- ❌ **Con**: Data only on this device
- ❌ **Con**: Lost if you clear browser data

### Travelers
- ✅ **Pro**: Data syncs across all devices
- ✅ **Pro**: Secure (passkey = fingerprint/face)
- ✅ **Pro**: No localStorage secrets (XSS-proof!)
- ✅ **Pro**: Never lose your data
- ⚠️ **Con**: Requires browser with PRF support (Chrome, Safari)

### Upgrade Process
- ✅ **Data preserved**: All Visitor data transferred to Traveler
- ✅ **Seamless**: Group permissions handle ownership transfer
- ✅ **Fast**: Only a few seconds
- ⚠️ **One-way**: Can't go back from Traveler to Visitor

### Discard Process
- ⚠️ **Data lost**: Visitor data discarded
- ✅ **Clean**: No leftover data
- ⚠️ **Warning shown**: User confirms before discarding

---

## Glossary

- **PRF (Pseudo-Random Function)**: Math function that generates same output for same input (deterministic)
- **Passkey**: Modern authentication using fingerprint/face (stored in hardware)
- **Secure Enclave**: Hardware chip that stores secrets (cannot be extracted)
- **localStorage**: Browser storage for small data (vulnerable to XSS)
- **IndexedDB**: Browser storage for large data (CoValues)
- **Jazz Cloud**: Secure server that syncs your data
- **Default Group**: Folder that owns all your data
- **DataGround**: Main storage container (like a backpack)
- **co-id**: Unique identifier for CoValues (e.g., `co_z...`)
- **CoValue**: Data structure in Jazz/cojson (CoMap, CoList, etc.)

---

*For technical implementation details, see [developers/09_authentication.md](../developers/09_authentication.md)*
