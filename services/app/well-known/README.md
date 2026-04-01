# Apple App Site Association (AASA)

Used for **passkeys** / `webcredentials` so native macOS (Tauri) and WebAuthn can share the same relying party (`maia.city`).

1. `apple-app-site-association` uses Team ID `2P6VCHVJWB` → app id `2P6VCHVJWB.city.maia.app`. Change only if the team or bundle id changes.
2. The bundle id must match Tauri `identifier` in `src-tauri/tauri.conf.json` (`city.maia.app`).
3. Deploy: the file is copied to `dist/.well-known/` by `build.js` and served by `server.js` at  
   `https://next.maia.city/.well-known/apple-app-site-association`  
   (and any host that serves this app’s `dist/`).

Apple requires HTTPS and `Content-Type: application/json` for this file (handled in `server.js`).
