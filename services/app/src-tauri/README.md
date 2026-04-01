# Tauri macOS Desktop Shell

Wraps the MaiaOS SPA in a native macOS window with access to platform APIs (passkeys via `ASAuthorizationController`).

## Bundle Identity

| Field | Value |
|---|---|
| Bundle ID | `city.maia.next` |
| Product Name | Maia City |
| Team ID | `2P6VCHVJWB` (Visioncreator GmbH) |
| Signing Identity | `Apple Development: Samuel Andert (VS279CCR56)` |
| Min macOS | 15.0 |

## Files

| File | Purpose |
|---|---|
| `tauri.conf.json` | Tauri config: bundle id, signing identity, entitlements, provisioning profile path |
| `Entitlements.plist` | macOS entitlements embedded in the signed binary |
| `embedded.provisionprofile` | Provisioning profile (gitignored, download from Apple Developer) |
| `capabilities/default.json` | Tauri permission grants (passkey plugin, window, log) |

## Entitlements

- `com.apple.security.network.client` — outbound network (WebSocket to sync, HTTP to API)
- `com.apple.developer.associated-domains` — `webcredentials:next.maia.city` for passkey domain association (must match native RP ID in `prf-tauri.js`)

**No App Sandbox.** Sandbox requires a provisioning profile that grants sandbox entitlements; the current profile grants associated-domains only. Sandbox can be added later for App Store distribution.

## Provisioning Profile

The `embedded.provisionprofile` is **gitignored** because it contains device UUIDs and is tied to a specific developer account. Each developer must download their own.

### Setup (one-time)

1. Go to [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Register App ID **`city.maia.next`** with **Associated Domains** capability enabled
3. Go to [Apple Developer → Devices](https://developer.apple.com/account/resources/devices/list)
4. Register your Mac using the **Provisioning UDID** (not the Hardware UUID):
   ```bash
   system_profiler SPHardwareDataType | grep "Provisioning UDID"
   ```
   Apple Silicon Macs use the Provisioning UDID for profile matching. The Hardware UUID will not work.
5. Go to [Apple Developer → Profiles](https://developer.apple.com/account/resources/profiles/list)
6. Create **macOS App Development** profile for `city.maia.next`, select your cert + device
7. Download and place as `services/app/src-tauri/embedded.provisionprofile`

### Why it's needed

`com.apple.developer.associated-domains` is a **restricted entitlement** on macOS. When signed with Apple Development (not Developer ID), macOS requires a provisioning profile that grants it. Without the profile, `taskgated` blocks the app from launching (error 163 / "Launchd job spawn failed").

## AASA (Apple App Site Association)

The host **`next.maia.city`** (RP ID for the desktop app) must serve `/.well-known/apple-app-site-association` with:

```json
{
  "webcredentials": {
    "apps": ["2P6VCHVJWB.city.maia.next"]
  }
}
```

The Team ID prefix must match the team that signs the binary. The bundle id must match `tauri.conf.json` `identifier`.

AASA files live in:
- `services/app/well-known/apple-app-site-association` (deployed with the SPA)
- `services/landing/.well-known/apple-app-site-association` (deployed with the landing page)

## Build Commands

```bash
# Full release build (SPA + Tauri bundle, signed)
bun run build:desktop

# Debug build (faster Rust compile, still signed + bundled)
bun run build:desktop:debug

# Dev mode (hot reload, but NO signing/entitlements — passkeys won't work)
bun run dev:desktop
```

### Output locations

- Release: `target/release/bundle/macos/Maia City.app`
- Debug: `target/debug/bundle/macos/Maia City.app`

### First launch (Gatekeeper)

Apple Development-signed apps are not notarized. Finder may block the first open. Fix:
- **Right-click → Open → confirm**, or
- **System Settings → Privacy & Security → Open Anyway**, or
- `xattr -cr "target/debug/bundle/macos/Maia City.app"`

### `tauri dev` vs `tauri build`

`tauri dev` runs the **debug binary** directly (`target/debug/app`), not the bundled `.app`. It does **not** embed entitlements or the provisioning profile, so `ASAuthorizationController` fails with "The calling process does not have an application identifier." Always use a **built bundle** to test passkeys.

## Passkey Plugin

Native passkeys are handled by `libs/maia-tauri-plugin-passkey` (Swift + Rust FFI). The plugin passes the relying party ID (`next.maia.city` from `@MaiaOS/self` `prf-tauri.js`) at runtime to `ASAuthorizationController`. The associated-domains entitlement authorizes `webcredentials:next.maia.city`.
