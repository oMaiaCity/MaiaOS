# Version Management Scripts

## Automatic Version Sync

This project uses **semantic-release** for automated version management across all platforms.

### How It Works

1. **Commit Messages**: Use [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` - New feature (minor version bump)
   - `fix:` - Bug fix (patch version bump)
   - `BREAKING CHANGE:` or `feat!:` - Breaking change (major version bump)

2. **Automatic Sync**: When you run `npm run release`, it will:
   - Analyze commits to determine next version
   - Update versions in:
     - `package.json`
     - `src-tauri/Cargo.toml`
     - `src-tauri/tauri.conf.json`
     - `src-tauri/gen/apple/app_iOS/Info.plist` (iOS)
     - `src-tauri/gen/apple/project.yml` (iOS)
   - Generate/update `CHANGELOG.md`
   - Create GitHub release with tag
   - Commit all changes

### Usage

#### Manual Version Sync

```bash
# Sync a specific version across all files
npm run version:sync 0.1.2

# Or use the script directly
node scripts/sync-version.js 0.1.2
```

#### Automated Release (Recommended)

```bash
# Dry run to see what would happen
npm run release:dry-run

# Actual release (creates tag, GitHub release, etc.)
npm run release
```

### Commit Message Examples

```bash
# Patch release (0.1.1 -> 0.1.2)
git commit -m "fix: resolve iOS safe area issue"

# Minor release (0.1.1 -> 0.2.0)
git commit -m "feat: add dark mode support"

# Major release (0.1.1 -> 1.0.0)
git commit -m "feat!: redesign app architecture

BREAKING CHANGE: API endpoints have changed"
```

### GitHub Actions Integration

Add this to `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Alternative: Standard Version (Simpler)

If you prefer more manual control, you can use `standard-version`:

```bash
npm install --save-dev standard-version
```

Add to `package.json`:
```json
{
  "scripts": {
    "release": "standard-version && npm run version:sync"
  }
}
```

Then manually run:
```bash
npm run release
git push --follow-tags
```

