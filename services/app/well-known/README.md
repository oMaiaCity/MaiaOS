# Apple App Site Association (AASA)

Used for **passkeys** / `webcredentials` so native macOS (Tauri) and WebAuthn align on the **next** deployment host (`next.maia.city` as RP ID for the desktop app; browser uses `window.location.hostname`).

1. `apple-app-site-association` lists `TEAM_ID.city.maia.next` per signing team. Change only if the team or bundle id changes.
2. The bundle id must match Tauri `identifier` in `src-tauri/tauri.conf.json` (`city.maia.next`; avoid identifiers ending in `.app` on macOS).
3. Deploy: the file is copied to `dist/.well-known/` by `build.js` and served at  
   `https://next.maia.city/.well-known/apple-app-site-association`  
   (and any host that serves this app’s `dist/`).

Apple requires HTTPS and `Content-Type: application/json` for this file (handled in `server.js`).
