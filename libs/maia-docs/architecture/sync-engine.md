# Sync Engine & Server Architecture

**How Data Syncs Between Devices, What Sync Servers See, and How Long Data Persists**

Last updated: 2026-01-17

---

## TL;DR - The Big Picture

**Think of sync like a **post office**:**
- Your devices (phones, laptops) = Houses sending/receiving mail
- Sync server = Post office (sorts and delivers mail, but can't read sealed envelopes)
- CoValues = Letters (some sealed/encrypted, some not)
- Syncing = Making sure all your houses get copies of all your mail

**Key Points:**
- ✅ Sync servers relay encrypted data (they can't read "private" content)
- ✅ Only group members can decrypt private data
- ✅ Sync servers don't have accounts - they're just relay points
- ✅ Your browser/app decides what to keep in storage and for how long

---

## Part 1: What is "Sync"?

### Sync = Keep All Your Devices Up-to-Date

```
You have 3 devices:
  • Laptop
  • Phone
  • Tablet

You edit a todo on your Laptop
  → Sync sends the change to Server
  → Server forwards it to Phone and Tablet
  → All 3 devices now have the same data!
```

**What gets synced:**
- ✅ New transactions (every change you make)
- ✅ CoValue headers (metadata)
- ✅ Group membership changes
- ✅ Everything needed to reconstruct your data

---

## Part 2: The Sync Architecture

### The 3 Components

```
┌──────────────────────────────────────────────────────────────────┐
│                       YOUR DEVICE                                │
│                                                                  │
│  ┌────────────────┐      ┌─────────────────┐      ┌──────────┐ │
│  │  LocalNode     │ ←──→ │  SyncManager    │ ←──→ │ Storage  │ │
│  │  (Your Data)   │      │  (Sync Engine)  │      │ (IndexedDB)│
│  └────────────────┘      └─────────────────┘      └──────────┘ │
│                                   ↓                              │
└───────────────────────────────────┼──────────────────────────────┘
                                    ↓
                         Network (WebSocket/HTTP)
                                    ↓
┌───────────────────────────────────┼──────────────────────────────┐
│                       SYNC SERVER                                │
│                                                                  │
│  ┌────────────────┐      ┌─────────────────┐      ┌──────────┐ │
│  │  SyncManager   │ ←──→ │  PeerStates     │ ←──→ │ Storage  │ │
│  │  (Relay Hub)   │      │  (Tracks Clients)│      │ (SQLite) │ │
│  └────────────────┘      └─────────────────┘      └──────────┘ │
│                                   ↓                              │
└───────────────────────────────────┼──────────────────────────────┘
                                    ↓
                         Network (WebSocket/HTTP)
                                    ↓
┌───────────────────────────────────┼──────────────────────────────┐
│                     OTHER DEVICES                                │
│                                                                  │
│  Your Phone, Tablet, Other Computers, etc.                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 3: How Sync Works - Message by Message

### The 4 Sync Messages

cojson uses 4 types of messages to sync:

#### 1. LOAD Message - "Hey, give me this CoValue!"

```javascript
{
  action: "load",
  id: "co_z123",
  header: false,  // I don't have the header yet
  sessions: {}    // I don't have any transactions
}
```

**Sent by:** Your device (to server)
**Means:** "I need this CoValue, please send me everything!"

---

#### 2. KNOWN Message - "Here's what I already have"

```javascript
{
  action: "known",
  id: "co_z123",
  header: true,  // I have the header
  sessions: {
    "session_z456": 5,  // I have 5 transactions from this session
    "session_z789": 2   // I have 2 transactions from this session
  }
}
```

**Sent by:** Both devices and servers
**Means:** "Don't send me what I already have, just send the new stuff!"

---

#### 3. CONTENT Message - "Here's the new data!"

```javascript
{
  action: "content",
  id: "co_z123",
  header: { type: "comap", ... },  // CoValue metadata
  priority: 3,  // MEDIUM priority
  new: {
    "session_z456": {
      after: 5,  // Start after transaction #5
      newTransactions: [tx6, tx7, tx8],  // New transactions
      lastSignature: "sig_z..."
    }
  }
}
```

**Sent by:** Whoever has the data (server or device)
**Means:** "Here's the data you're missing!"

---

#### 4. DONE Message - "I've sent everything!"

```javascript
{
  action: "done",
  id: "co_z123"
}
```

**Sent by:** Whoever sent the content
**Means:** "That's all the new data I have for this CoValue!"

---

### The Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Device Requests Data                                   │
│                                                                 │
│ Your Phone → Server                                             │
│   LOAD { id: "co_z123", header: false, sessions: {} }          │
│                                                                 │
│ Think: "Hey server, I need this todo list!"                    │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Server Checks What You Have                            │
│                                                                 │
│ Server tracks: "Phone wants co_z123"                            │
│ Server checks: "Does Phone already have some of it?"           │
│                                                                 │
│ Think: "Let me see what you're missing..."                     │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Server Sends Content                                   │
│                                                                 │
│ Server → Your Phone                                             │
│   CONTENT {                                                     │
│     id: "co_z123",                                              │
│     header: {...},                                              │
│     new: { session: [tx1, tx2, tx3] }                           │
│   }                                                             │
│                                                                 │
│ Think: "Here's your todo list data!"                           │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Phone Updates Local State                              │
│                                                                 │
│ 1. Verify signatures (is this really from group members?)      │
│ 2. Decrypt if "private" (using group's read key)               │
│ 3. Apply transactions to CRDT state                            │
│ 4. Save to local storage (IndexedDB)                           │
│ 5. Notify UI ("hey, new data!")                                │
│                                                                 │
│ Think: "Got it! Updating my local copy..."                     │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Phone Tells Server It Got Everything                   │
│                                                                 │
│ Your Phone → Server                                             │
│   KNOWN {                                                       │
│     id: "co_z123",                                              │
│     header: true,                                               │
│     sessions: { "session_z": 3 }  // I now have 3 transactions │
│   }                                                             │
│                                                                 │
│ Think: "Thanks, I got all 3 transactions!"                     │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Server Tracks Your State                               │
│                                                                 │
│ Server remembers: "Phone has co_z123 (header + 3 txs)"         │
│                                                                 │
│ Later, if Laptop makes a change:                               │
│   → Server knows Phone needs it                                │
│   → Server auto-forwards to Phone                              │
│                                                                 │
│ Think: "I'll remember what you have for next time!"            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Priority System - What Syncs First?

### The 3 Priority Levels

cojson prioritizes some CoValues over others:

```
Priority 0 (HIGH) - Sync FIRST
  ├─ Accounts
  ├─ Groups
  └─ Membership data
  
  Why? These are critical - you need them to access everything else!

Priority 3 (MEDIUM) - Sync SECOND  
  ├─ CoMaps (your data)
  ├─ CoLists (todo lists, etc.)
  ├─ CoStreams (activity logs)
  └─ CoPlainText (documents)
  
  Why? Your actual data - important but not critical

Priority 6 (LOW) - Sync LAST
  └─ BinaryCoStreams (images, files)
  
  Why? Large files can wait - sync smaller data first!
```

### How Priority Affects Sync

```
You just logged in:
  1. Sync Account (HIGH) → Can now access groups
  2. Sync Groups (HIGH) → Can now see what you're a member of
  3. Sync todo list (MEDIUM) → Your actual todos appear
  4. Sync profile images (LOW) → Images load last
```

**Think:** Like boarding an airplane:
- First class (HIGH) = Critical stuff
- Business class (MEDIUM) = Important stuff
- Economy (LOW) = Can wait a bit

---

## Part 5: Storage & Persistence - What Stays, How Long?

### Storage Location (YOUR Device)

```
Browser:
  IndexedDB (built-in browser database)
  ├─ Stores: All your CoValue transactions
  ├─ Size: Usually 50MB-1GB+ (depends on browser)
  └─ Cleared: When you clear browser data

Node.js / Server:
  SQLite or PostgreSQL (file/database)
  ├─ Stores: All CoValue transactions
  ├─ Size: Unlimited (your disk space)
  └─ Cleared: Manual (you delete the file/database)

Mobile (React Native):
  SQLite or Async Storage
  ├─ Stores: All CoValue transactions
  ├─ Size: Usually unlimited (phone storage)
  └─ Cleared: When you uninstall app
```

### What Gets Stored

```
✅ Stored in Your Device's Storage:
  • CoValue headers (metadata)
  • All transactions (every change)
  • Signatures (proof of who made changes)
  • Encrypted data (if "private")
  • Group membership info
  
❌ NOT Stored in Your Device's Storage:
  • Account secret (YOUR job to store this!)
  • Decrypted data (only stored encrypted)
```

### How Long Data Persists

#### In Memory (RAM)

```
GarbageCollector runs every 60 seconds:
  • Checks: "When was this CoValue last accessed?"
  • If > 5 minutes ago: Unload from memory
  • Result: Frees up RAM for active data
```

**Think:** Like your brain forgetting what you had for lunch 3 days ago (but you can remember if you check your journal!)

#### In Storage (IndexedDB/SQLite)

```
Data persists FOREVER (until you delete it):
  • ✅ Survives app restarts
  • ✅ Survives browser closing
  • ✅ Available offline
  • ❌ Takes up disk space
```

**Think:** Like writing in a notebook - it stays there until you rip out the page!

### Garbage Collection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 0:00 - You Load a Todo List                              │
│                                                                 │
│ CoValue co_z123 loaded into RAM                                 │
│ Last accessed: 0:00                                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 0:02 - You View the Todo List                            │
│                                                                 │
│ CoValue co_z123 still in RAM                                    │
│ Last accessed: 0:02 (updated!)                                  │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 0:08 - You Switch to a Different Page                    │
│                                                                 │
│ CoValue co_z123 still in RAM                                    │
│ Last accessed: 0:02 (5 minutes ago!)                            │
│                                                                 │
│ Garbage Collector runs:                                         │
│   "Last accessed 5 minutes ago? UNLOAD!"                        │
│                                                                 │
│ Result: Removed from RAM, still in IndexedDB                    │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 0:10 - You Go Back to Todo List                          │
│                                                                 │
│ CoValue co_z123 NOT in RAM                                      │
│   → Load from IndexedDB (fast!)                                 │
│   → Put back in RAM                                             │
│   → Last accessed: 0:10                                         │
│                                                                 │
│ Think: "I forgot, let me check my notes..."                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Sync Servers - What They Are & What They See

### Sync Servers Are NOT Accounts!

**Sync servers are just relay points:**

```
Sync Server ≠ Account
Sync Server = Mailbox / Post Office

They:
  ✅ Store encrypted transactions temporarily
  ✅ Forward messages between your devices
  ✅ Track "who needs what data"
  ❌ Don't have account secrets
  ❌ Can't decrypt "private" data
  ❌ Can't make changes to your data
```

### What Sync Servers See vs. Can't See

```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ SYNC SERVERS CAN SEE (Plaintext):                            │
│                                                                 │
│ • CoValue IDs (co_z...)                                         │
│ • Session IDs (session_z...)                                    │
│ • Account IDs (co_z...)                                         │
│ • Group IDs (co_z...)                                           │
│ • Timestamps (when changes were made)                           │
│ • Signatures (who made changes)                                 │
│ • "trusting" transactions (plaintext)                           │
│   Example: Group membership changes                             │
│   Example: Public profile names                                 │
│                                                                 │
│ Think: "They see the ENVELOPE, not the LETTER inside"          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ ❌ SYNC SERVERS CAN'T SEE (Encrypted):                          │
│                                                                 │
│ • "private" transaction content                                 │
│   Example: map.set("password", "secret", "private")            │
│   Server sees: "encrypted_U..."                                 │
│   Server CANNOT decrypt it!                                     │
│                                                                 │
│ • Read keys                                                     │
│   Example: key_z123_for_alice                                   │
│   Server sees: Encrypted blob                                   │
│   Only Alice can decrypt it!                                    │
│                                                                 │
│ Think: "They see SEALED envelopes - can't open them!"          │
└─────────────────────────────────────────────────────────────────┘
```

### Example: Sync Server's View

```javascript
// YOU create a private todo:
map.set("task", "Buy birthday gift for mom", "private");

// What SYNC SERVER sees:
{
  action: "content",
  id: "co_z123",
  new: {
    "session_z456": {
      after: 5,
      newTransactions: [
        {
          madeAt: 1705520000000,
          changes: ["encrypted_U9h3jk2l4..."], // ← Encrypted blob!
          signature: "sig_z789..."
        }
      ]
    }
  }
}

// Sync server:
//   ✅ Can relay this to your other devices
//   ❌ CANNOT read "Buy birthday gift for mom"
//   ❌ CANNOT decrypt the changes
```

### How Sync Servers Store Data

```
Sync Server Storage (SQLite/PostgreSQL):

Table: CoValues
  ├─ id: "co_z123"
  ├─ header: { type: "comap", ... }
  └─ priority: 3

Table: Transactions
  ├─ covalue_id: "co_z123"
  ├─ session_id: "session_z456"
  ├─ transaction_index: 6
  ├─ changes: "encrypted_U9h3jk2l4..." ← Encrypted!
  ├─ signature: "sig_z789..."
  └─ timestamp: 1705520000000

Table: PeerStates (Tracks what each client has)
  ├─ peer_id: "laptop_z123"
  ├─ covalue_id: "co_z123"
  ├─ has_header: true
  └─ sessions: { "session_z456": 5 }
```

**Think:** Sync server is a warehouse storing sealed boxes. They know:
- Which box belongs to which customer (CoValue ID)
- How many boxes each customer has (transactions count)
- When boxes arrived (timestamps)
- **BUT:** They can't open the boxes (can't decrypt)!

---

## Part 7: Unsynced Tracker - What Still Needs Syncing?

### The Problem

```
You're offline:
  1. You edit 5 todos
  2. You add 3 new notes
  3. You update your profile

Problem: None of this is synced yet!
Solution: UnsyncedCoValuesTracker remembers what needs syncing
```

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. You Make a Change (Offline)                                 │
│                                                                 │
│ map.set("task", "New todo", "private");                        │
│                                                                 │
│ UnsyncedTracker: "Add co_z123 to unsynced list"                │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. You Go Online                                                │
│                                                                 │
│ SyncManager: "Hey tracker, what needs syncing?"                │
│ UnsyncedTracker: "co_z123, co_z456, co_z789"                   │
│                                                                 │
│ SyncManager: "Okay, syncing those now..."                      │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Syncing Complete                                             │
│                                                                 │
│ Server: "Got all changes for co_z123!"                          │
│ UnsyncedTracker: "Remove co_z123 from unsynced list"           │
│                                                                 │
│ Remaining unsynced: co_z456, co_z789                            │
└─────────────────────────────────────────────────────────────────┘
```

### Persistence

```
UnsyncedTracker persists to Storage:
  • Saved: Which CoValues haven't synced
  • Saved: Which peers they haven't synced to
  • Batch: Updates saved every 200ms (not instant)
  
Why persist?
  → If app crashes while offline
  → On restart, it knows what to sync
  → No data loss!
```

---

## Part 8: Complete Sync Scenario

### Scenario: You Edit a Todo on Your Laptop

```
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 0:00 - You Type "Buy milk"                               │
│                                                                 │
│ Laptop:                                                         │
│   1. Create transaction (encrypted if "private")               │
│   2. Sign with your AgentSecret                                 │
│   3. Apply to local CRDT state                                  │
│   4. Save to IndexedDB                                          │
│   5. Mark as "unsynced" (UnsyncedTracker)                       │
│   6. Queue for sync (SyncManager)                               │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 0:00.1 - Send to Sync Server                             │
│                                                                 │
│ Laptop → Server:                                                │
│   CONTENT {                                                     │
│     id: "co_z123",                                              │
│     new: {                                                      │
│       "your_session": {                                         │
│         after: 5,                                               │
│         newTransactions: [encrypted_tx],                        │
│         signature: "sig_z..."                                   │
│       }                                                         │
│     }                                                           │
│   }                                                             │
│                                                                 │
│ Server:                                                         │
│   1. Receive transaction                                        │
│   2. Verify signature (yes, it's from you!)                     │
│   3. Store in SQLite (encrypted as-is)                          │
│   4. Check: "Who else needs this?"                              │
│   5. Queue for forwarding to Phone, Tablet                      │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 0:00.2 - Server Forwards to Phone                        │
│                                                                 │
│ Server → Phone:                                                 │
│   CONTENT { same transaction as above }                         │
│                                                                 │
│ Phone:                                                          │
│   1. Receive transaction                                        │
│   2. Verify signature (yes, from my laptop!)                    │
│   3. Decrypt (using group read key)                             │
│   4. Apply to local CRDT state                                  │
│   5. Save to IndexedDB                                          │
│   6. Update UI ("Buy milk" appears!)                            │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 0:00.3 - Phone Confirms Receipt                          │
│                                                                 │
│ Phone → Server:                                                 │
│   KNOWN {                                                       │
│     id: "co_z123",                                              │
│     header: true,                                               │
│     sessions: { "your_session": 6 }  // Now have 6 transactions│
│   }                                                             │
│                                                                 │
│ Server:                                                         │
│   "Phone is up-to-date with co_z123!"                           │
│   (Stores this knowledge for future syncs)                      │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ TIME: 0:00.4 - Laptop Marks as Synced                          │
│                                                                 │
│ Server → Laptop:                                                │
│   KNOWN { id: "co_z123", sessions: { "your_session": 6 } }     │
│                                                                 │
│ Laptop:                                                         │
│   "Server has my change!"                                       │
│   UnsyncedTracker: "Remove co_z123 from unsynced"              │
│   Result: All devices synced! ✅                                │
└─────────────────────────────────────────────────────────────────┘
```

**Total time: ~400ms** from typing to synced everywhere!

---

## Part 9: Security & Privacy Guarantees

### What Sync Servers CANNOT Do

```
❌ Read "private" transactions
   → Only group members have read key
   → Server sees encrypted blobs

❌ Impersonate you
   → Every transaction is signed with YOUR AgentSecret
   → Server can't fake your signature

❌ Modify your data
   → Every transaction is signed and verified
   → Modified transactions fail signature check

❌ Delete your data
   → CRDTs are append-only
   → Even server can't delete history

❌ Join your groups without invite
   → Group membership is cryptographically enforced
   → Server can't add itself as member
```

### What Sync Servers CAN Do

```
✅ See who's in which groups (membership is "trusting")
✅ See when changes were made (timestamps)
✅ See how many transactions you have (counts)
✅ Rate-limit you (prevent spam)
✅ Refuse to sync (if you're banned)
✅ See encrypted blobs (but can't decrypt)
```

### Trust Model

```
You TRUST sync server to:
  ✅ Deliver messages reliably
  ✅ Not lose your encrypted data
  ✅ Forward changes to your devices

You DON'T TRUST sync server to:
  ❌ Keep your secrets (they can't anyway!)
  ❌ Not read your data (they can't decrypt!)
  ❌ Be honest about membership (crypto enforces it)
```

**Think:** Like trusting a mailman:
- ✅ Trust them to deliver sealed letters
- ❌ Don't trust them not to peek (but they can't open sealed envelopes anyway!)

---

## Part 10: Implementation at Different Levels

### Level 1: cojson Core (Lowest)

```
cojson provides:
  • SyncManager (message routing)
  • PeerState (tracking what peers know)
  • Priority system (HIGH/MEDIUM/LOW)
  • Storage API (save/load)
  • Garbage collection (memory management)
```

**YOU implement:** Nothing at this level - it's built-in!

### Level 2: Application (Your Code)

```
You implement:
  1. Connect to sync server (WebSocket/HTTP)
  2. Pass peer to LocalNode:
     
     const peer = {
       id: "my-server",
       role: "server",
       incoming: websocket,
       outgoing: websocket
     };
     
     node.syncManager.addPeer(peer);

  3. That's it! Sync happens automatically!
```

### Level 3: Sync Server (If You Run Your Own)

```
Sync server implements:
  1. WebSocket server (accept connections)
  2. LocalNode (same as client!)
  3. Storage (SQLite/PostgreSQL)
  4. Message routing between clients

Key difference:
  • Server has NO account
  • Server just relays messages
  • Server stores encrypted data temporarily
```

---

## Summary: The 10 Key Points

### 1. Sync = Post Office

Sync server relays messages (transactions) between your devices. It's a middleman, not a participant.

### 2. 4 Message Types

- **LOAD**: "Give me this CoValue"
- **KNOWN**: "Here's what I have"
- **CONTENT**: "Here's new data"
- **DONE**: "That's all I have"

### 3. Priority System

- HIGH (0): Accounts, Groups
- MEDIUM (3): Your data
- LOW (6): Binary files

### 4. Sync Servers See Encrypted Blobs

- ✅ Can see: IDs, timestamps, signatures
- ❌ Can't see: "private" content (it's encrypted!)

### 5. Storage = IndexedDB/SQLite

- Your device: Stores all transactions locally
- Sync server: Stores encrypted transactions temporarily
- Persists forever until you delete it

### 6. Garbage Collection

- Memory: Unload CoValues after 5 minutes of inactivity
- Storage: Keep forever (or until you delete)

### 7. Unsynced Tracker

- Tracks: Which CoValues haven't synced yet
- Persists: To storage (survives app restart)
- Syncs: When you go back online

### 8. Sync Servers Don't Have Accounts

- They're relay points, not participants
- Can't decrypt your data
- Can't join your groups
- Can't impersonate you

### 9. Security Guarantees

- Signatures prevent impersonation
- Encryption prevents eavesdropping
- CRDTs prevent data loss
- Crypto enforces access control

### 10. Implementation is Simple

```javascript
// Connect to sync server
const peer = { id: "server", role: "server", ... };
node.syncManager.addPeer(peer);

// Done! Sync happens automatically!
```

---

## References

- `libs/maia-db/node_modules/cojson/src/sync.ts` - SyncManager, message types
- `libs/maia-db/node_modules/cojson/src/PeerState.ts` - Peer tracking
- `libs/maia-db/node_modules/cojson/src/priority.ts` - Priority system
- `libs/maia-db/node_modules/cojson/src/GarbageCollector.ts` - Memory management
- `libs/maia-db/node_modules/cojson/src/UnsyncedCoValuesTracker.ts` - Unsynced tracking
- `libs/maia-db/node_modules/cojson/src/storage/` - Storage implementations
