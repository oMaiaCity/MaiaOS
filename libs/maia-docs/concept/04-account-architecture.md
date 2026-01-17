# PRF-Jazz Universal Wallet Architecture
## Passkey-Based Multi-Chain Identity for Maia City

**Version:** 1.0  
**Date:** January 2026  
**Author:** Samuel (Maia City)

---

## Executive Summary

This architecture replaces Jazz's insecure localStorage-based account storage with a **hardware-backed, passkey-derived key system** that provides:

- ✅ **Zero localStorage secrets** (XSS-resistant)
- ✅ **Biometric protection** (Face ID / Touch ID)
- ✅ **Automatic cloud backup** via Apple/Google passkey sync
- ✅ **Multi-chain support** (Jazz/Ethereum/Solana from ONE passkey)
- ✅ **Password manager** (double-encrypted vault)
- ✅ **No seed phrases** (UX improvement)

**Core Innovation:** WebAuthn PRF Extension derives all cryptographic keys deterministically from a single hardware-protected passkey, eliminating the need to store secrets in browser storage.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Security Model](#security-model)
3. [Account Lifecycle](#account-lifecycle)
4. [Multi-Chain Key Derivation](#multi-chain-key-derivation)
5. [Recovery & Backup Strategy](#recovery--backup-strategy)
6. [Integration with Jazz CoJSON](#integration-with-jazz-cojson)
7. [Password Manager: Direct CoValue Storage](#password-manager-direct-covalue-storage)
8. [Platform Compatibility](#platform-compatibility)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Critical Dependencies](#critical-dependencies)

---

## Architecture Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      MAIA CITY APPLICATION                       │
│              (Password Manager + Jazz Sync + Web3)               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  UNIVERSAL PASSKEY WALLET                        │
│                     (jazz-tools-prf fork)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │   Passkey    │──▶│ Key Manager  │──▶│   Adapters   │       │
│  │     PRF      │   │    (HKDF)    │   │              │       │
│  │ Authenticator│   │              │   │ Jazz/EVM/Sol │       │
│  └──────────────┘   └──────────────┘   └──────────────┘       │
│                                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PLATFORM LAYER                              │
├──────────────────┬──────────────────┬──────────────────────────┤
│   WebAuthn API   │   Web Crypto API │   Jazz CoJSON            │
│   (Browser)      │   (HKDF/Ed25519) │   (Unmodified)           │
└────────┬─────────┴────────┬─────────┴────────┬─────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────┐
│              DEVICE SECURE ENCLAVE / TPM                      │
│  • Passkey Private Key (NEVER extractable)                   │
│  • PRF Secret (NEVER extractable)                            │
│  • Biometric Templates (Face ID / Touch ID)                  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  CLOUD BACKUP (Apple iCloud / Google Password Mgr)    │  │
│  │  • End-to-end encrypted passkey sync                   │  │
│  │  • Cross-device automatic recovery ✅                  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Maia City Application**
- User interface for password management
- Jazz CoValue CRUD operations (passwords stored as CoMaps)
- Ethereum transaction signing
- Multi-chain wallet UI

**Universal Passkey Wallet (jazz-tools-prf)**
- Passkey creation & authentication via WebAuthn
- PRF-based key derivation (HKDF)
- Multi-chain key generation (Jazz/Ethereum/Solana)
- Jazz Account interface adapter

**Platform Layer**
- WebAuthn API: Passkey management & PRF evaluation
- Web Crypto API: HKDF, Ed25519, secp256k1 operations
- Jazz CoJSON: Unmodified sync & encryption layer

**Secure Enclave**
- Hardware-protected key storage
- Biometric authentication
- PRF secret material (never leaves hardware)
- Cloud backup via vendor-native sync
---

## Security Model

### Three-Layer Defense Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: HARDWARE SECURITY (Secure Enclave / TPM)              │
├─────────────────────────────────────────────────────────────────┤
│  • Passkey private key (NEVER extractable)                      │
│  • PRF secret material (NEVER extractable)                      │
│  • Biometric templates (Face ID / Touch ID)                     │
│  • All operations happen INSIDE hardware                        │
│  • Only output (PRF result) exits enclave                       │
│                                                                  │
│  Security Guarantee:                                             │
│  → Physical device compromise: SAFE (needs biometric)           │
│  → XSS attack: SAFE (no secrets in browser)                     │
│  → Malware: SAFE (hardware-isolated)                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: EPHEMERAL MEMORY (Browser Runtime)                    │
├─────────────────────────────────────────────────────────────────┤
│  • Jazz Account Ed25519 keypair (exists only during session)    │
│  • EVM secp256k1 keypair (exists only during session)           │
│  • PRF output (used immediately, then wiped)                    │
│                                                                  │
│  Security Guarantee:                                             │
│  → Tab close: ALL secrets wiped automatically                   │
│  → XSS during session: Can use keys, but can't extract          │
│  → Next session: Requires new biometric auth                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: PERSISTENT STORAGE (localStorage / IndexedDB)         │
├─────────────────────────────────────────────────────────────────┤
│  • Jazz public key (PUBLIC - safe to expose)                    │
│  • Passkey credential ID (PUBLIC - useless without device)      │
│  • PRF salt (PUBLIC - useless without passkey)                  │
│  • Jazz CoValues (ENCRYPTED by Jazz with group keys)            │
│                                                                  │
│  Security Guarantee:                                             │
│  → XSS reads everything: Gets NO secrets ✅                     │
│  → Malicious extension: Gets NO secrets ✅                      │
│  → Database export: Useless without biometric unlock ✅         │
└─────────────────────────────────────────────────────────────────┘
```

### Threat Model Coverage

| Attack Vector | Standard Jazz | PRF-Jazz | Protection Method |
|---------------|---------------|----------|-------------------|
| **XSS Attack** | ❌ Game Over | ⚠️ Session Only | Hardware boundary |
| **localStorage Read** | ❌ Keys Stolen | ✅ Public Data Only | No secrets stored |
| **Device Theft** | ❌ Keys Exposed | ✅ Locked | Biometric required |
| **Malware** | ❌ Keys Logged | ✅ Protected | Secure Enclave |
| **Server Compromise** | ✅ E2EE | ✅ E2EE | Jazz encryption |
| **Supply Chain** | ❌ Vulnerable | ⚠️ Session Only | Hardware boundary |

---

## Account Lifecycle

### 1. Account Creation (Registration)

```
┌─────────┐
│  USER   │ 1. Clicks "Create Account"
└────┬────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 1: Generate PRF Salt                                   │
│  salt = crypto.getRandomValues(32 bytes)                     │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 2: Create Passkey with PRF Extension                   │
│                                                               │
│  credential = navigator.credentials.create({                 │
│    publicKey: {                                              │
│      challenge: random(32),                                  │
│      user: { id: salt, name: "user@maia.city" },            │
│      authenticatorSelection: {                               │
│        residentKey: "required",  ← Sync to cloud!           │
│        userVerification: "required"                          │
│      },                                                       │
│      extensions: { prf: {} }  ← Enable PRF!                 │
│    }                                                          │
│  })                                                           │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 3: Secure Enclave Creates Keys                         │
│                                                               │
│  • Generate ECDSA keypair (for WebAuthn)                     │
│  • Generate PRF secret material                              │
│  • Store in hardware (NEVER extractable)                     │
│  • Require biometric enrollment                              │
│  • Sync to iCloud/Google (encrypted)  ← BACKUP!            │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 4: Evaluate PRF (First Time)                           │
│                                                               │
│  assertion = navigator.credentials.get({                     │
│    extensions: {                                             │
│      prf: { eval: { first: salt } }                         │
│    }                                                          │
│  })                                                           │
│                                                               │
│  prfOutput = assertion.getClientExtensionResults()           │
│    .prf.results.first  ← 32 bytes, deterministic!           │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 5: Derive All Keys via HKDF                            │
│                                                               │
│  masterKey = prfOutput (32 bytes)                            │
│                                                               │
│  jazzSeed = HKDF(masterKey, "maia-jazz-account-v1")         │
│  evmSeed  = HKDF(masterKey, "maia-evm-wallet-v1")           │
│  solSeed  = HKDF(masterKey, "maia-solana-wallet-v1")        │
│                                                               │
│  jazzKeypair = Ed25519.generate(jazzSeed)                    │
│  evmKeypair  = secp256k1.generate(evmSeed)                  │
│  solKeypair  = Ed25519.generate(solSeed)                    │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 6: Store PUBLIC Data Only                              │
│                                                               │
│  localStorage.setItem("maia-account", {                      │
│    jazzPublicKey: base64(jazzKeypair.public),               │
│    evmAddress: ethAddress(evmKeypair.public),               │
│    solanaAddress: solAddress(solKeypair.public),            │
│    credentialId: credential.id,                              │
│    prfSalt: base64(salt),                                    │
│    username: "user@maia.city"                                │
│  })                                                           │
│                                                               │
│  ⚠️ NO SECRET KEYS STORED! ⚠️                               │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  DONE: Account Created & Backed Up to Cloud ✅               │
│                                                               │
│  User can now:                                               │
│  • Sign Jazz transactions                                    │
│  • Sign Ethereum transactions                                │
│  • Store passwords in Jazz CoValues                          │
│  • Recover on any device with synced passkey                 │
└──────────────────────────────────────────────────────────────┘
```

### 2. Account Unlock (Login)

```
┌─────────┐
│  USER   │ 1. Opens Maia City App
└────┬────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 1: Load Public Account Info                            │
│                                                               │
│  accountData = localStorage.getItem("maia-account")          │
│  { credentialId, prfSalt, jazzPublicKey, ... }              │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 2: Request PRF Evaluation                              │
│                                                               │
│  assertion = navigator.credentials.get({                     │
│    allowCredentials: [{ id: credentialId }],                │
│    extensions: {                                             │
│      prf: { eval: { first: prfSalt } }                      │
│    }                                                          │
│  })                                                           │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 3: User Provides Biometric                             │
│                                                               │
│  [Face ID] / [Touch ID] / [Fingerprint]                     │
│                                                               │
│  → Secure Enclave verifies biometric                         │
│  → Unlocks passkey private key                               │
│  → Computes PRF(salt)                                        │
│  → Returns identical 32 bytes as creation! ✅               │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 4: Re-derive ALL Keys (Deterministic!)                │
│                                                               │
│  prfOutput = assertion.getClientExtensionResults()           │
│    .prf.results.first                                        │
│                                                               │
│  Same HKDF as creation:                                      │
│  jazzSeed = HKDF(prfOutput, "maia-jazz-account-v1")         │
│  evmSeed  = HKDF(prfOutput, "maia-evm-wallet-v1")           │
│                                                               │
│  → Generates IDENTICAL keypairs! ✅                          │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 5: Verify Public Key Matches                           │
│                                                               │
│  assert(jazzKeypair.public == accountData.jazzPublicKey)    │
│                                                               │
│  If match: Account unlocked! ✅                              │
│  If mismatch: Wrong passkey / corrupted data ❌             │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  DONE: Account Unlocked (Until Tab Close)                   │
│                                                               │
│  Secret keys exist in memory only:                           │
│  • jazzKeypair.secret (for Jazz signing)                    │
│  • evmKeypair.private (for Ethereum signing)                │
│  • Wiped automatically on tab close                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Multi-Chain Key Derivation

### Deterministic Key Tree from Single Passkey

```
                         Passkey + PRF Salt
                                │
                                │ PRF Evaluation (in Secure Enclave)
                                ▼
                         Master Key (32 bytes)
                         [Deterministic Output]
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        │                       │                       │
   HKDF("jazz")           HKDF("evm")            HKDF("solana")
        │                       │                       │
        ▼                       ▼                       ▼
   Jazz Seed              EVM Seed               Solana Seed
   (32 bytes)            (32 bytes)              (32 bytes)
        │                       │                       │
        ▼                       ▼                       ▼
   Ed25519                 secp256k1              Ed25519
   Generate                Generate               Generate
        │                       │                       │
        ▼                       ▼                       │
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Jazz Account │      │   Ethereum   │      │   Solana     │
│              │      │    Wallet    │      │   Wallet     │
│ Public Key:  │      │              │      │              │
│ ed25519:ABC  │      │ Address:     │      │ Address:     │
│              │      │ 0x1234...    │      │ Sol1234...   │
│              │      │              │      │              │
│ Secret Key:  │      │ Private Key: │      │ Private Key: │
│ [IN MEMORY]  │      │ [IN MEMORY]  │      │ [IN MEMORY]  │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                      │
       ▼                     ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Maia City    │      │  Ethereum    │      │   Solana     │
│ Password Mgr │      │  DeFi Apps   │      │   DeFi Apps  │
│ Jazz CoValues│      │  NFTs        │      │   NFTs       │
└──────────────┘      └──────────────┘      └──────────────┘
```

### Context Strings for HKDF

All derived keys use versioned context strings to enable future key rotation:

| Purpose | Context String | Output Length | Algorithm |
|---------|---------------|---------------|-----------|
| Jazz Account | `maia-jazz-account-v1` | 32 bytes | Ed25519 seed |
| Ethereum Wallet | `maia-evm-wallet-v1` | 32 bytes | secp256k1 seed |
| Solana Wallet | `maia-solana-wallet-v1` | 32 bytes | Ed25519 seed |
| Bitcoin Wallet | `maia-bitcoin-wallet-v1` | 32 bytes | secp256k1 seed |
| Backup Encryption | `maia-backup-key-v1` | 32 bytes | AES-256 key |

**Future-Proof:** Increment version (v2, v3) for key rotation without breaking existing derivations.

---

## Recovery & Backup Strategy

### ⚠️ CRITICAL: 100% Reliance on Platform Passkey Sync

**YES, we are completely piggybacking on Apple/Google passkey cloud sync for recovery!**

```
┌─────────────────────────────────────────────────────────────────┐
│              RECOVERY DEPENDENCY ANALYSIS                        │
└─────────────────────────────────────────────────────────────────┘

What Gets Backed Up:
├─ Passkey private key  → iCloud Keychain / Google Password Manager
├─ PRF secret material  → iCloud Keychain / Google Password Manager
├─ Passkey metadata     → iCloud Keychain / Google Password Manager
└─ Biometric templates  → Device-local (re-enrolled on new device)

What Does NOT Get Backed Up Automatically:
├─ PRF Salt             → Stored in localStorage (NEEDS sync!)
├─ Jazz public key      → Stored in localStorage (NEEDS sync!)
├─ Jazz CoValues        → Synced via Jazz mesh (separate system)
└─ Ethereum addresses   → Derived (reconstructed from passkey)

CRITICAL RECOVERY REQUIREMENTS:
1. User must have iCloud/Google account signed in
2. User must enable passkey sync in OS settings
3. New device must authenticate to same iCloud/Google account
4. PRF salt must be retrievable (localStorage or Jazz sync)
```

### Platform-Specific Backup Mechanisms

**iOS/macOS (iCloud Keychain):**
```
User's iPhone/Mac
       │
       │ Passkey created with residentKey: "required"
       ▼
┌──────────────────────────────────────┐
│  iOS Secure Enclave                  │
│  • Passkey stored                    │
│  • PRF secret stored                 │
└────────┬─────────────────────────────┘
         │
         │ Automatic sync (encrypted end-to-end)
         ▼
┌──────────────────────────────────────┐
│  Apple iCloud Keychain               │
│  • End-to-end encrypted              │
│  • Zero-knowledge (Apple can't read) │
│  • Multi-device sync                 │
└────────┬─────────────────────────────┘
         │
         │ User logs into new iPad with same Apple ID
         ▼
┌──────────────────────────────────────┐
│  iPad Secure Enclave                 │
│  • Passkey synced                    │
│  • PRF secret synced                 │
│  • Biometric re-enrolled (Face ID)   │
└──────────────────────────────────────┘
         │
         │ Load PRF salt from localStorage or Jazz
         ▼
┌──────────────────────────────────────┐
│  PRF Evaluation                      │
│  PRF(passkey, salt) = SAME OUTPUT!  │
│  → Derives SAME Jazz account ✅      │
│  → Derives SAME Ethereum wallet ✅   │
└──────────────────────────────────────┘
```

**Android (Google Password Manager):**
```
Similar flow:
Google Password Manager → Cloud sync → New Android device
```

### Recovery Scenarios

#### ✅ Scenario 1: Lost Device (iCloud/Google Enabled)

**Problem:** User loses iPhone  
**Solution:**
1. User buys new iPhone
2. Signs into Apple ID during setup
3. Passkey automatically syncs from iCloud
4. User opens Maia City app
5. PRF salt retrieved from Jazz mesh or localStorage backup
6. Biometric re-enrolled (new Face ID)
7. PRF evaluation works → ALL keys recovered! ✅

**Success Rate:** ~95% (depends on iCloud sync being enabled)

#### ⚠️ Scenario 2: No Cloud Sync Enabled

**Problem:** User created passkey but disabled iCloud Keychain  
**Solution:** **UNRECOVERABLE** 

**Mitigation:**
- Detect iCloud/Google sync status during account creation
- FORCE user to enable sync before continuing
- Show scary warning about data loss
- Provide backup codes as fallback (see below)

#### ✅ Scenario 3: Multiple Devices

**Problem:** User has iPhone + iPad + Mac  
**Solution:**
- Passkey syncs to all devices automatically
- Any device can unlock account
- All devices share same PRF salt (via Jazz sync or localStorage)
- Seamless multi-device experience ✅

#### 🔄 Scenario 4: Cross-Platform Migration (iOS → Android)

**Problem:** User switches from iPhone to Android  
**Solution:** **NOT SUPPORTED by passkey sync!**

**Workaround Options:**

**Option A: Backup Codes (Recommended)**
```
During account creation:
1. Derive backup key: HKDF(prfOutput, "maia-backup-v1")
2. Generate 12-word BIP39 mnemonic from backup key
3. Encrypt Jazz account secret with backup key
4. User writes down 12 words
5. Store encrypted account in Jazz CoValue

Recovery on Android:
1. User enters 12-word backup code
2. Derive backup key from mnemonic
3. Decrypt Jazz account secret
4. Create NEW passkey on Android
5. Re-encrypt account with new PRF
```

**Option B: Temporary Password Export**
```
iOS App:
1. User requests "Export for Android"
2. Unlock with Face ID
3. Generate temporary password
4. Encrypt account bundle with password
5. Upload to Jazz mesh with expiry (24h)

Android App:
1. User enters temporary password
2. Download encrypted bundle from Jazz
3. Decrypt with password
4. Create NEW passkey on Android
5. Delete bundle after import
```

**Option C: Multi-Platform Passkey (Future)**
```
Wait for FIDO Alliance cross-platform passkey sync
(Announced but not yet implemented Jan 2026)
```

### Recommended Recovery Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   MAIA CITY RECOVERY STRATEGY                    │
└─────────────────────────────────────────────────────────────────┘

PRIMARY: Passkey Cloud Sync (Zero-friction)
├─ iOS/macOS: iCloud Keychain (automatic)
├─ Android: Google Password Manager (automatic)
└─ Success Rate: 95% (if user has sync enabled)

SECONDARY: Backup Codes (Manual, secure)
├─ 12-word BIP39 mnemonic
├─ Generated during account creation
├─ User must write down and store safely
└─ Success Rate: 100% (if user doesn't lose paper)

TERTIARY: Account Recovery Service (Experimental)
├─ Social recovery (3-of-5 friends)
├─ Time-locked recovery (7 day delay)
├─ Email + SMS verification
└─ Success Rate: ~80% (if contacts respond)

LAST RESORT: Create New Account
├─ Old account data lost
├─ Jazz CoValues unrecoverable (without key)
└─ User starts fresh
```

### Implementation Requirements

**Account Creation Flow:**
```typescript
async function createAccount(username: string) {
  // 1. Check cloud sync status
  const hasSyncEnabled = await checkCloudSync();
  
  if (!hasSyncEnabled) {
    throw new Error(
      "⚠️ CRITICAL: Enable iCloud Keychain (iOS) or " +
      "Google Password Manager (Android) before continuing. " +
      "Without cloud sync, you WILL lose access if you lose this device!"
    );
  }
  
  // 2. Create passkey with resident key (syncs to cloud)
  const credential = await navigator.credentials.create({
    publicKey: {
      authenticatorSelection: {
        residentKey: "required",  // ← Forces cloud sync!
        userVerification: "required"
      },
      extensions: { prf: {} }
    }
  });
  
  // 3. Generate backup code
  const backupMnemonic = await generateBackupCode(prfOutput);
  
  // 4. Show backup code to user (MUST write down)
  await showBackupCodeUI(backupMnemonic);
  
  // 5. Store encrypted backup in Jazz
  await storeEncryptedBackup(backupMnemonic);
  
  // 6. Store PRF salt in BOTH localStorage AND Jazz
  localStorage.setItem("maia-prf-salt", salt);
  await jazzAccount.saltBackup.set(salt);  // Redundant storage
  
  return { account, backupMnemonic };
}
```

### Backup Code Security

**12-Word Mnemonic Example:**
```
abandon ability able about above absent absorb abstract absurd abuse access accident
```

**Derivation:**
```
PRF Output (32 bytes)
    ↓ HKDF("maia-backup-v1")
Backup Seed (32 bytes)
    ↓ BIP39 Encoding
12-Word Mnemonic
    ↓ User writes down
Paper Backup
    ↓ Safe storage (drawer, safe)
Recovery Possible! ✅
```

**Recovery with Backup Code:**
```typescript
async function recoverFromBackupCode(mnemonic: string) {
  // 1. Validate mnemonic
  const isValid = validateBIP39(mnemonic);
  if (!isValid) throw new Error("Invalid backup code");
  
  // 2. Derive backup seed
  const backupSeed = mnemonicToSeed(mnemonic);
  
  // 3. Fetch encrypted account from Jazz
  const encryptedAccount = await fetchFromJazz();
  
  // 4. Decrypt Jazz account secret
  const jazzSecret = await decrypt(encryptedAccount, backupSeed);
  
  // 5. Create NEW passkey on current device
  const newPasskey = await createNewPasskey();
  
  // 6. Re-encrypt account with NEW PRF
  const newPrfOutput = await evaluatePRF(newPasskey);
  const reencrypted = await encrypt(jazzSecret, newPrfOutput);
  
  // 7. Store updated account
  await updateJazzAccount(reencrypted);
  
  return { recovered: true, newPasskey };
}
```

---

## Integration with Jazz CoJSON

### Jazz Remains Completely Unmodified

**Critical Design Principle:** We do NOT fork Jazz CoJSON itself, only the account creation mechanism.

```
┌─────────────────────────────────────────────────────────────────┐
│                     JAZZ ARCHITECTURE LAYERS                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  Application Layer (Maia City)           │
│  • Password Manager UI                   │
│  • Ethereum Wallet UI                    │
│  • Uses Jazz React hooks                 │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  Jazz-Tools-PRF (FORK)                   │  ← OUR ADDITION
│  • PasskeyPRFAccount                     │
│  • Implements Account interface          │
│  • HKDF key derivation                   │
└────────────┬─────────────────────────────┘
             │
             │ Provides Account interface:
             │ • sign(message) → signature
             │ • getPublicKey() → publicKey
             │
             ▼
┌──────────────────────────────────────────┐
│  Jazz-Tools (UNMODIFIED)                 │
│  • React Provider                        │
│  • Hooks (useAccount, useCoState)        │
│  • CoValue CRUD operations               │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  Jazz CoJSON (UNMODIFIED)                │
│  • CRDT operations                       │
│  • Encryption/Decryption                 │
│  • Mesh sync protocol                    │
│  • Transaction signing                   │
│  • BLAKE3 content addressing             │
└──────────────────────────────────────────┘
```

### Account Interface Adapter

```typescript
// PRF-based account implements Jazz's Account interface
interface JazzAccount {
  sign(message: Uint8Array): Promise<Uint8Array>;
  getPublicKey(): Uint8Array;
  // ... other methods
}

class PasskeyPRFAccount implements JazzAccount {
  private jazzKeypair: Ed25519Keypair | null = null;
  
  async sign(message: Uint8Array): Promise<Uint8Array> {
    if (!this.jazzKeypair) {
      throw new Error("Account locked - call unlock() first");
    }
    
    // Standard Ed25519 signing (Jazz expects this)
    return await ed25519.sign(message, this.jazzKeypair.secretKey);
  }
  
  getPublicKey(): Uint8Array {
    if (!this.jazzKeypair) {
      throw new Error("Account locked");
    }
    return this.jazzKeypair.publicKey;
  }
  
  // PRF-specific methods
  async unlock(): Promise<void> {
    const prfOutput = await this.evaluatePRF();
    const jazzSeed = await hkdf(prfOutput, 32, "maia-jazz-account-v1");
    this.jazzKeypair = await generateEd25519(jazzSeed);
  }
  
  async evaluatePRF(): Promise<Uint8Array> {
    const assertion = await navigator.credentials.get({
      publicKey: {
        extensions: {
          prf: { eval: { first: this.prfSalt } }
        }
      }
    });
    
    return new Uint8Array(
      assertion.getClientExtensionResults().prf.results.first
    );
  }
}
```

### Jazz CoValue Encryption Flow

**Jazz's built-in encryption is SUFFICIENT - no additional vault layer needed!**

```
┌─────────────────────────────────────────────────────────────────┐
│              PASSWORD STORAGE (Single Encryption Layer)          │
└─────────────────────────────────────────────────────────────────┘

User saves password:
┌─────────┐
│  USER   │ "Save: github.com / samuel / hunter2"
└────┬────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│  Maia City Password Manager                                   │
│                                                               │
│  PasswordEntry.create({                                      │
│    site: "github.com",                                       │
│    username: "samuel",                                       │
│    password: "hunter2",  ← PLAINTEXT in CoValue!            │
│    createdAt: Date.now()                                     │
│  }, prfJazzAccount)                                          │
└─────────┬────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│  Jazz CoJSON Encryption (Automatic!)                         │
│                                                               │
│  • Jazz encrypts with group read key                         │
│  • Uses XSalsa20 stream cipher                               │
│  • Content addressing with BLAKE3                            │
│  • Signed with Ed25519 (PRF-derived key)                     │
│                                                               │
│  encryptedData = XSalsa20(                                   │
│    plaintext: { site, username, password },                 │
│    key: groupReadKey                                         │
│  )                                                            │
└─────────┬────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│  Jazz Mesh Sync                                               │
│                                                               │
│  Server receives:                                            │
│  • Encrypted CoValue ✅                                      │
│  • Ed25519 signature ✅                                      │
│  • BLAKE3 content hash ✅                                    │
│                                                               │
│  Server CANNOT:                                              │
│  • Decrypt password (no group key)                           │
│  • Derive group key (no Jazz account)                        │
│  • Unlock Jazz account (no PRF access)                       │
│  • Impersonate user (no private key)                         │
└──────────────────────────────────────────────────────────────┘

SECURITY CHAIN:
1. Password stored in Jazz CoValue (encrypted by Jazz)
2. Jazz account locked by PRF (hardware-protected)
3. PRF locked by biometric (Secure Enclave)

NO ADDITIONAL VAULT ENCRYPTION NEEDED! ✅
```

### Why No Separate Vault Layer?

**Previously (Standard Jazz):**
```
localStorage: jazzAccountSecret (PLAIN TEXT) ❌
    → XSS attack gets account secret
    → Attacker decrypts ALL Jazz CoValues
    → NEED separate vault encryption as defense-in-depth
```

**Now (PRF-Jazz):**
```
localStorage: jazzPublicKey + credentialId + salt (ALL PUBLIC) ✅
    → XSS attack gets... nothing useful
    → Can't unlock Jazz account (needs biometric)
    → Can't decrypt CoValues (needs Jazz account)
    → Separate vault encryption is REDUNDANT
```

**Conclusion:** Jazz's native encryption is SUFFICIENT when the account key itself is PRF-protected!

---

## Password Manager: Direct CoValue Storage

### Simplified Architecture (No Vault Layer)

```
┌─────────────────────────────────────────────────────────────────┐
│                MAIA CITY PASSWORD MANAGER                        │
│                  (Direct Jazz CoValue Storage)                   │
└─────────────────────────────────────────────────────────────────┘

CoValue Schema:
┌──────────────────────────────────────┐
│  PasswordEntry (CoMap)               │
├──────────────────────────────────────┤
│  • site: string                      │
│  • username: string                  │
│  • password: string                  │  ← Stored in plaintext in CoValue
│  • notes: string                     │     Encrypted by Jazz automatically
│  • createdAt: Date                   │
│  • updatedAt: Date                   │
│  • tags: string[]                    │
└──────────────────────────────────────┘

Storage Location:
┌──────────────────────────────────────┐
│  MyAccount (CoMap)                   │
├──────────────────────────────────────┤
│  • passwords: CoList<PasswordEntry>  │
│  • folders: CoList<Folder>           │
│  • settings: CoMap<Settings>         │
└──────────────────────────────────────┘

Access Control:
┌──────────────────────────────────────┐
│  Group Permissions                   │
├──────────────────────────────────────┤
│  • Owner: PRF-Jazz Account (me)      │
│  • Read: groupReadKey (encrypted)    │
│  • Write: Requires account signature │
└──────────────────────────────────────┘
```

### Implementation Example

```typescript
// Define password entry schema
class PasswordEntry extends CoMap {
  site = co.string;
  username = co.string;
  password = co.string;  // Jazz encrypts this automatically!
  notes = co.string;
  createdAt = co.number;
  updatedAt = co.number;
  tags = co.json<string[]>();
}

// Define account schema
class MyAccount extends CoMap {
  passwords = co.ref(CoList.of(co.ref(PasswordEntry)));
  folders = co.ref(CoList.of(co.ref(Folder)));
  settings = co.ref(Settings);
}

// Password Manager Component
function PasswordManager() {
  const { me } = useAccount();
  const passwords = useCoState(MyAccount, me.root?.passwords);
  
  async function savePassword(data: PasswordData) {
    // Create new password entry
    const entry = PasswordEntry.create({
      site: data.site,
      username: data.username,
      password: data.password,  // Plaintext here
      notes: data.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: data.tags || []
    }, { owner: me });
    
    // Add to list (Jazz encrypts during sync)
    passwords.push(entry);
    
    // Done! No additional encryption needed ✅
  }
  
  async function getPassword(entryId: string) {
    const entry = passwords.find(p => p.id === entryId);
    
    // Password is automatically decrypted by Jazz!
    return entry.password;  // Plaintext available immediately ✅
  }
  
  return (
    <div>
      {passwords.map(entry => (
        <PasswordCard
          key={entry.id}
          site={entry.site}
          username={entry.username}
          password={entry.password}  // Already decrypted!
          onEdit={() => editPassword(entry)}
          onDelete={() => deletePassword(entry)}
        />
      ))}
    </div>
  );
}
```

### Security Guarantees

| Threat | Protection | How |
|--------|------------|-----|
| **XSS Attack** | ✅ Protected | Can't unlock PRF account (needs biometric) |
| **localStorage Theft** | ✅ Protected | No secrets stored (only public keys) |
| **Server Compromise** | ✅ Protected | Passwords encrypted by Jazz (can't decrypt) |
| **Network Sniffing** | ✅ Protected | Jazz uses E2EE transport |
| **Malware** | ✅ Protected | PRF in Secure Enclave (hardware boundary) |
| **Active Session XSS** | ⚠️ Limited | Can read passwords during session only |

**Note on Active Session:** If XSS occurs while user is authenticated, attacker CAN read passwords that are currently loaded in memory. However:
- Session expires on tab close
- Can't persist access across sessions
- Can't export account to new device
- Much better than standard password managers using localStorage!

---

## Platform Compatibility

### Browser Support Matrix (January 2026)

| Platform | Browser | PRF Support | Status | Notes |
|----------|---------|-------------|--------|-------|
| **Android** | Chrome | ✅ Full | Production | Google Password Manager |
| Android | Edge | ✅ Full | Production | Uses Chrome engine |
| Android | Firefox | ❌ None | Not Supported | No PRF extension |
| **iOS 18.4+** | Safari | ✅ Full | Production | iOS 18.0-18.3 had DATA LOSS bug! |
| iOS 18.0-18.3 | Safari | ⚠️ Buggy | Avoid | Data loss with PRF |
| iOS | Chrome | ❌ None | Not Supported | WebAuthn limited on iOS |
| **macOS 15+** | Safari | ✅ Full | Production | iCloud Keychain |
| macOS 15+ | Chrome | ✅ Full | Production | Platform authenticator |
| macOS 15+ | Firefox | ✅ Full | Production | Platform authenticator |
| **Windows** | All | ❌ None | Not Supported | Windows Hello lacks hmac-secret |

### Recommended Deployment Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                  PROGRESSIVE ENHANCEMENT                         │
└─────────────────────────────────────────────────────────────────┘

Tier 1: Full Support (PRF-Jazz)
├─ Android Chrome/Edge + Google Password Manager
├─ iOS 18.4+ Safari + iCloud Keychain
├─ macOS 15+ Safari/Chrome/Firefox + iCloud Keychain
└─ Best UX: Biometric unlock, cloud sync, multi-device

Tier 2: Fallback (Passphrase-Jazz)
├─ Windows (all browsers)
├─ iOS 18.0-18.3 (buggy PRF)
├─ Android Firefox
└─ Acceptable UX: 12-24 word passphrase, manual backup

Tier 3: Not Supported
├─ Very old browsers (pre-WebAuthn)
└─ Show error message, request browser upgrade
```

### Feature Detection

```typescript
async function detectPRFSupport(): Promise<boolean> {
  // Check if WebAuthn is available
  if (!window.PublicKeyCredential) {
    return false;
  }
  
  // Check if PRF extension is supported
  const available = await PublicKeyCredential
    .isUserVerifyingPlatformAuthenticatorAvailable();
  
  if (!available) {
    return false;
  }
  
  // Try to create a credential with PRF
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Maia PRF Test" },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: "test",
          displayName: "test"
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          userVerification: "required"
        },
        extensions: { prf: {} }  // Request PRF
      }
    });
    
    // Check if PRF was enabled
    const results = credential.getClientExtensionResults();
    return results.prf?.enabled === true;
    
  } catch (error) {
    return false;
  }
}

// Usage
async function selectAuthMethod() {
  const hasPRF = await detectPRFSupport();
  
  if (hasPRF) {
    return new PasskeyPRFAccount();  // Tier 1
  } else {
    return new PassphraseAccount();  // Tier 2 (fallback)
  }
}
```

---

## Implementation Roadmap

### Phase 1: Core PRF-Jazz Account (2-3 weeks)

**Deliverables:**
- PasskeyPRFAccount class
- PRF evaluation logic
- HKDF key derivation
- Ed25519 keypair generation
- Jazz Account interface adapter

**Technical Tasks:**
1. Fork jazz-tools → jazz-tools-prf
2. Implement WebAuthn PRF wrapper
3. Implement HKDF-SHA256 derivation
4. Implement Ed25519 from seed generation
5. Unit tests (PRF determinism, key derivation)
6. Integration tests (Jazz signing)

**Success Criteria:**
- ✅ Account creation with biometric
- ✅ Account unlock with biometric
- ✅ Deterministic key derivation (same passkey = same keys)
- ✅ Jazz transaction signing works
- ✅ No secrets in localStorage

---

### Phase 2: Multi-Device & Recovery (1-2 weeks)

**Deliverables:**
- PRF salt sync via Jazz mesh
- Backup code generation (BIP39)
- Recovery flow (backup code → new passkey)
- Multi-device unlock verification

**Technical Tasks:**
1. Store PRF salt in Jazz CoValue (redundant to localStorage)
2. Implement BIP39 mnemonic generation
3. Implement backup code encryption
4. Implement recovery flow UI
5. Test iCloud/Google passkey sync
6. Test cross-device unlock

**Success Criteria:**
- ✅ Account works on multiple devices
- ✅ Backup codes generated and validated
- ✅ Recovery from backup code works
- ✅ PRF salt survives localStorage clear

---

### Phase 3: Password Manager (1 week)

**Deliverables:**
- PasswordEntry CoMap schema
- Password CRUD operations
- Search/filter UI
- Password generator
- Import/export (encrypted)

**Technical Tasks:**
1. Define CoValue schemas (PasswordEntry, Folder, Settings)
2. Implement React components (PasswordCard, PasswordForm)
3. Implement search/filter logic
4. Implement password strength meter
5. Implement CSV import/export
6. Browser extension (optional)

**Success Criteria:**
- ✅ Can store passwords in Jazz
- ✅ Passwords encrypted by Jazz automatically
- ✅ Can search/filter passwords
- ✅ Can import from other password managers
- ✅ No XSS vulnerability (verified by audit)

---

### Phase 4: Multi-Chain Wallets (2 weeks)

**Deliverables:**
- EVM wallet (secp256k1 derivation)
- Solana wallet (Ed25519 derivation)
- Transaction signing UI
- Multi-chain address display
- Send/receive flows

**Technical Tasks:**
1. Implement secp256k1 key generation from seed
2. Implement Ethereum address derivation
3. Implement Solana address derivation
4. Implement transaction signing (Ethereum, Solana)
5. Integrate with ethers.js / @solana/web3.js
6. Implement send/receive UI

**Success Criteria:**
- ✅ Can derive Ethereum wallet from PRF
- ✅ Can sign Ethereum transactions
- ✅ Can derive Solana wallet from PRF
- ✅ Can sign Solana transactions
- ✅ One biometric unlock = all wallets accessible

---

### Phase 5: Production Hardening (2-3 weeks)

**Deliverables:**
- Security audit report
- Performance optimization
- Error handling & recovery flows
- Analytics & monitoring
- Documentation

**Technical Tasks:**
1. Security audit (external firm)
2. Penetration testing (XSS, CSRF, etc)
3. Performance profiling (unlock latency)
4. Implement rate limiting (prevent brute force)
5. Implement session timeout
6. Add analytics (unlock success rate, errors)
7. Write developer documentation
8. Write user documentation

**Success Criteria:**
- ✅ Security audit passed (no critical issues)
- ✅ Unlock latency < 500ms
- ✅ Error recovery flows tested
- ✅ Analytics dashboard live
- ✅ Documentation complete

---

## Total Timeline: 8-11 weeks (2-3 months)

```
Week 1-3:   Core PRF-Jazz Account
Week 4-5:   Multi-Device & Recovery
Week 6:     Password Manager
Week 7-8:   Multi-Chain Wallets
Week 9-11:  Production Hardening

LAUNCH: ~3 months from start
```

---

## Critical Dependencies

### External Dependencies

**1. WebAuthn PRF Extension (Browser)**
- Spec: W3C WebAuthn Level 3
- Status: Shipping in major browsers
- Risk: LOW (already deployed)
- Fallback: Passphrase mode for unsupported browsers

**2. Passkey Cloud Sync (Platform)**
- iOS: iCloud Keychain (shipping since iOS 16)
- Android: Google Password Manager (shipping since Android 9)
- Status: Widely deployed
- Risk: MEDIUM (user must enable sync)
- Mitigation: Force enable during setup, backup codes

**3. Jazz CoJSON (Library)**
- Version: Latest stable
- Status: Active development
- Risk: LOW (well-maintained)
- Fallback: Can fork if needed

**4. Web Crypto API (Browser)**
- Spec: W3C Web Cryptography API
- Status: Universal support
- Risk: NEGLIGIBLE
- Fallback: Polyfill for old browsers

### Internal Dependencies

**1. HKDF Implementation**
- Need: RFC 5869 compliant HKDF-SHA256
- Options:
  - @noble/hashes (recommended, 10KB)
  - Web Crypto subtle.deriveKey (limited browser support for HKDF)
  - Custom implementation (risky)
- Recommendation: Use @noble/hashes

**2. Ed25519 Implementation**
- Need: RFC 8032 compliant Ed25519
- Options:
  - @noble/curves (recommended, well-audited)
  - tweetnacl.js (legacy, larger)
  - supercop.wasm (fastest, complex)
- Recommendation: Use @noble/curves

**3. secp256k1 Implementation**
- Need: Ethereum-compatible secp256k1
- Options:
  - @noble/curves (recommended, same as Ed25519)
  - elliptic.js (legacy, used by ethers.js)
- Recommendation: Use @noble/curves

**4. BIP39 Implementation**
- Need: BIP39 mnemonic generation/validation
- Options:
  - @scure/bip39 (recommended, from noble suite)
  - bip39 (legacy, more dependencies)
- Recommendation: Use @scure/bip39

### Risk Assessment

| Dependency | Criticality | Risk Level | Mitigation |
|------------|-------------|------------|------------|
| WebAuthn PRF | HIGH | LOW | Feature detection, fallback mode |
| Passkey Sync | MEDIUM | MEDIUM | Backup codes, social recovery |
| Jazz CoJSON | HIGH | LOW | Well-maintained, can fork |
| Crypto Libraries | HIGH | LOW | Use audited libraries (@noble) |
| Browser APIs | MEDIUM | NEGLIGIBLE | Universal support |

---

## Conclusion

This architecture provides a **production-ready, hardware-backed account system** for Maia City that:

✅ **Eliminates localStorage vulnerabilities** (XSS-resistant)  
✅ **Provides seamless UX** (biometric unlock)  
✅ **Enables multi-chain support** (one passkey = all wallets)  
✅ **Leverages platform recovery** (iCloud/Google sync)  
✅ **Maintains Jazz compatibility** (no CoJSON changes)  
✅ **Secures password manager** (no additional vault layer needed)

**Key Innovation:** By combining WebAuthn PRF with Jazz's native encryption, we achieve password manager-grade security without the complexity of separate vault encryption or the vulnerabilities of localStorage storage.

**Recovery Strategy:** We are **100% dependent** on Apple iCloud Keychain and Google Password Manager for passkey cloud sync. This is a calculated tradeoff:
- ✅ Zero-friction multi-device experience
- ✅ Familiar recovery flow (same as system passwords)
- ⚠️ Requires user to enable cloud sync
- ⚠️ Cross-platform migration requires backup codes

**Next Steps:** Begin Phase 1 implementation (Core PRF-Jazz Account) and validate PRF support across target devices.

---

**Document Version:** 1.0  
**Last Updated:** January 17, 2026  
**Author:** Samuel (Maia City Founder)  
**Status:** Architecture Approved, Ready for Implementation
