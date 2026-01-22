# cojson Crypto & Permissions Architecture

**Understanding Signing, Access Control, Keys, and Group Membership**

Last updated: 2026-01-17

---

## Overview

This document explains how cojson handles:
- **Cryptography** (signing, encryption)
- **Sessions** (what they are and why they matter)
- **Access Control** (who can read/write what)
- **Group Membership** (joining, leaving, key rotation)

---

## Part 1: Sessions - Like a Conversation Transcript

### What is a Session?

Think of a **Session** like a **phone call** or **chat session** with your app:

```
Session = "You (Alice) logged in from your laptop on Tuesday at 2pm"
```

**Session Format:**
```
co_z123_session_z456
  ↑           ↑
  Account     Random session ID
  or Agent
```

### Why Sessions Matter

Every time you make a change (edit, add, delete), cojson needs to know:
1. **WHO** made the change (which Account/Agent)
2. **WHEN** they made it (timestamp)
3. **WHICH SESSION** they were in (so changes can be grouped together)

**Example:**
```
Alice's Morning Session (9am):
  - Created todo "Buy milk"
  - Completed todo "Wake up"
  
Alice's Afternoon Session (2pm):
  - Created todo "Walk dog"
  - Created todo "Reply to emails"
```

### Sessions in CoStream

Remember how `CoStream.toJSON()` returns:
```javascript
{
  "co_z123_session_z456": [item1, item2],  // Alice's morning
  "co_z123_session_z789": [item3, item4]   // Alice's afternoon
}
```

Each session gets its own array of items! This is how cojson groups changes by **when** and **from where** they were made.

---

## Part 2: Cryptography - The Security Layer

### The Two Types of Keys

cojson uses **two different key systems**:

#### 1. Signing Keys (Ed25519) - "Prove it's really you"

Like a **signature** on a document:
- **SignerSecret**: Your private pen (keep secret!)
- **SignerID**: Your signature style (public, identifies you)
- **Signature**: The actual signature on a document

**Purpose:** Prove that YOU made a specific change.

```
Alice creates todo:
  1. Alice signs: "I, Alice, created 'Buy milk' at 2pm"
  2. Signature attached to transaction
  3. Anyone can verify: "Yes, Alice really made this change"
```

#### 2. Encryption Keys (X25519 + XSalsa20) - "Keep it secret"

Like a **lock and key** for a secret box:
- **SealerSecret**: Your private key (keep secret!)
- **SealerID**: Your public lock (public, anyone can use)
- **KeySecret**: Secret used to encrypt data
- **KeyID**: Label for that secret

**Purpose:** Encrypt data so only group members can read it.

### Agent = Sealer + Signer

An **Agent** is just both keys combined:

```
AgentSecret = "sealerSecret_z.../signerSecret_z..."
             = Your encryption key + Your signing key

AgentID = "sealer_z.../signer_z..."
        = Your public lock + Your signature style
```

**Think of it as:** Your complete identity in cojson = ability to encrypt + ability to sign.

---

## Part 3: Privacy Modes - "Trusting" vs "Private"

Every transaction can be made in one of two modes:

### Mode 1: `"trusting"` (Plain Text)

**What it means:** "I trust that only allowed people will see this, but I'm not encrypting it"

```javascript
map.set("name", "Alice", "trusting");
//                        ↑
//                    Not encrypted!
```

**Stored as:**
```json
{
  "changes": ["set", "name", "Alice"],  // Plain text!
  "signature": "..."
}
```

**Who can see it:** EVERYONE who gets the transaction (sync servers, anyone with the data file)

**Use cases:**
- Public data (usernames, public profiles)
- Group membership changes (roles)
- When you want sync servers to see content (for indexing, search)

### Mode 2: `"private"` (Encrypted) - DEFAULT

**What it means:** "Encrypt this so ONLY group members can read it"

```javascript
map.set("password", "secret123", "private");
//                                ↑
//                           Encrypted!
```

**Stored as:**
```json
{
  "changes": ["encrypted_U..."],  // Encrypted blob!
  "signature": "..."
}
```

**Who can see it:** ONLY people with the group's read key (group members)

**Use cases:**
- Sensitive data (passwords, private notes)
- Personal information
- Anything you don't want sync servers to see

---

## Part 4: Access Control - The 5 Roles

cojson uses a **role-based permission system** for groups:

### The Role Hierarchy

```
     ┌──────────────────────────────────────────────┐
     │ ADMIN                                        │ 🔴 Full power
     │ - Read, Write, Delete                        │
     │ - Change anyone's role                       │
     │ - Manage keys (rotate, add members)          │
     │ - Cannot demote other admins                 │
     └──────────────────────────────────────────────┘
                       ↓
     ┌──────────────────────────────────────────────┐
     │ MANAGER                                      │ 🟠 Team lead
     │ - Read, Write, Delete                        │
     │ - Invite/remove members (except admins)      │
     │ - Manage keys                                │
     │ - Cannot promote to admin                    │
     └──────────────────────────────────────────────┘
                       ↓
     ┌──────────────────────────────────────────────┐
     │ WRITER                                       │ 🟢 Collaborator
     │ - Read, Write, Delete                        │
     │ - Cannot manage members                      │
     │ - Cannot manage keys                         │
     └──────────────────────────────────────────────┘
                       ↓
     ┌──────────────────────────────────────────────┐
     │ READER                                       │ 🔵 Observer
     │ - Read only                                  │
     │ - Cannot write                               │
     │ - Cannot manage members                      │
     └──────────────────────────────────────────────┘
                       ↓
     ┌──────────────────────────────────────────────┐
     │ WRITEONLY                                    │ 🟡 Contributor
     │ - Write only                                 │
     │ - Can only read own changes                  │
     │ - Cannot read others' data                   │
     │ - Use case: Anonymous submissions            │
     └──────────────────────────────────────────────┘
```

### Special: "Everyone" Role

You can grant a role to the special member `"everyone"`:

```javascript
group.addMember("everyone", "reader");
// Now ANYONE can read this group's data!
```

**Valid roles for "everyone":** `reader`, `writer`, `writeOnly`, `revoked`

---

## Part 5: Group Keys - The Read Key System

### What is a Read Key?

A **Read Key** is the **group's encryption secret** - the key that lets you decrypt `"private"` transactions.

```
Read Key = The master key to the group's encrypted data
```

**Every group has ONE active read key at a time.**

### How Read Keys Work

```
Group Created:
  ├─ Generate Random Read Key: key_z123
  ├─ Store: group.set("readKey", key_z123)
  └─ Encrypt for each member:
      ├─ Alice: key_z123_for_alice (encrypted with Alice's sealer)
      ├─ Bob: key_z123_for_bob (encrypted with Bob's sealer)
      └─ Carol: key_z123_for_carol (encrypted with Carol's sealer)
```

**Each member gets their own encrypted copy of the read key!**

### Key Rotation - When Someone Leaves

When you **remove a member**, cojson **rotates the read key** (creates a new one):

```
BEFORE:
  Read Key: key_z123
  Members: Alice, Bob, Carol

Carol gets removed:
  1. Create NEW read key: key_z456
  2. Encrypt NEW key for remaining members:
     ├─ Alice: key_z456_for_alice
     └─ Bob: key_z456_for_bob
  3. Encrypt OLD key with NEW key:
     └─ key_z123_for_key_z456 (so Alice/Bob can still read old data)
  4. Carol's copy (key_z123_for_carol) is NOT updated

AFTER:
  Read Key: key_z456 (new!)
  Members: Alice, Bob
  Carol: Can read OLD data (encrypted with key_z123)
         Cannot read NEW data (encrypted with key_z456)
```

**Result:** Carol can't read any NEW messages after being removed, but can still read old messages from when she was a member.

---

## Part 6: Signing Flows - Transaction Lifecycle

### Every Change Goes Through This Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                              │
│    map.set("name", "Alice", "private")                      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CREATE TRANSACTION                                       │
│    - Author: Your AgentID                                   │
│    - Session: Your current SessionID                        │
│    - Timestamp: Now                                         │
│    - Changes: ["set", "name", "Alice"]                      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ENCRYPT (if "private")                                   │
│    - Get group's read key                                   │
│    - Encrypt changes with read key                          │
│    - Result: "encrypted_U..."                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. SIGN                                                     │
│    - Hash entire transaction                                │
│    - Sign hash with your SignerSecret                       │
│    - Attach signature                                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. BROADCAST                                                │
│    - Send to sync servers                                   │
│    - Send to other peers                                    │
│    - Save to local storage                                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. VERIFICATION (by recipients)                             │
│    - Verify signature (is it really from this AgentID?)     │
│    - Check permissions (does this Agent have write access?) │
│    - Check timestamp (is it valid?)                         │
│    - Mark as VALID or INVALID                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. APPLY (if valid)                                         │
│    - Decrypt (if "private")                                 │
│    - Apply change to CRDT state                             │
│    - Notify subscribers                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 7: Group Membership Lifecycle

### Scenario: Alice Creates a Group and Invites Bob

```javascript
// 1. Alice creates a group
const group = alice.node.createGroup();
// Result: 
//   - Group CoMap created
//   - Read key generated (key_z123)
//   - key_z123_for_alice (encrypted copy for Alice)
//   - Alice is ONLY member (not yet admin!)

// 2. Alice promotes herself to admin
//    (first transaction in any group)
group.addMember(alice.account, "admin");
// Result:
//   - Transaction: set("alice_account_id", "admin")
//   - Alice is now admin

// 3. Alice creates an invite for Bob
const invite = group.createInvite("writer");
// Result:
//   - Generate random secret seed
//   - Derive invite AgentID from seed
//   - Add invite agent as "writerInvite" role
//   - Return InviteSecret (string Bob will use)

// 4. Alice sends InviteSecret to Bob (out-of-band: email, chat, etc.)
// "inviteSecret_z..."

// 5. Bob accepts the invite
await bob.node.acceptInvite(group.id, invite);
// Result:
//   - Bob derives invite AgentID from InviteSecret
//   - Bob's agent uses invite agent to promote itself
//   - Transaction: set("bob_account_id", "writer")
//   - Bob gets encrypted copy of read key: key_z123_for_bob
//   - Bob can now read/write in the group!
```

### Scenario: Alice Removes Bob

```javascript
// 1. Alice removes Bob
group.removeMember(bob.account);
// This triggers TWO operations:

// OPERATION 1: Rotate Read Key
//   - Generate NEW read key: key_z456
//   - Encrypt NEW key for remaining members (just Alice)
//   - key_z456_for_alice
//   - Encrypt OLD key with NEW key: key_z123_for_key_z456
//   - Update group.readKey = key_z456

// OPERATION 2: Revoke Role
//   - Transaction: set("bob_account_id", "revoked")
//   - Bob's role is now "revoked"

// Result:
//   - Bob can still read OLD messages (encrypted with key_z123)
//   - Bob CANNOT read NEW messages (encrypted with key_z456)
//   - Bob CANNOT write anymore (role = "revoked")
```

---

## Part 8: Write-Only Members (Special Case)

Write-only members work differently because they **can't read the read key**.

### How Write-Only Works

```javascript
// 1. Add write-only member
group.addMember(charlie.account, "writeOnly");

// Behind the scenes:
// - Generate WRITE KEY for Charlie (different from read key!)
// - writeKeyFor_charlie = key_z789
// - Encrypt write key for Charlie: key_z789_for_charlie
// - Charlie gets write key, NOT read key

// 2. Charlie writes data
charlie_map.set("submission", "My anonymous feedback", "private");

// Encryption:
// - Encrypted with Charlie's WRITE KEY (key_z789)
// - NOT with group's read key (key_z456)

// 3. Admins reveal Charlie's write key to other members
// - When a reader needs to read Charlie's data:
//   - Admin encrypts Charlie's write key for that reader
//   - key_z789_for_alice (so Alice can decrypt Charlie's writes)

// Result:
// - Charlie can write but can't read others' data
// - Admins control who can read Charlie's submissions
// - Use case: Anonymous feedback, crowd-sourced data
```

---

## Part 9: Permission Checking - The Validation Rules

When a transaction arrives, cojson checks:

### For Group CoValues (Membership Changes)

```
Valid if:
  ✓ Signature is valid (really from this Agent)
  ✓ Agent is in the group
  ✓ Agent has correct role at time of transaction:
    - Admin: Can do almost anything
    - Manager: Can manage non-admin members
    - Writer: Can only write data (not manage members)
    - Invite roles: Can only promote themselves to target role
```

### For Owned CoValues (Data Changes)

```
Valid if:
  ✓ Signature is valid
  ✓ Agent is in the OWNING GROUP
  ✓ Agent has write permissions (admin, manager, writer, writeOnly)
  ✓ Timestamp is reasonable (not too far in future)
```

### Special Rules

1. **Admins can't demote other admins** (prevents coup)
2. **Managers can't promote to admin** (prevents escalation)
3. **Only admins can make private transactions in groups** (key management)
4. **Anyone can revoke themselves** (you can always leave)
5. **Readers can create branch pointers** (for local edits)

---

## Part 10: Account vs Group - Key Differences

### Account (Your Personal Space)

```
Type: CoMap with special meta
Ruleset: { type: "group", initialAdmin: your_agent_id }
Meta: { type: "account" }

Key differences:
  ✗ Cannot create invites
  ✗ Cannot add other members
  ✗ Cannot remove members
  ✗ Cannot extend (link to parent groups)
  ✓ Your agent is always admin
  ✓ Automatic role: if it's your Account, you're admin
```

**Think of it as:** Your personal "group of one" that follows most group rules but can't grow.

### Group (Collaborative Space)

```
Type: CoMap with group ruleset
Ruleset: { type: "group", initialAdmin: creator_id }
Meta: null (or any custom JSON)

Key abilities:
  ✓ Create invites
  ✓ Add/remove members
  ✓ Promote/demote roles
  ✓ Extend (link to parent groups for role inheritance)
  ✓ Rotate keys when members leave
```

**Think of it as:** A team workspace with full membership management.

---

## Summary: The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR IDENTITY                           │
│                                                             │
│  AgentSecret (Private)                                      │
│    ├─ SealerSecret (for encryption)                         │
│    └─ SignerSecret (for signing)                            │
│                                                             │
│  AgentID (Public)                                           │
│    ├─ SealerID (others encrypt TO you)                      │
│    └─ SignerID (others verify FROM you)                     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    YOU JOIN A GROUP                         │
│                                                             │
│  1. Get invite or admin adds you                            │
│  2. Receive role (admin/manager/writer/reader/writeOnly)    │
│  3. Get encrypted copy of group's read key                  │
│     └─ key_z123_for_you                                     │
│  4. Can now encrypt/decrypt "private" transactions          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   YOU MAKE CHANGES                          │
│                                                             │
│  1. Create transaction                                      │
│  2. Choose privacy: "private" (encrypt) or "trusting"       │
│  3. Sign transaction with SignerSecret                      │
│  4. Broadcast to network                                    │
│  5. Others verify signature & permissions                   │
│  6. Valid transactions are applied to CRDT state            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                 SOMEONE LEAVES GROUP                        │
│                                                             │
│  1. Admin removes member                                    │
│  2. Group rotates read key (key_z123 → key_z456)            │
│  3. Remaining members get new encrypted copies              │
│  4. Removed member keeps old key (can read old data)        │
│  5. Removed member CANNOT decrypt new data                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Sessions** = Grouped changes from one "login session" of an agent
2. **Agents** = Your crypto identity (encryption + signing keys)
3. **"Private" vs "Trusting"** = Encrypted vs plaintext transactions
4. **Roles** = 5-level permission system (admin → manager → writer → reader → writeOnly)
5. **Read Keys** = Group's encryption secret, rotated when members leave
6. **Signing** = Every transaction is signed, verified by recipients
7. **Accounts** = Special "group of one" with limited membership features
8. **Groups** = Full collaborative spaces with member management

---

## References

- `libs/maia-db/node_modules/cojson/src/crypto/` - Crypto primitives
- `libs/maia-db/node_modules/cojson/src/permissions.ts` - Permission validation
- `libs/maia-db/node_modules/cojson/src/coValues/account.ts` - Account implementation
- `libs/maia-db/node_modules/cojson/src/coValues/group.ts` - Group implementation, key rotation
