# @hominio/db

Shared Jazz data schemas, utilities, computed fields system, migrations, and group utilities for the Hominio monorepo.

## Overview

This package contains all Jazz-related data functionality that can be shared across multiple services:

- **Schemas**: Account, Profile, Contact, AppRoot, and Capability schemas
- **Computed Fields**: Generic system for computed fields on CoValues
- **Groups**: Utilities for working with Jazz Groups and CoValue access
- **Profile Resolver**: Functions for resolving user profile information
- **Migrations**: Data migration functions for syncing external data (e.g., Google profile)

## Installation

This package is part of the Hominio monorepo and uses workspace dependencies:

```json
{
  "dependencies": {
    "@hominio/db": "workspace:*"
  }
}
```

## Usage

```typescript
import { 
  JazzAccount, 
  AccountProfile, 
  Contact, 
  AppRoot, 
  Capability,
  syncGoogleDataToProfile,
  registerComputedField,
  setupComputedFieldsForCoValue,
  isComputedField,
  getCoValueGroupInfo,
  groupHasAccessToCoValue,
  filterCoValuesByGroupAccess,
  resolveProfile,
  migrateSyncGoogleNameToProfile,
  migrateSyncGoogleImageToProfile,
  migrateSyncGoogleEmailToContact
} from "@hominio/db";
```

## Structure

```
src/
├── index.ts              # Main exports
├── schema.ts             # Jazz schemas and account migration
├── functions/            # Utility functions
│   ├── computed-fields.ts
│   ├── groups.ts
│   ├── profile-resolver.ts
│   └── jazz-utils.ts (framework-specific, kept in services)
└── migrations/           # Data migration functions
    ├── 20241220_sync-google-name-to-profile.ts
    ├── 20241220_sync-google-image-to-profile.ts
    └── 20241220_sync-google-email-to-contact.ts
```

## Dependencies

- `jazz-tools` (peer dependency) - Required by consumers

## Version Management

This package shares the same version as the monorepo, managed centrally via `scripts/sync-version.js`.


