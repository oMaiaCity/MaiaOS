# Brand Assets Management

## Overview

Brand assets (logos, images, fonts, etc.) are centrally stored in `libs/maia-brand/src/assets/` and automatically synced to all service static folders during development.

## How It Works

### 1. **Single Source of Truth**
All brand assets live in one place:
```
libs/maia-brand/src/assets/
├── logo_clean.png
├── [future assets...]
```

### 2. **Hot-Reload-Aware Sync**
When you run `bun dev`, a file watcher automatically syncs assets to:
- `services/app/static/brand/`
- `services/wallet/static/brand/`
- `services/website/static/brand/`

The `brand/` subfolder makes it clear these assets come from the maia-brand package! 🎨

### 3. **SvelteKit Standard Usage**
Services use assets the normal way - no special imports needed:

```svelte
<!-- In any service component -->
<img src="/brand/logo_clean.png" alt="Logo" />
```

## Scripts

### Sync Once (Manual)
```bash
node scripts/sync-assets.js
```

### Watch Mode (Automatic during dev)
```bash
node scripts/sync-assets.js --watch
```

The watch mode runs automatically when you use `bun dev` 🎉

## Adding New Assets

1. **Add to brand package:**
   ```bash
   cp my-new-asset.png libs/maia-brand/src/assets/
   ```

2. **If dev server is running:**
   - Asset is automatically synced to all services ✅
   - Hot reload works! ♻️

3. **If dev server is not running:**
   - Run sync manually: `node scripts/sync-assets.js`

4. **Use in any service:**
   ```svelte
   <img src="/brand/my-new-asset.png" alt="My Asset" />
   ```

## Production Builds

- Each service builds with its own copy of assets (in `static/` or `public/`)
- No runtime dependencies on the brand package
- Assets are optimized by Vite during build

## Benefits

✅ **Single source of truth** - One place to manage all brand assets
✅ **Hot reload** - Changes to assets trigger automatic reload
✅ **Simple imports** - Use standard SvelteKit syntax (`/logo.png`)
✅ **No build hacks** - Works with standard Vite/SvelteKit setup
✅ **Monorepo friendly** - No complex module resolution
✅ **Production ready** - Each service has its own optimized copies

## Architecture

```
┌─────────────────────────────────────┐
│  libs/maia-brand/src/assets/     │
│  ├── logo_clean.png (SINGLE SOURCE) │
│  └── [other assets...]              │
└─────────────┬───────────────────────┘
              │
              │ (sync-assets.js --watch)
              │
       ┌──────┴──────┬──────────────┐
       │             │              │
       ▼             ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│   app    │  │  wallet  │  │ website  │
│ /static/ │  │ /static/ │  │ /public/ │
│  brand/  │  │  brand/  │  │  brand/  │
└──────────┘  └──────────┘  └──────────┘
```

## Future: Fonts, Icons, etc.

This same pattern works for:
- Custom fonts (`.woff`, `.woff2`)
- Icons/images (`.svg`, `.png`, `.jpg`)
- Favicons (`favicon.ico`)
- Any other static assets

Just add them to `libs/maia-brand/src/assets/` and they'll sync automatically! 🚀

