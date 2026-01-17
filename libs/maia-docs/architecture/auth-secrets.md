# Authentication & Account Secrets

**How Sign-Up, Login, and Secret Storage Work in cojson**

Last updated: 2026-01-17

---

## TL;DR - The Big Picture

**cojson does NOT handle authentication or secret storage for you!**

Think of cojson like a **safe**:
- cojson provides the **lock mechanism** (crypto, signing, encryption)
- **YOU** decide where to keep the **key** (account secret)
- **YOU** decide how users prove they should get the key (password, biometric, passkey, etc.)

---

## Part 1: What is an "Account Secret"?

### Your Account Secret = Your Identity

```
AgentSecret = "sealerSecret_z.../signerSecret_z..."
             ↑
        This IS your account!
```

**Think of it like:**
- Your house key
- Your password to everything
- Your fingerprint (but digital)

**If you lose it:**
- ❌ You can NEVER access your account again
- ❌ cojson cannot "reset your password"
- ❌ No one can help you recover it

**If someone steals it:**
- ⚠️ They can impersonate you completely
- ⚠️ They can read all your private data
- ⚠️ They can make changes as you

---

## Part 2: The Two Flows - Sign Up & Login

### Flow 1: Sign Up (Creating a New Account)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Generate Random Secret                             │
│                                                             │
│ const agentSecret = crypto.newRandomAgentSecret();         │
│ // "sealerSecret_z.../signerSecret_z..."                    │
│                                                             │
│ Think: "Generate a completely random house key"            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Create Account with cojson                         │
│                                                             │
│ const { node, accountID, accountSecret } =                  │
│   await LocalNode.withNewlyCreatedAccount({                 │
│     crypto: Crypto,                                         │
│     initialAgentSecret: agentSecret,  // Optional          │
│     creationProps: { name: "Alice" },                       │
│   });                                                       │
│                                                             │
│ Think: "Use the key to create your account lock"           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: YOU MUST STORE THE SECRET SOMEWHERE!               │
│                                                             │
│ ⚠️  cojson does NOT store this for you!                     │
│                                                             │
│ Options (YOU decide):                                       │
│  • Browser localStorage                                     │
│  • Encrypted database                                       │
│  • Server-side (encrypted with user password)              │
│  • Hardware security module                                 │
│  • Password manager                                         │
│                                                             │
│ Think: "Hide your house key somewhere safe"                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ RESULT: Account Created!                                    │
│                                                             │
│ You have:                                                   │
│  • accountID: "co_z..." (public, like username)             │
│  • accountSecret: "sealer.../signer..." (PRIVATE!)          │
│  • node: Your active session                                │
│                                                             │
│ User can now use the app!                                   │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Login (Loading Existing Account)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: GET the Secret from Wherever YOU Stored It         │
│                                                             │
│ const accountSecret = await getStoredSecret();             │
│                                                             │
│ This could be:                                              │
│  • Reading from localStorage                                │
│  • Fetching from your server (after password check)        │
│  • Decrypting from encrypted storage                        │
│  • Getting from hardware key                                │
│                                                             │
│ Think: "Find your house key from hiding spot"              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Load Account with cojson                           │
│                                                             │
│ const node = await LocalNode.withLoadedAccount({           │
│   crypto: Crypto,                                           │
│   accountID: "co_z...",                                     │
│   accountSecret: accountSecret,  // From step 1!           │
│   sessionID: crypto.newRandomSessionID(accountID),         │
│   peers: [syncServerPeer],                                  │
│ });                                                         │
│                                                             │
│ Think: "Use your key to unlock your account"               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ RESULT: Logged In!                                          │
│                                                             │
│ node.expectCurrentAccount() // Your account!                │
│                                                             │
│ User can now access their data!                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 3: Where Secrets Are Stored - YOUR Choice!

### cojson's Philosophy

**cojson says:** "I'll handle the crypto. YOU handle where to keep the keys."

**Why?**
- Different apps have different security needs
- Different platforms have different storage options
- You know your users better than cojson does

### Storage Options (YOU Implement)

#### Option 1: Browser localStorage (Simple but Not Secure)

```javascript
// Sign Up
const { accountID, accountSecret } = await LocalNode.withNewlyCreatedAccount({...});
localStorage.setItem('accountID', accountID);
localStorage.setItem('accountSecret', accountSecret); // ⚠️ Plaintext!

// Login
const accountID = localStorage.getItem('accountID');
const accountSecret = localStorage.getItem('accountSecret');
const node = await LocalNode.withLoadedAccount({ accountID, accountSecret, ... });
```

**Pros:**
- ✅ Super simple
- ✅ Works offline
- ✅ No server needed

**Cons:**
- ⚠️ Stored in plaintext (anyone with computer access can read it)
- ⚠️ XSS attacks can steal it
- ⚠️ User can't access account from different device

**Good for:** Personal apps, prototypes, when user fully owns the device

---

#### Option 2: Server-Side with Password (More Secure)

```javascript
// Sign Up Flow
const { accountID, accountSecret } = await LocalNode.withNewlyCreatedAccount({...});

// User enters password
const userPassword = prompt("Create a password");

// Send to YOUR server
await fetch('/api/signup', {
  method: 'POST',
  body: JSON.stringify({
    username: "alice",
    password: userPassword, // Your server will hash this
    accountID: accountID,
    accountSecret: accountSecret, // Your server will ENCRYPT this with password
  })
});

// Login Flow
const username = prompt("Username");
const password = prompt("Password");

// Ask YOUR server for the secret
const response = await fetch('/api/login', {
  method: 'POST',
  body: JSON.stringify({ username, password })
});

const { accountID, accountSecret } = await response.json();

// Now login with cojson
const node = await LocalNode.withLoadedAccount({ accountID, accountSecret, ... });
```

**How Your Server Handles This:**

```javascript
// Sign Up (server-side)
app.post('/api/signup', async (req, res) => {
  const { username, password, accountID, accountSecret } = req.body;
  
  // 1. Hash password (for verification)
  const passwordHash = await bcrypt.hash(password, 10);
  
  // 2. Encrypt accountSecret with password-derived key
  const encryptedSecret = await encrypt(accountSecret, password);
  
  // 3. Store in database
  await db.users.insert({
    username,
    passwordHash,
    accountID,
    encryptedAccountSecret: encryptedSecret
  });
  
  res.json({ success: true });
});

// Login (server-side)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // 1. Get user from database
  const user = await db.users.findOne({ username });
  
  // 2. Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return res.status(401).json({ error: "Invalid password" });
  
  // 3. Decrypt accountSecret with password
  const accountSecret = await decrypt(user.encryptedAccountSecret, password);
  
  // 4. Send back to client
  res.json({ accountID: user.accountID, accountSecret });
});
```

**Pros:**
- ✅ Works across devices (username/password)
- ✅ Can reset password (re-encrypt secret with new password)
- ✅ More secure (secret encrypted, not plaintext)

**Cons:**
- ⚠️ Requires server
- ⚠️ Server sees the accountSecret (briefly, in memory)
- ⚠️ Single point of failure (if server hacked, all secrets at risk)

**Good for:** Multi-device apps, when you need password-based auth

---

#### Option 3: Passkey/WebAuthn (Most Secure)

```javascript
// Sign Up
const { accountID, accountSecret } = await LocalNode.withNewlyCreatedAccount({...});

// User creates passkey (fingerprint, face ID, hardware key)
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: "Your App" },
    user: {
      id: new TextEncoder().encode(accountID),
      name: "alice",
      displayName: "Alice",
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
  }
});

// Encrypt accountSecret with passkey
const encryptedSecret = await encryptWithPasskey(accountSecret, credential);

// Store in YOUR storage (localStorage, server, etc.)
localStorage.setItem('accountID', accountID);
localStorage.setItem('encryptedSecret', encryptedSecret);

// Login
const accountID = localStorage.getItem('accountID');
const encryptedSecret = localStorage.getItem('encryptedSecret');

// User authenticates with passkey
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [{ id: credential.rawId, type: "public-key" }],
  }
});

// Decrypt secret with passkey
const accountSecret = await decryptWithPasskey(encryptedSecret, assertion);

// Login with cojson
const node = await LocalNode.withLoadedAccount({ accountID, accountSecret, ... });
```

**Pros:**
- ✅ Most secure (uses hardware-backed keys)
- ✅ No passwords to remember
- ✅ Phishing-resistant
- ✅ Works across devices (with passkey sync)

**Cons:**
- ⚠️ More complex to implement
- ⚠️ Not all devices support it (yet)
- ⚠️ Requires HTTPS

**Good for:** Security-critical apps, modern apps targeting latest browsers

---

#### Option 4: Mobile - Secure Enclave / Keychain

```javascript
// iOS/Android - Use platform secure storage

// Sign Up (React Native example)
import * as SecureStore from 'expo-secure-store';

const { accountID, accountSecret } = await LocalNode.withNewlyCreatedAccount({...});

// Store in OS keychain (encrypted by OS)
await SecureStore.setItemAsync('accountID', accountID);
await SecureStore.setItemAsync('accountSecret', accountSecret);

// Login
const accountID = await SecureStore.getItemAsync('accountID');
const accountSecret = await SecureStore.getItemAsync('accountSecret');

const node = await LocalNode.withLoadedAccount({ accountID, accountSecret, ... });
```

**Pros:**
- ✅ Very secure (OS-level encryption)
- ✅ Can use biometric unlock (Face ID, fingerprint)
- ✅ Simple API

**Cons:**
- ⚠️ Platform-specific
- ⚠️ Tied to device (unless using cloud keychain)

**Good for:** Mobile apps (iOS, Android)

---

## Part 4: Storage API - Your Data Storage

### What is the Storage API?

The `StorageAPI` is cojson's way of saving **transaction data** (your actual CoValues, changes, etc.) - NOT account secrets!

```javascript
const node = await LocalNode.withNewlyCreatedAccount({
  crypto: Crypto,
  storage: myStorageImplementation, // ← YOUR storage!
  creationProps: { name: "Alice" }
});
```

**What it stores:**
- ✅ CoValue transactions (changes to maps, lists, etc.)
- ✅ Group membership data
- ✅ Encrypted content
- ❌ **NOT your account secret** (that's YOUR job!)

### Storage Options (cojson Supports)

#### 1. IndexedDB (Browser)

```javascript
import { IDBStorage } from 'cojson-storage-indexeddb';

const storage = new IDBStorage('my-app-db');

const node = await LocalNode.withNewlyCreatedAccount({
  crypto: Crypto,
  storage: storage, // Browser database
  ...
});
```

**Stores:** All your CoValue data in the browser

---

#### 2. SQLite (Server / Desktop)

```javascript
import { SQLiteStorage } from 'cojson-storage-sqlite';

const storage = new SQLiteStorage('./data.db');

const node = await LocalNode.withNewlyCreatedAccount({
  crypto: Crypto,
  storage: storage, // Local database file
  ...
});
```

**Stores:** All your CoValue data in a file

---

#### 3. No Storage (In-Memory Only)

```javascript
const node = await LocalNode.withNewlyCreatedAccount({
  crypto: Crypto,
  storage: undefined, // No persistence!
  ...
});
```

**Stores:** Nothing! Data is lost when you close the app.

**Use case:** Testing, temporary sessions

---

## Part 5: The Complete Picture

```
┌──────────────────────────────────────────────────────────────────┐
│                         YOUR APP                                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓
      ┌───────────────────────┴───────────────────────┐
      ↓                                               ↓
┌──────────────────────┐                 ┌──────────────────────┐
│ ACCOUNT SECRETS      │                 │ CoValue DATA         │
│ (Your Responsibility)│                 │ (Storage API)        │
└──────────────────────┘                 └──────────────────────┘
      ↓                                               ↓
  Where YOU store:                        Where cojson stores:
  • accountSecret                         • Transactions
  • accountID                             • CoValue headers
                                         • Encrypted changes
  Your choices:                          • Group membership
  • localStorage
  • Server (encrypted)                    cojson choices:
  • Passkey                               • IndexedDB
  • Keychain                              • SQLite
  • Hardware key                          • PostgreSQL
                                         • Custom implementation
```

---

## Part 6: Common Patterns

### Pattern 1: Quick Start (localStorage)

**Best for:** Prototypes, personal apps

```javascript
// Sign Up
async function signUp(name) {
  const { node, accountID, accountSecret } = 
    await LocalNode.withNewlyCreatedAccount({
      crypto: Crypto,
      creationProps: { name }
    });
  
  // Store secrets
  localStorage.setItem('accountID', accountID);
  localStorage.setItem('accountSecret', accountSecret);
  
  return node;
}

// Login
async function login() {
  const accountID = localStorage.getItem('accountID');
  const accountSecret = localStorage.getItem('accountSecret');
  
  if (!accountID || !accountSecret) {
    throw new Error('Not signed up yet!');
  }
  
  const node = await LocalNode.withLoadedAccount({
    crypto: Crypto,
    accountID,
    accountSecret,
    sessionID: Crypto.newRandomSessionID(accountID),
    peers: [],
  });
  
  return node;
}

// Check if logged in
function isLoggedIn() {
  return localStorage.getItem('accountID') !== null;
}

// Logout
function logout() {
  localStorage.removeItem('accountID');
  localStorage.removeItem('accountSecret');
}
```

---

### Pattern 2: Server-Based Auth (Password)

**Best for:** Multi-device apps

```javascript
// Sign Up
async function signUp(username, password) {
  // 1. Create cojson account
  const { node, accountID, accountSecret } = 
    await LocalNode.withNewlyCreatedAccount({
      crypto: Crypto,
      creationProps: { name: username }
    });
  
  // 2. Send to YOUR server
  await fetch('/api/signup', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      accountID,
      accountSecret // Server will encrypt this!
    })
  });
  
  // 3. Store in session (optional)
  sessionStorage.setItem('accountID', accountID);
  sessionStorage.setItem('accountSecret', accountSecret);
  
  return node;
}

// Login
async function login(username, password) {
  // 1. Ask YOUR server for encrypted secret
  const response = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  
  const { accountID, accountSecret } = await response.json();
  
  // 2. Login with cojson
  const node = await LocalNode.withLoadedAccount({
    crypto: Crypto,
    accountID,
    accountSecret,
    sessionID: Crypto.newRandomSessionID(accountID),
    peers: [],
  });
  
  // 3. Store in session
  sessionStorage.setItem('accountID', accountID);
  sessionStorage.setItem('accountSecret', accountSecret);
  
  return node;
}
```

---

### Pattern 3: Anonymous Accounts (No Storage)

**Best for:** Guest mode, temporary sessions

```javascript
async function createGuestAccount() {
  const { node } = await LocalNode.withNewlyCreatedAccount({
    crypto: Crypto,
    creationProps: { name: "Guest" },
    storage: undefined // No persistence!
  });
  
  // Don't store anything - account is temporary
  return node;
}
```

---

## Part 7: Security Best Practices

### DO ✅

1. **Encrypt secrets before storing** (except in OS keychain)
2. **Use HTTPS** for all network communication
3. **Clear secrets on logout** (from memory and storage)
4. **Rate-limit login attempts** (if using server auth)
5. **Use hardware-backed keys** when possible (passkeys, secure enclave)
6. **Warn users** that losing their secret means losing access forever

### DON'T ❌

1. **Don't store secrets in plaintext** (unless localStorage for simple apps)
2. **Don't log secrets** to console or error tracking
3. **Don't send secrets over HTTP** (only HTTPS!)
4. **Don't assume you can "recover" lost secrets** (you can't!)
5. **Don't reuse the same secret** across different apps
6. **Don't store secrets in URLs** or query parameters

---

## Summary: The 3 Key Points

### 1. cojson Doesn't Do Auth

**cojson provides:**
- ✅ Crypto primitives (signing, encryption)
- ✅ Account creation (`withNewlyCreatedAccount`)
- ✅ Account loading (`withLoadedAccount`)

**YOU provide:**
- ⚠️ Where to store account secrets
- ⚠️ How users prove identity (password, biometric, etc.)
- ⚠️ Multi-device sync strategy (if needed)

### 2. Account Secret = Your Identity

```
accountSecret = The key to your entire account
              = Cannot be recovered if lost
              = Full access to everything if stolen
```

**Treat it like:**
- Your master password
- Your private key (because it is!)
- Your house key (but way more valuable)

### 3. You Have Options

**Simple:**
- localStorage (plaintext)
- Good for: Prototypes, personal apps

**Secure:**
- Server + password (encrypted)
- Good for: Multi-device apps

**Most Secure:**
- Passkeys / Hardware keys
- Good for: Security-critical apps

**Mobile:**
- OS Keychain / Secure Enclave
- Good for: iOS/Android apps

---

## References

- `libs/maia-db/node_modules/cojson/src/localNode.ts` - Account creation/loading
- `libs/maia-db/node_modules/cojson/src/crypto/crypto.ts` - AgentSecret generation
- `libs/maia-db/node_modules/cojson/src/storage/` - Storage API implementations
