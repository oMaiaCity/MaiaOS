# 1.0.0 (2025-12-08)


### Bug Fixes

* add --admin-password flag using ZERO_ADMIN_AUTH secret ([56139ba](https://github.com/VisioncreatorEarth/Hominio/commit/56139ba32f3144a23abbff9d450c619baf9375d5))
* add [@source](https://github.com/source) to app.css for tailwind v4 content scanning ([4f73cc8](https://github.com/VisioncreatorEarth/Hominio/commit/4f73cc8de282fc3995fb7a36d99d138101b2e36d))
* add @semantic-release/npm plugin to match working v0.1.4 config ([79cf5f1](https://github.com/VisioncreatorEarth/Hominio/commit/79cf5f1d9c6175032b1ce81a72bcb5d9abfd0d55))
* add admin auth check to auto-assign endpoint and improve nav pill ([159265d](https://github.com/VisioncreatorEarth/Hominio/commit/159265d4052fab6d0d482d085f35803514b2b92d))
* add call logs sidebar to /me route and fix deployment pipeline ([9f06437](https://github.com/VisioncreatorEarth/Hominio/commit/9f0643781ab3ddfc65107ff1620dea2489339ee1))
* add computed field badge indicator in property items ([fb9f4fe](https://github.com/VisioncreatorEarth/Hominio/commit/fb9f4fe83ee4b8a29526ac20d5943a57b933fd71))
* add CORS headers to capabilities endpoint and update brand colors ([346f2cc](https://github.com/VisioncreatorEarth/Hominio/commit/346f2cc011ed6525b710d6d1e9e28308c94901f3))
* add CORS headers to capabilities endpoint for cross-origin requests ([8ee19fe](https://github.com/VisioncreatorEarth/Hominio/commit/8ee19fe68eb705c1e561ac2adc7c1e91f34b88c6))
* add debug logging to capabilities routes ([f46f5c6](https://github.com/VisioncreatorEarth/Hominio/commit/f46f5c651807b3b10e5228d8c0b2a6429850df75))
* add explicit port flag and admin-password fallback ([6365ff0](https://github.com/VisioncreatorEarth/Hominio/commit/6365ff0cac3ef149124b9753cd530be63fd03ae9))
* add Favicon component and asset sync for me service ([56560ae](https://github.com/VisioncreatorEarth/Hominio/commit/56560ae961353188d563e52f34ab2d4978c1f82f))
* add game service to dev script on port 4205 and remove unused CSS selectors ([adb2505](https://github.com/VisioncreatorEarth/Hominio/commit/adb250593ae67dce95065ba9851d0d61983b1761))
* add hominio-brand to app tailwind content path ([48dbb1a](https://github.com/VisioncreatorEarth/Hominio/commit/48dbb1aad8dc8f907f38e3d565c1f1d8a8355947))
* add legal pages and footer to app and me services ([9d8d194](https://github.com/VisioncreatorEarth/Hominio/commit/9d8d19490c9172b91aae15644049d690af672ddc))
* add logo to header and improve me service configuration ([28b0d5a](https://github.com/VisioncreatorEarth/Hominio/commit/28b0d5a0618b5d2f6e56a30e2a0e108876d50fae))
* add missing --admin-password flag to sync service Dockerfile ([a9bdbfd](https://github.com/VisioncreatorEarth/Hominio/commit/a9bdbfd8602a00ec279f3df4e53d9c05146f37f6))
* add missing --admin-password flag to sync service Dockerfile (required in production) ([a63877e](https://github.com/VisioncreatorEarth/Hominio/commit/a63877e54c68a8e3bbcc37dcf326c2fe4cc99bc3))
* add missing @hominio/agents dependency to API service ([38aeb92](https://github.com/VisioncreatorEarth/Hominio/commit/38aeb92e7fe12b3dacc8040f98b31aaadff61195))
* add missing dependencies to wallet service ([f1abf64](https://github.com/VisioncreatorEarth/Hominio/commit/f1abf64b488b4808c803c9e88c02586b0a1597bd))
* add Node.js 22 setup for semantic-release compatibility ([3388dc2](https://github.com/VisioncreatorEarth/Hominio/commit/3388dc2555166fc8b42644f7378ad944a1f51464))
* add npm plugin to releaserc config to match v0.1.4 ([072a133](https://github.com/VisioncreatorEarth/Hominio/commit/072a1339c4db45213153da9409052f6aa816d986))
* add PUBLIC_DOMAIN_API to wallet service and improve WebSocket auth logging ([dadf7ed](https://github.com/VisioncreatorEarth/Hominio/commit/dadf7ed2b6e86b040f28baf618416700a8bb4379))
* add PUBLIC_DOMAIN_WALLET to API service deployment secrets ([a8b0f7a](https://github.com/VisioncreatorEarth/Hominio/commit/a8b0f7a6a13356ba2d3c8d04d4c47c04556e122f))
* add secret availability checks and better error handling ([d8c27ca](https://github.com/VisioncreatorEarth/Hominio/commit/d8c27ca16a514b2b8d0ded25d2a50ce1a41df719))
* add vite alias for @hominio/brand/views to resolve build errors ([3a20c18](https://github.com/VisioncreatorEarth/Hominio/commit/3a20c18f738cd1e651cee565e057b881e6e7c057))
* add wellness skill to Charles agent and improve tool recognition ([76d4751](https://github.com/VisioncreatorEarth/Hominio/commit/76d47513db39213a7070e0347c7ff26d4b467352))
* add ZERO_POSTGRES_SECRET to wallet service deployment ([6c31fcc](https://github.com/VisioncreatorEarth/Hominio/commit/6c31fcc33c88f52cac672b0fbb5c1c823c4dded9))
* align back button with nav pill styling and positioning ([e91567a](https://github.com/VisioncreatorEarth/Hominio/commit/e91567ab42c75658c6bb017c6f37ebac83fb4135))
* allow iOS version files to be tracked for semantic-release ([44fef1f](https://github.com/VisioncreatorEarth/Hominio/commit/44fef1fec643306caf50b5f88cbc2982e974ba5e))
* **app,wallet:** use Bun instead of Node.js for runtime ([293ce05](https://github.com/VisioncreatorEarth/Hominio/commit/293ce052fb317effd3eb8bd75a5dfab1d12a7396))
* **app:** update NavPill to use Svelte 5 onclick syntax ([9c36ede](https://github.com/VisioncreatorEarth/Hominio/commit/9c36ede146cdd2216039eb7d94dec69d1a0580d5))
* center profile image, name, and email on x-axis ([89d2b56](https://github.com/VisioncreatorEarth/Hominio/commit/89d2b56e5335817fa3cd9c1972bd88883b6b436c))
* centralize auth verification and move sign-in to wallet service ([efea7a1](https://github.com/VisioncreatorEarth/Hominio/commit/efea7a19d38df37fb19fa028a17d04172faeec69))
* centralize design system into @hominio/brand package ([ad7c599](https://github.com/VisioncreatorEarth/Hominio/commit/ad7c5995d285e1e3e02b29646d09dce5fc54e0bf))
* **ci:** accept lowercase UUIDs in provisioning profile validation ([f8342b0](https://github.com/VisioncreatorEarth/Hominio/commit/f8342b006d17671550485f9b098ba3c2548f97c0))
* **ci:** add destination flag for iOS xcodebuild in CI ([bc621a9](https://github.com/VisioncreatorEarth/Hominio/commit/bc621a97c8b2e3a1fafa62b60687df1d7f68bf02))
* **ci:** add GitHub Actions workflows for automated releases and TestFlight uploads ([b88b5ea](https://github.com/VisioncreatorEarth/Hominio/commit/b88b5ea135132c851d464efd22e44ee85ae85747))
* **ci:** add permissions to iOS workflow and set baseline version tag ([67e6fb3](https://github.com/VisioncreatorEarth/Hominio/commit/67e6fb3708e95452e28e264e03736781cdb43363))
* **ci:** add write permissions to GitHub Actions workflow for semantic-release ([d3f0655](https://github.com/VisioncreatorEarth/Hominio/commit/d3f065534be04db223efd3d59d38ce05533cbdc5))
* **ci:** allow manual workflow dispatch and fix checkout ref ([ece9b5a](https://github.com/VisioncreatorEarth/Hominio/commit/ece9b5af88d44ffde895d45e4518dee0b865cd55))
* **ci:** allow manual workflow dispatch and fix checkout ref ([bb9fb41](https://github.com/VisioncreatorEarth/Hominio/commit/bb9fb411a21a3150dfddadb2e38090e35b1cf50d))
* **ci:** build Rust library before iOS app build ([ea4c438](https://github.com/VisioncreatorEarth/Hominio/commit/ea4c4382d7b73eaa2bab15d46b9b27984b6f82b0))
* **ci:** create server address file in archive step right before Xcode runs ([39ae5cd](https://github.com/VisioncreatorEarth/Hominio/commit/39ae5cd16bb4c0875fb4827010797168faf19e11))
* **ci:** detect available iOS SDK and use archive/export flow ([dd402b8](https://github.com/VisioncreatorEarth/Hominio/commit/dd402b8f5e4278967c49db0f719f56db85ebe47b))
* **ci:** fix workflow syntax error with secrets check ([0d98675](https://github.com/VisioncreatorEarth/Hominio/commit/0d98675d4b5ac85ee085e0ef1512449945c85f3a))
* **ci:** fix workflow syntax error with secrets check ([b6956ee](https://github.com/VisioncreatorEarth/Hominio/commit/b6956eeca516171b5795963c89c1235c92810cd3))
* **ci:** implement proper iOS code signing architecture ([6199bc9](https://github.com/VisioncreatorEarth/Hominio/commit/6199bc93c2af25a1ee8e9e424cbf3184b9d61356))
* **ci:** implement proper iOS code signing architecture with certificate import ([f7749a4](https://github.com/VisioncreatorEarth/Hominio/commit/f7749a4b1fecd4b78e4048324392209f97eae659))
* **ci:** improve error logging for iOS build failures ([4a27071](https://github.com/VisioncreatorEarth/Hominio/commit/4a270715d9c519cfd9530d99da54c486367b1b2b))
* **ci:** improve provisioning profile UUID extraction in iOS workflow ([fd4b15d](https://github.com/VisioncreatorEarth/Hominio/commit/fd4b15df1b913eba20419fc0b5c9be1cb5036153))
* **ci:** improve UUID extraction from provisioning profiles with multiple fallback methods ([f213f55](https://github.com/VisioncreatorEarth/Hominio/commit/f213f55f8929c340b59381954ea95d19c13d0416))
* **ci:** improve UUID extraction from provisioning profiles with multiple fallback methods ([f0f6a28](https://github.com/VisioncreatorEarth/Hominio/commit/f0f6a28671aea26e97cfa6c7be4dc5ac7753ed4d))
* **ci:** pre-build Rust library and create dummy server address file for Tauri iOS build ([ce115c3](https://github.com/VisioncreatorEarth/Hominio/commit/ce115c3a5bbd970f31b54274553f3c58bb95aa54))
* **ci:** remove --frozen-lockfile flag and add bun.lock ([e898bdf](https://github.com/VisioncreatorEarth/Hominio/commit/e898bdf5ffcab05e51f1df34f550712d31b05f15))
* **ci:** remove --frozen-lockfile flag for Bun install ([70e692a](https://github.com/VisioncreatorEarth/Hominio/commit/70e692a7d0032f8ab234fa33a367591a982074f9))
* **ci:** trigger iOS workflow after Release workflow completes successfully ([e34cbf7](https://github.com/VisioncreatorEarth/Hominio/commit/e34cbf7c91395ae3e622ec995e06c01a4fff7cce))
* **ci:** trigger iOS workflow on tag push instead of release event ([cef6b85](https://github.com/VisioncreatorEarth/Hominio/commit/cef6b85868a07517e368099f8fd18b2076948af4))
* **ci:** try building without code signing, sign during export ([9788f6d](https://github.com/VisioncreatorEarth/Hominio/commit/9788f6dae949f6b0326253a44fa0f913af7b54dc))
* **ci:** update cache keys to use bun.lock instead of bun.lockb ([dbabb1b](https://github.com/VisioncreatorEarth/Hominio/commit/dbabb1b82c13475d87051f1a6ced41882e06af2f))
* **ci:** use stable Xcode version and fix iOS build destination ([567b436](https://github.com/VisioncreatorEarth/Hominio/commit/567b4360413982d5ebc3bb9255058bab0df94146))
* **ci:** use Tauri build command to handle iOS signing ([5c492d4](https://github.com/VisioncreatorEarth/Hominio/commit/5c492d46cc63e8934153442256d4caebbc72a627))
* **ci:** use Xcode 16.1 stable version for iOS builds ([1d6a225](https://github.com/VisioncreatorEarth/Hominio/commit/1d6a225b6cbeb0a0e6cd02a2bc3c45daebbc2387))
* **ci:** use Xcode 16.1 stable version for iOS builds ([84d6f95](https://github.com/VisioncreatorEarth/Hominio/commit/84d6f95074b1a66366434cef010f4eb3a2ce6cfc))
* combine duplicate push triggers in release workflow ([b37539b](https://github.com/VisioncreatorEarth/Hominio/commit/b37539b48b4cb0c1adfaeb51857f73b192a0d806))
* comment out capabilities logic, focus on profile display only ([6cd0650](https://github.com/VisioncreatorEarth/Hominio/commit/6cd0650755ddddb5903a5199c5ae77828b55c914))
* compositor layout improvements and config refactoring ([6011ac4](https://github.com/VisioncreatorEarth/Hominio/commit/6011ac4a3d951d9a24373a7f2229c215bda20a82))
* correct ActivityStreamItem state initialization to avoid Svelte warning ([ac4c616](https://github.com/VisioncreatorEarth/Hominio/commit/ac4c6163d24763d2817d67a0a7ba3b14e81fd573))
* correct comment in injectVibeContext to match actual behavior ([b571511](https://github.com/VisioncreatorEarth/Hominio/commit/b571511a6ffe395e5456ea36017ef196961216e4))
* correct git plugin asset paths for semantic-release ([9800a47](https://github.com/VisioncreatorEarth/Hominio/commit/9800a472b7969974e7596d3f03774fab1e085600))
* correct NeonDialect import from kysely-neon package ([2d0e94f](https://github.com/VisioncreatorEarth/Hominio/commit/2d0e94f868b55a7f4390215d8d3e4e6fca6b23eb))
* correct relative path to brand library in app.css ([171e4b6](https://github.com/VisioncreatorEarth/Hominio/commit/171e4b638582407c1aff7b6700235c8ce81989e5))
* correct sync domain construction and service detection logic ([64741cf](https://github.com/VisioncreatorEarth/Hominio/commit/64741cf50b8547c820bb177b4d575683092a1522))
* correct TYPE metadata badge display and hide duplicate text ([9363a76](https://github.com/VisioncreatorEarth/Hominio/commit/9363a76064dcc43f63755315040992e7d1e0a85e))
* create server address file for Tauri xcode-script ([659012e](https://github.com/VisioncreatorEarth/Hominio/commit/659012e65d1fdba18606e6d3571d83761815666f))
* decrease nav pill bar height to 36px ([a430c01](https://github.com/VisioncreatorEarth/Hominio/commit/a430c01262758f24fe4270770101af8084e02ad4))
* **deploy:** allow manual workflow triggers and recreate app Dockerfile ([8ce3fdc](https://github.com/VisioncreatorEarth/Hominio/commit/8ce3fdcd0aa517c0bfb5d015646fa40b02cef1f4))
* **deploy:** remove invalid --limit flag from flyctl logs command ([9226a38](https://github.com/VisioncreatorEarth/Hominio/commit/9226a386ac0d49a2e7d04bd599c9ad1a457c8241))
* **deploy:** trigger wallet deployment after successful release ([311c79c](https://github.com/VisioncreatorEarth/Hominio/commit/311c79c1f31b7a4e911b4ec5663ee7563ca613a1))
* **deploy:** use shared IPv4 for CNAME compatibility ([388957c](https://github.com/VisioncreatorEarth/Hominio/commit/388957c212e0177db97978a39ec44caa59303eaf))
* enforce exact 36px height for nav pill on all screen sizes ([ac441bf](https://github.com/VisioncreatorEarth/Hominio/commit/ac441bf19b4dfd6706a43a906468bea80b457c97))
* enforce truly fixed width for pricing section using CSS with !important ([2d08ca1](https://github.com/VisioncreatorEarth/Hominio/commit/2d08ca19f73a8c7c5a0eecb193adfa474ddb8014))
* enlarge back/home buttons to 56px on tablet and desktop ([92164cf](https://github.com/VisioncreatorEarth/Hominio/commit/92164cfce3151b681460ad53585d30e248511ca4))
* ensure audio playback reliability by sequencing mixed message types ([704f866](https://github.com/VisioncreatorEarth/Hominio/commit/704f8664b1cc577fce7ee4f0edc91439d6222ff1))
* ensure CI environment variables are available to Xcode build scripts ([9434cb8](https://github.com/VisioncreatorEarth/Hominio/commit/9434cb8de662aa809c2e24b8599c876048b63dd3))
* ensure GitHub releases are created and displayed ([4ca65ac](https://github.com/VisioncreatorEarth/Hominio/commit/4ca65acbac971df73a60911a923aaf045531f01f))
* ensure pricing section has fixed width across all items ([a62f46c](https://github.com/VisioncreatorEarth/Hominio/commit/a62f46cfdf5aed1e8b6510ac99c81adea6939f20))
* ensure semantic-release creates published GitHub releases ([38d8185](https://github.com/VisioncreatorEarth/Hominio/commit/38d81851d8a19fc2532055472f8807dd4f96d783))
* ensure svelte-kit sync runs before build in Docker ([df6e07f](https://github.com/VisioncreatorEarth/Hominio/commit/df6e07fa434bad6ec878e4231246c441a2b7f3bd))
* ensure svelte-kit sync runs before build in Docker ([979e0c4](https://github.com/VisioncreatorEarth/Hominio/commit/979e0c43ff940d6ef6d63b55f4c571a3b61adbec))
* exclude edit and delete operations from repeated prompt injection ([9ad754e](https://github.com/VisioncreatorEarth/Hominio/commit/9ad754e4b8719b874945e0bba1360761cee87199))
* extract CalendarEntry interface to shared types file ([bb4e08b](https://github.com/VisioncreatorEarth/Hominio/commit/bb4e08b20e6e4f968f0b51e2fda9f1e356591fcf))
* filter out group capabilities from admin capabilities list ([e8d94b2](https://github.com/VisioncreatorEarth/Hominio/commit/e8d94b29e59fd2e950c098b2672e9f0040e8a0bb))
* improve activity stream auto-collapse and scroll behavior ([1fe74c1](https://github.com/VisioncreatorEarth/Hominio/commit/1fe74c193c952c158eaffe7d284e96a74e81f997))
* improve Charles vibe prompt to proactively use filters for menu and wellness ([4cc90f1](https://github.com/VisioncreatorEarth/Hominio/commit/4cc90f1e9af4eb23c1c5cd991fcd43a4ec0b566e))
* improve group capability styling and fix collapsible functionality ([e1afb1a](https://github.com/VisioncreatorEarth/Hominio/commit/e1afb1ab2ca5ea768891d348f5db042d6838ab4a))
* improve group capability UI and add admin authentication ([e888883](https://github.com/VisioncreatorEarth/Hominio/commit/e888883e762699db48a336a0e3e06933e078e081))
* improve iOS code signing setup and verification ([4cc65d6](https://github.com/VisioncreatorEarth/Hominio/commit/4cc65d6b48714fa6b8c162d0e3dd197c01658d4b))
* improve member display styling and profile resolution ([7191f56](https://github.com/VisioncreatorEarth/Hominio/commit/7191f564b18af2e6fa92baa0e6cab3ba9e388717))
* improve nav pill button sizes and spacing, remove back to app label ([a14fbe7](https://github.com/VisioncreatorEarth/Hominio/commit/a14fbe776939d4d76f6ff879eef828bad0bd1586))
* improve profile page loading state and error handling ([8795957](https://github.com/VisioncreatorEarth/Hominio/commit/8795957b766190da0059908f24d8d7e818910e85))
* improve sync service deployment config and remove deprecated flags ([8237e2a](https://github.com/VisioncreatorEarth/Hominio/commit/8237e2af95d65d28908663af47a2b7916ac0bda2))
* improve sync service health checks and deployment reliability ([3780cf1](https://github.com/VisioncreatorEarth/Hominio/commit/3780cf1502c111960162f0c28d8e1ccd47dbe411))
* improve UI spacing and styling for calendar, menu, and wellness components ([0ed9e0d](https://github.com/VisioncreatorEarth/Hominio/commit/0ed9e0d26aaa6d2bc8fabd3f1c81321754590855))
* improve UI styling and add BetterAuth profile display ([2fa6dce](https://github.com/VisioncreatorEarth/Hominio/commit/2fa6dce7aa36bd5218013476c18a90ce33ccd625)), closes [#002455](https://github.com/VisioncreatorEarth/Hominio/issues/002455)
* improve WebSocket reconnection and admin dashboard mobile responsiveness ([a1f4621](https://github.com/VisioncreatorEarth/Hominio/commit/a1f46218451cced07e83ade077b951d7149a3c89))
* increase nav pill bar height to 48px ([ce7ce05](https://github.com/VisioncreatorEarth/Hominio/commit/ce7ce053a29a7586d72a715fae64164099c3937f))
* install PyYAML before updating project.yml ([b56f4cc](https://github.com/VisioncreatorEarth/Hominio/commit/b56f4cc100e537b6a811c7c8d111507b2b728bb1))
* iOS safe area background colors match page background ([1ce6661](https://github.com/VisioncreatorEarth/Hominio/commit/1ce66616fbd24101e56ebb6721c0ebd1ab9d288f))
* keep back/home button size on tablet, only enlarge on desktop ([ce0c97a](https://github.com/VisioncreatorEarth/Hominio/commit/ce0c97a731439d40d98b1ac8905a2f7ed0171185))
* keep call button size on tablet and enlarge back/home buttons ([6b158c1](https://github.com/VisioncreatorEarth/Hominio/commit/6b158c1e63ee2b34d0db1270050ff4c06c8d2f9f))
* left-align collapse button and capability counter with proper padding ([92c81e3](https://github.com/VisioncreatorEarth/Hominio/commit/92c81e365b90fb6dd32de10922bd8164d72ed270))
* make group capability UI more subtle with lighter colors and icon-only button ([2fcfd01](https://github.com/VisioncreatorEarth/Hominio/commit/2fcfd018ac8216537934ac2940ed237e1f3c6d19))
* make menu more compact on mobile with smaller text and narrower pricing ([f8de4ba](https://github.com/VisioncreatorEarth/Hominio/commit/f8de4ba311ce70ebe71aa58a2a7b08a4d9779630))
* make quantity label even smaller for better proportion ([f975adb](https://github.com/VisioncreatorEarth/Hominio/commit/f975adb12231d7ec9c3de193e11fb518d6ed9b35))
* make quantity label same size as description and consistent across views ([8e9cc4a](https://github.com/VisioncreatorEarth/Hominio/commit/8e9cc4aae14db2a50e693fede381ed15a0f50a25))
* match bottom padding to top padding in group capability toggle row ([d1fe3fd](https://github.com/VisioncreatorEarth/Hominio/commit/d1fe3fd75576f0c7b19df79287e1bf0600214287))
* migrate capabilities to schema IDs and fix WebSocket voice API connection ([7cc57e2](https://github.com/VisioncreatorEarth/Hominio/commit/7cc57e2c699fb19b48ed82b68bafb92372e198b8))
* mobile NavPill label, menu back button, call button shadow, and group capabilities display ([d624f7a](https://github.com/VisioncreatorEarth/Hominio/commit/d624f7a9ce749e96381edec963a09983190ba04d))
* move vibes UI components back to hominio-vibes package and refactor to use Tailwind ([0a580f7](https://github.com/VisioncreatorEarth/Hominio/commit/0a580f7539d73f3175f8a324c6f390daa59777d1))
* normalize API domain to prevent double https:// protocol ([3326f7c](https://github.com/VisioncreatorEarth/Hominio/commit/3326f7c1c8bdda6b55b5409d38c444b5c66b0a30))
* pass CI environment variables to xcodebuild and prevent WebSocket connection ([9abe00d](https://github.com/VisioncreatorEarth/Hominio/commit/9abe00d89e76841d3a3ab13e755cc5d070bad9ee))
* pin Bun version in Dockerfiles and cleanup Zero ports ([a5a1511](https://github.com/VisioncreatorEarth/Hominio/commit/a5a15114d2a261233c8d57fa3d6f0e85c93bdce3))
* prevent double wallet subdomain in production admin API calls ([0a7c375](https://github.com/VisioncreatorEarth/Hominio/commit/0a7c375d7e332080e375effd05190c39364b8038))
* prevent duplicate AI responses and remove admin/logs view ([4e2e026](https://github.com/VisioncreatorEarth/Hominio/commit/4e2e02682b7c0b02fe79ab309de9820a249971af))
* prevent duplicate AI responses from queryDataContext ([774ca6f](https://github.com/VisioncreatorEarth/Hominio/commit/774ca6f42799d9bdca8001d95c05b72ed8cc2322))
* prevent duplicate responses for view operations and reorder tool calls ([26c9a02](https://github.com/VisioncreatorEarth/Hominio/commit/26c9a0247890c8d948e7192e626fff349587e3b0))
* prevent forever-spinning loading state for hotels without capability ([68f4261](https://github.com/VisioncreatorEarth/Hominio/commit/68f42611c1e902df230a6c2486e177cf557f9f82))
* properly handle svelte-kit sync failure in Docker build ([956fad3](https://github.com/VisioncreatorEarth/Hominio/commit/956fad3210133b6d5a0395ed36e2fe1f8790ca63))
* re-export MenuView and WellnessView from @hominio/brand/views in vibes index ([2b95737](https://github.com/VisioncreatorEarth/Hominio/commit/2b95737b2ba9898c64542f49d5433b77b3bf9de2))
* reduce gap between activity stream elements ([da661d0](https://github.com/VisioncreatorEarth/Hominio/commit/da661d018b2054b6b5d0d20aef89c10f23e6391b))
* refactor monorepo structure and configure me service ([2c9a64f](https://github.com/VisioncreatorEarth/Hominio/commit/2c9a64f60a364a7fc0e0918186ffe01c75f187d5))
* refactor schema to root.humans, add contact.email, remove deprecated code, and improve UI styling ([3716b84](https://github.com/VisioncreatorEarth/Hominio/commit/3716b84e2511ad2293474e5e5c3bc489639fa7a2))
* **release:** create releases for ALL tags, not just latest ([0020913](https://github.com/VisioncreatorEarth/Hominio/commit/0020913988d8ad798a14e0c7e7dfaa1e44e34d0d))
* **release:** ensure GitHub releases are created for all tags ([36f0301](https://github.com/VisioncreatorEarth/Hominio/commit/36f030144834640a218149d77324f227bf8e0077))
* **release:** improve release existence check and verification ([c266a7d](https://github.com/VisioncreatorEarth/Hominio/commit/c266a7d91a1968f0e3a58eb1930adf3788868211))
* **release:** remove npm plugin to fix Bun workspace protocol issue ([8caf12a](https://github.com/VisioncreatorEarth/Hominio/commit/8caf12aeeeac0fe52355557b1dde6749341de8fc))
* **release:** remove orphaned job and fix release creation ([bcbb9dd](https://github.com/VisioncreatorEarth/Hominio/commit/bcbb9dd74d222b75092fddd97b1f876a19a85caa))
* **release:** simplify to only create release for latest tag ([0a9b13f](https://github.com/VisioncreatorEarth/Hominio/commit/0a9b13f8c975b1b08f6c2ac81f9d1a4ddae4084a))
* remove --frozen-lockfile from Docker builds for testing ([cdfc8bd](https://github.com/VisioncreatorEarth/Hominio/commit/cdfc8bd658dadef773f84e4d19eaedbeb99da2a6))
* remove deprecated husky hook lines ([a04ef96](https://github.com/VisioncreatorEarth/Hominio/commit/a04ef96e0cd5ace35ce450e0836859efb3d8eac9))
* remove GlassCard wrapper on mobile, keep on tablet/desktop ([8a8c544](https://github.com/VisioncreatorEarth/Hominio/commit/8a8c544ac04024e7af810ff42815d032a1e3bbc0))
* remove invalid --listen flag, --port should be sufficient ([2a2c301](https://github.com/VisioncreatorEarth/Hominio/commit/2a2c301a75c785c648440cc39eedaaffc01df374))
* remove iOS files from semantic-release git assets ([d7c98a9](https://github.com/VisioncreatorEarth/Hominio/commit/d7c98a97bd05659670d855990118a87ca8286501))
* remove menu wrapper padding, category icons, and make pricing more compact ([f0a9528](https://github.com/VisioncreatorEarth/Hominio/commit/f0a9528715ec237dc8c2fe7a9703fd934e3c6540))
* remove Python dependency, use sed instead ([73f5571](https://github.com/VisioncreatorEarth/Hominio/commit/73f55713af3d4fcb57578422ab17238508abf85d))
* remove repeated prompt after queryDataContext and harden Docker build ([4d39355](https://github.com/VisioncreatorEarth/Hominio/commit/4d39355cadc9e8d0e08ef6b0084840ec855ac9e5))
* remove space between price and euro symbol ([3d671c2](https://github.com/VisioncreatorEarth/Hominio/commit/3d671c28830cf446495ad61a2711da84acff6e7a))
* remove stale component exports from vibes package.json and fix menu description ([c0c081c](https://github.com/VisioncreatorEarth/Hominio/commit/c0c081c522f96ef1122b3207f62c0ce500ce0016))
* remove TypeScript type annotation from JavaScript Svelte file ([db26b97](https://github.com/VisioncreatorEarth/Hominio/commit/db26b97c2ba5945ed74bb335e7b9f4855fb08712))
* remove wrapper styling, fix quantity label size, and make price box responsive ([f93f147](https://github.com/VisioncreatorEarth/Hominio/commit/f93f147d4358f47aedb1f2f891a155d76a9b18ed))
* replace hardcoded localhost redirects with env vars in production ([dbe63ab](https://github.com/VisioncreatorEarth/Hominio/commit/dbe63ab9682beeeb14ef65e0079c5ac89feb884f))
* resolve @hominio/auth import error in wallet service production build ([4197a4e](https://github.com/VisioncreatorEarth/Hominio/commit/4197a4e1771ded524b5ecee8993b53f1523496f9))
* resolve calendar view props mismatch and formatDuration plural bug ([0801a99](https://github.com/VisioncreatorEarth/Hominio/commit/0801a99e1f16e06742132ab4500568b667beb511))
* resolve circular dependencies in hominio-brand ([bccdf5a](https://github.com/VisioncreatorEarth/Hominio/commit/bccdf5a0216a381726d247f5b85fad287c25d71a))
* resolve container queries import, wallet NavPill CTA state, profile page DOM structure, and deployment issues ([2ecf8be](https://github.com/VisioncreatorEarth/Hominio/commit/2ecf8be10f4d27db1ce2762703c03cacdd3e0752))
* resolve context injection feedback loops and improve calendar entry UI ([48b2db6](https://github.com/VisioncreatorEarth/Hominio/commit/48b2db6d2042f5e82a7769e3ebbda85e7f65b12b))
* resolve createTodo freezing, Svelte 5 deprecation, and improve activity stream UX ([6d17d8b](https://github.com/VisioncreatorEarth/Hominio/commit/6d17d8b173db9cf51a8cab1aa2e91a8ca8c2c1f5))
* resolve deployment pipeline errors for app and wallet services ([0df1c21](https://github.com/VisioncreatorEarth/Hominio/commit/0df1c214fad8cb64897bb595e6041be089dbc697))
* resolve EmptyHost error in iOS CI build ([6acf642](https://github.com/VisioncreatorEarth/Hominio/commit/6acf642ac826ba3616afcc93a39d33c71227c3b7))
* resolve queryVibeContext toggle issue and refactor tool call handling ([364eb29](https://github.com/VisioncreatorEarth/Hominio/commit/364eb29aa49da4e1d2ce469d2f9f43816c584367))
* resolve syntax error and wallet deployment issue ([b03f68f](https://github.com/VisioncreatorEarth/Hominio/commit/b03f68fffad0bc881941e97facb6f3b011dd0dd4))
* resolve tool call order conflicts and refresh date/time ([26481e5](https://github.com/VisioncreatorEarth/Hominio/commit/26481e5d9628ba723a2e81a66842739dc84515dd))
* resolve voice session flow and API deployment issues ([fc93e95](https://github.com/VisioncreatorEarth/Hominio/commit/fc93e95adf7a55d4416e00c153e3f821629bbf11))
* resolve YAML syntax error in workflow file ([f591ccd](https://github.com/VisioncreatorEarth/Hominio/commit/f591ccd257df4174889f8b28d994d23d593645a5))
* respect callback origin in auth redirect and add game service support ([839158f](https://github.com/VisioncreatorEarth/Hominio/commit/839158f827caf648be3fbe2e844ec10bb5fb3510))
* restore error handling for svelte-kit sync in Docker build ([8b2fbf1](https://github.com/VisioncreatorEarth/Hominio/commit/8b2fbf1a36c097c4c2bd463caf2d837c34b52858))
* restore Karl workflow and improve menu pricing styling ([02a4cf8](https://github.com/VisioncreatorEarth/Hominio/commit/02a4cf8c069db6b0b5c71921eeedb3203786a470))
* restore service detection fallback for monorepo root execution ([5e04472](https://github.com/VisioncreatorEarth/Hominio/commit/5e0447233983dc48a1e74bad9f5033f19770dd69))
* restructure Dockerfile to preserve monorepo paths ([51be908](https://github.com/VisioncreatorEarth/Hominio/commit/51be9080642b8296b1ff1295bc45c548ef0ddb30))
* revert nav pill height constraints to restore layout ([1fa75fb](https://github.com/VisioncreatorEarth/Hominio/commit/1fa75fb668d9b231df4daecbcec79b8ff90c3696))
* revert Safari WebSocket fix that broke production connections ([9b0c570](https://github.com/VisioncreatorEarth/Hominio/commit/9b0c5702186f2fa7cc51809280d6042852ef489c))
* revert sync service to working configuration (remove --admin-password flag and AUTH_SECRET) ([87fdff6](https://github.com/VisioncreatorEarth/Hominio/commit/87fdff6ee5157d7a6a7f4188f463effaecbca425))
* revert sync service to working configuration (remove --admin-password flag) ([cd420fb](https://github.com/VisioncreatorEarth/Hominio/commit/cd420fbe0f44c29139f42122a2cf2eba615e872f))
* run capabilities migration in production deployment ([cc6d6e3](https://github.com/VisioncreatorEarth/Hominio/commit/cc6d6e3d152c1b8298e59b7c6ea1a90758716406))
* show 'Go To App' label on mobile in NavPill CTA button ([3f587e6](https://github.com/VisioncreatorEarth/Hominio/commit/3f587e6a87d2589a7682f4d8e635685494b4fdd8))
* simplify adapter-static config to match Tauri SvelteKit docs ([84ce657](https://github.com/VisioncreatorEarth/Hominio/commit/84ce6578ac49bdbe10bd011d37dd5106296477f1))
* simplify dev script and remove legacy website asset sync ([38164ca](https://github.com/VisioncreatorEarth/Hominio/commit/38164caaf387e48b510db787b775ba9b4a2d6000))
* simplify GitHub plugin config to match working v0.1.4 setup ([3904f4c](https://github.com/VisioncreatorEarth/Hominio/commit/3904f4c7ac1f10a20c10ba4b3aa38a4efd81b216))
* standardize data explorer layout and fix text rendering artifacts ([43b8794](https://github.com/VisioncreatorEarth/Hominio/commit/43b879491b6e71c6a96d778b9798d0633ba1f4a7))
* standardize menu pricing width and add voice capability check modal ([05dcdef](https://github.com/VisioncreatorEarth/Hominio/commit/05dcdef79c5a2482b724f4d1a5018ab60855a2e8))
* styling issues in dynamic UI components ([c3cd98a](https://github.com/VisioncreatorEarth/Hominio/commit/c3cd98a79559ea522b509226c12b0e5e51aca706))
* sync brand assets during Docker builds and pass ADMIN to migrations ([93116eb](https://github.com/VisioncreatorEarth/Hominio/commit/93116ebe218d43fb293e95922d6b36859a1e2e8a))
* sync Tauri app version to 0.5.3 and update semantic-release config ([6856d2f](https://github.com/VisioncreatorEarth/Hominio/commit/6856d2f6334266f791e6287158ce9a5b409b2ff0))
* universal favicon setup and tool call handler improvements ([efde2d7](https://github.com/VisioncreatorEarth/Hominio/commit/efde2d711329dfb0b9fbea678e37468be2ff15d9))
* update Dockerfiles and workflows for new workspace dependencies ([970fb44](https://github.com/VisioncreatorEarth/Hominio/commit/970fb44fe6c251bef6cc365b478905fcdd62c0bd))
* update lockfile after version sync ([489dd06](https://github.com/VisioncreatorEarth/Hominio/commit/489dd06ed480aff2bd7c16cdd472b84a30464df7))
* update lockfile for API service deployment ([3e948c8](https://github.com/VisioncreatorEarth/Hominio/commit/3e948c8d6c67648e940703ce03249749a88e8136))
* update lockfile to sync with dependencies ([2c11bb9](https://github.com/VisioncreatorEarth/Hominio/commit/2c11bb9260d47af7b6e72bbbcd60d4f8fd25f4b3))
* update lockfile to sync with dependencies ([13f1ae7](https://github.com/VisioncreatorEarth/Hominio/commit/13f1ae76dd6d9dd53c941fa819ebb90c16f82179))
* update lockfile to sync with package.json dependencies ([33666a8](https://github.com/VisioncreatorEarth/Hominio/commit/33666a873d3d3597fb18876bd2e086b2cc5bbef4))
* update NavPill CTA state and button text styling ([db24aee](https://github.com/VisioncreatorEarth/Hominio/commit/db24aee9061d2b1b0c52bc5649ce2d8ec9535c82))
* update schema lookup to use name-scoped identifiers and fix validation export ([c6fc642](https://github.com/VisioncreatorEarth/Hominio/commit/c6fc64290ee71692c760cd100f1965b54aa60cfd))
* update voice call UI colors to match brand guidelines ([4c5dae3](https://github.com/VisioncreatorEarth/Hominio/commit/4c5dae3727efa63043ef12bb93ed12b59e23f4f8)), closes [#dc2626](https://github.com/VisioncreatorEarth/Hominio/issues/dc2626)
* use adapter-static for Tauri iOS builds to fix TestFlight asset error ([76a0ee3](https://github.com/VisioncreatorEarth/Hominio/commit/76a0ee369bf75462d96457b37c402da7c5f508d1))
* use AUTH_SECRET instead of ZERO_AUTH_SECRET and ZERO_ADMIN_AUTH ([5472f70](https://github.com/VisioncreatorEarth/Hominio/commit/5472f70e5b234343e0cfcd26e15445930f52fd6e))
* use brand colors, remove emoji, improve group capability UI ([42fdd46](https://github.com/VisioncreatorEarth/Hominio/commit/42fdd4679d5187cdcb410b5e39efda749e546943))
* use bunx for svelte-kit sync in Docker build ([6a750f6](https://github.com/VisioncreatorEarth/Hominio/commit/6a750f673b1c9a67e61084ebe8fab44e6c31fcb1))
* use correct Tauri environment variable TAURI_ENV_PLATFORM ([34dbba5](https://github.com/VisioncreatorEarth/Hominio/commit/34dbba55815187d4a55850b8086590365dd7cb74))
* use darker red-700 for end call button to match brand alert color ([8d443f5](https://github.com/VisioncreatorEarth/Hominio/commit/8d443f5f0bee281877cd90055d96843c990091b7)), closes [#b91c1c](https://github.com/VisioncreatorEarth/Hominio/issues/b91c1c)
* use npx for svelte-kit sync in Docker build ([a5d2d41](https://github.com/VisioncreatorEarth/Hominio/commit/a5d2d419b45ce7987b417b275310f16df4bdfd0b))
* use npx to run semantic-release with Node.js ([bc53f46](https://github.com/VisioncreatorEarth/Hominio/commit/bc53f4698b94a5218bd25c0223f77c355893fb91))
* use production API domain instead of localhost in frontend ([7e2c38d](https://github.com/VisioncreatorEarth/Hominio/commit/7e2c38deec037ad3bda3f4a970d34d5d2eca0b50))
* use WALLET_POSTGRES_SECRET and add --change-db flag for Zero sync ([0a48329](https://github.com/VisioncreatorEarth/Hominio/commit/0a483294ce3d7bf4dc4a5e1ed21096ae1a18a08b))
* use xcodebuild directly and fix pip install issue ([2cd1277](https://github.com/VisioncreatorEarth/Hominio/commit/2cd127707d11f91ed794e7ed298b77df9b8c2ef6))
* **wallet:** add --yes flag to BetterAuth migration for CI/CD ([180f3b7](https://github.com/VisioncreatorEarth/Hominio/commit/180f3b73f36fa7b58d3067009f7d40451ccf536f))
* **wallet:** add BetterAuth database migration script ([4e37243](https://github.com/VisioncreatorEarth/Hominio/commit/4e372438eab635f8b4c1ef9bdaddf0da71b24bd7))
* **wallet:** add health check to fly.toml ([15cdd37](https://github.com/VisioncreatorEarth/Hominio/commit/15cdd3707888901eec25851a41eb1b9a1cb917f8))
* **wallet:** add required 'use' array to Polar plugin configuration ([75bcee5](https://github.com/VisioncreatorEarth/Hominio/commit/75bcee5960d1018fe4c34be1937192c86f788dfb))
* **wallet:** ensure migration script runs correctly in deployment workflow ([c8945f8](https://github.com/VisioncreatorEarth/Hominio/commit/c8945f87f30afd1633d351194a4d406b3d3fbc7f))
* **wallet:** ensure Polar plugin only added when API key exists ([73e9ca8](https://github.com/VisioncreatorEarth/Hominio/commit/73e9ca89359cd43a5b6707e7d1164fd0b258bcd8))
* **wallet:** fix Tailwind CSS module resolution in monorepo ([13f51b1](https://github.com/VisioncreatorEarth/Hominio/commit/13f51b13e4b7b5d4cbbdc6b9fc920d244174b05b))
* **wallet:** include auth.migrate.ts in Docker image for migrations ([be2582c](https://github.com/VisioncreatorEarth/Hominio/commit/be2582c36eba605c39193037cb69ff61fcb188c6))
* **wallet:** update migration script to use camelCase column names ([95475d4](https://github.com/VisioncreatorEarth/Hominio/commit/95475d439e59db376fd3c718115c8380bcfe68af))
* **wallet:** use bunx instead of npx and install @better-auth/cli ([f6aab72](https://github.com/VisioncreatorEarth/Hominio/commit/f6aab720011ef0f2f0a1c27a43e78c7bc7c24fb4))
* **wallet:** use bunx to run BetterAuth CLI migration ([79a7445](https://github.com/VisioncreatorEarth/Hominio/commit/79a7445ea5a0338c82c542968bd584200ae90968))
* **wallet:** use process.env instead of SvelteKit  in migration script ([4e2fe54](https://github.com/VisioncreatorEarth/Hominio/commit/4e2fe543b949c806221b6d1d8241fa64d8b0b9e1))
* **wallet:** use process.env instead of SvelteKit  in migration script ([e688aaf](https://github.com/VisioncreatorEarth/Hominio/commit/e688aafdcc50e2031a7cba5765dc1ecfb22bab66))


### Features

* add API endpoint and admin UI button to add hotel capability to Hominio Explorer group ([1c990b1](https://github.com/VisioncreatorEarth/Hominio/commit/1c990b1b4b75630ad6997a80fe56ca7f04c67f9a))
* add authentication check and redirect to game service ([f84b3d0](https://github.com/VisioncreatorEarth/Hominio/commit/f84b3d04567e9bc33eae4fcea9d16f4d10f942aa))
* add avatar property to Human schema and migration system ([72cf360](https://github.com/VisioncreatorEarth/Hominio/commit/72cf360af58b1a7c0c02bc7263b851d0671205aa))
* add avatar schema with Google profile sync and image previews ([97c1fa8](https://github.com/VisioncreatorEarth/Hominio/commit/97c1fa8a7900525d74b6fdc4abd711e4b1bd115e))
* add Badge atom component and display hex values in color swatches ([dde4c24](https://github.com/VisioncreatorEarth/Hominio/commit/dde4c24096c19fb99872c8691b9553b4f371bac2))
* add basic minecraft-like first person controls and scene to game service ([887316c](https://github.com/VisioncreatorEarth/Hominio/commit/887316ca769ad71ef5cb54f6b393391520fe1cee))
* add config view and separate view buttons ([3a67923](https://github.com/VisioncreatorEarth/Hominio/commit/3a67923f9ed6a33d8cd694d0e9313612d5b29f63))
* add context injection events to activity stream UI ([4586a6c](https://github.com/VisioncreatorEarth/Hominio/commit/4586a6ced18013f58658132ad670af6e3cf907ee))
* add deployment workflows for sync and API services ([5e1a178](https://github.com/VisioncreatorEarth/Hominio/commit/5e1a17867db4488a605ece8547ed02ee75041d8a))
* add flexible schema system with hotels and admin CRUD UI ([cb84548](https://github.com/VisioncreatorEarth/Hominio/commit/cb845485b50c3f70481a4241a949749bef412afb))
* add home button to Charles route and make buttons larger ([04edc9f](https://github.com/VisioncreatorEarth/Hominio/commit/04edc9f67ce06bac5a9b0f07182a105aa8d48069))
* add logout button to profile and auto-routing for auth state ([4b020a5](https://github.com/VisioncreatorEarth/Hominio/commit/4b020a5cfb191dfc9fd4a820fa94a1fc52ef344c))
* add read all schemas capability to Hominio Explorer group ([b864334](https://github.com/VisioncreatorEarth/Hominio/commit/b86433430c183509e63e277ee6cb7930abc7e083))
* add tool call example with AI state indicators ([76ae863](https://github.com/VisioncreatorEarth/Hominio/commit/76ae863edfd1fbafedde226c85932e9227e5a0a9))
* add Zero sync and API services with Better Auth integration ([f8f88d4](https://github.com/VisioncreatorEarth/Hominio/commit/f8f88d4df445a015e5104543f04f7104b0476877))
* complete NavPill redesign with voice-controlled agent navigation ([252c641](https://github.com/VisioncreatorEarth/Hominio/commit/252c641e3964f502989fecd92e92072940f00608))
* compositor kanban drag-drop, status badges, and improvements ([9f11dfe](https://github.com/VisioncreatorEarth/Hominio/commit/9f11dfe7e488d602e4767023210275cb10bb398a))
* compositor UI slot system with generic event mapping ([9b21825](https://github.com/VisioncreatorEarth/Hominio/commit/9b218250cd191e972823662dd75d86d9db383775))
* create unified profile page with capabilities management ([0db22d7](https://github.com/VisioncreatorEarth/Hominio/commit/0db22d719f12cf817e7ceb67bea88e8ac3cf0190))
* enable voice mode with Google Live API integration ([6116c82](https://github.com/VisioncreatorEarth/Hominio/commit/6116c828833a8c79f0c25b398215cdaa0d6a2a24))
* extract JazzMetadata into reusable toggleable component ([d42946c](https://github.com/VisioncreatorEarth/Hominio/commit/d42946c369c9850997d938ebe2c75fa7ba45da29))
* **game:** enhance terrain textures and generation logic ([e326f0c](https://github.com/VisioncreatorEarth/Hominio/commit/e326f0c647bf3602e618fda578b757753cdb8239))
* implement Hominio Design System with Panda CSS ([026e411](https://github.com/VisioncreatorEarth/Hominio/commit/026e41161635f297d658d79955d038a316c98cac))
* implement universal tool call system with dynamic menu context ([aebc9cf](https://github.com/VisioncreatorEarth/Hominio/commit/aebc9cfe8493781a3e8c346db627d3f603cba4c4))
* introduced capabilities system ([ab027bb](https://github.com/VisioncreatorEarth/Hominio/commit/ab027bb8ab5afb3f8604fbe816eae8ae89fca80d))
* move menu data to skill config and add Charles admin page ([3dc6169](https://github.com/VisioncreatorEarth/Hominio/commit/3dc6169a6e4212ce7d6e46a06af648ff869fd3e1))
* new agent calendar ([e8b2b5c](https://github.com/VisioncreatorEarth/Hominio/commit/e8b2b5c2e8a7e871ff37da54d1824ccaf14c8da8))
* replace trees with mango trees in milestone 1 and improve asset loading ([69cac64](https://github.com/VisioncreatorEarth/Hominio/commit/69cac6429e7382b7453e18ab040bba0830689c7b))
* restyle app service with light liquid glass design ([46e9d46](https://github.com/VisioncreatorEarth/Hominio/commit/46e9d467a1e90098ff8fa03ec63e07236fd11b4e))
* show group capabilities with collapsible sub-capabilities in My Capabilities ([d4b5d08](https://github.com/VisioncreatorEarth/Hominio/commit/d4b5d08df34c0ee0e79726108b9e7e34851ee1ec))
* **wallet/auth:** improve sign-in UI and NavPill positioning ([6cca027](https://github.com/VisioncreatorEarth/Hominio/commit/6cca027a14356d6bad6e7d3349477b5dd950f862))
* **wallet:** add automatic database migration to deployment workflow ([605e2d1](https://github.com/VisioncreatorEarth/Hominio/commit/605e2d132b298ba49d4d92ca9b1173468e086bb8))
* **wallet:** add passkey plugin table to migration script ([f404e54](https://github.com/VisioncreatorEarth/Hominio/commit/f404e54734e803ae6a66097e6d453823129385e0))
* **wallet:** setup Fly.io deployment with GitHub Actions ([0bdc19d](https://github.com/VisioncreatorEarth/Hominio/commit/0bdc19d0c25ca6dd30128ca297c527f76b92333c))
* **wallet:** use BetterAuth native CLI migration ([19222c6](https://github.com/VisioncreatorEarth/Hominio/commit/19222c64fd6ddff1c91ea629deb3ff3271a5a0bb))
* WIP compositor part 1 - unified reactive data store and generic compositor component ([96d42ff](https://github.com/VisioncreatorEarth/Hominio/commit/96d42ff14028285d1f625bbe809c23425246edd9))
* WIP compositor part 2 - skill registry system and agent configuration ([04f1f34](https://github.com/VisioncreatorEarth/Hominio/commit/04f1f346fc08479e4a756fc75f445c75e4f9ca96))


### Performance Improvements

* **ci:** improve Rust library cache check with debug output ([b299071](https://github.com/VisioncreatorEarth/Hominio/commit/b2990712667774a19e14b56b279701b010e961b6))
* **ci:** improve Rust library cache check with debug output ([5eca6e4](https://github.com/VisioncreatorEarth/Hominio/commit/5eca6e4c2175e6fb725a29c152792dd9c915fb16))
* **ci:** optimize iOS build to skip Rust compilation when library exists in cache ([86d38a7](https://github.com/VisioncreatorEarth/Hominio/commit/86d38a7767453c55a8be5fbecc6a3167635766fa))
* **ci:** optimize iOS workflow with caching and better organization ([b0ca97c](https://github.com/VisioncreatorEarth/Hominio/commit/b0ca97c11291333622c578947eb3052662488bf9))
* **ci:** remove redundant Rust build step - Xcode pre-build script handles it ([6df67d3](https://github.com/VisioncreatorEarth/Hominio/commit/6df67d35890943b06c05680b946f3843aca6e4f9))
* **ci:** use swatinem/rust-cache for better Rust build caching ([8720ebf](https://github.com/VisioncreatorEarth/Hominio/commit/8720ebf51e06955b6d21a8fe1c327d55de04ae8b))


### Reverts

* remove context injection event UI logic ([6a96534](https://github.com/VisioncreatorEarth/Hominio/commit/6a965344c4b1eb3f3d8ec23e36a4abf5d076a005))
* Revert "fix: add missing --admin-password flag to sync service Dockerfile" ([ef0590f](https://github.com/VisioncreatorEarth/Hominio/commit/ef0590f6b1f3125e2716980f4827fe5c1c00aba5))

## [0.16.3](https://github.com/hominiome/hominio/compare/v0.16.2...v0.16.3) (2025-11-28)


### Bug Fixes

* prevent duplicate responses for view operations and reorder tool calls ([26c9a02](https://github.com/hominiome/hominio/commit/26c9a0247890c8d948e7192e626fff349587e3b0))
* properly handle svelte-kit sync failure in Docker build ([956fad3](https://github.com/hominiome/hominio/commit/956fad3210133b6d5a0395ed36e2fe1f8790ca63))
* remove repeated prompt after queryDataContext and harden Docker build ([4d39355](https://github.com/hominiome/hominio/commit/4d39355cadc9e8d0e08ef6b0084840ec855ac9e5))
* restore error handling for svelte-kit sync in Docker build ([8b2fbf1](https://github.com/hominiome/hominio/commit/8b2fbf1a36c097c4c2bd463caf2d837c34b52858))
* restore Karl workflow and improve menu pricing styling ([02a4cf8](https://github.com/hominiome/hominio/commit/02a4cf8c069db6b0b5c71921eeedb3203786a470))

## [0.16.2](https://github.com/hominiome/hominio/compare/v0.16.1...v0.16.2) (2025-11-28)


### Bug Fixes

* ensure svelte-kit sync runs before build in Docker ([df6e07f](https://github.com/hominiome/hominio/commit/df6e07fa434bad6ec878e4231246c441a2b7f3bd))
* exclude edit and delete operations from repeated prompt injection ([9ad754e](https://github.com/hominiome/hominio/commit/9ad754e4b8719b874945e0bba1360761cee87199))
* use bunx for svelte-kit sync in Docker build ([6a750f6](https://github.com/hominiome/hominio/commit/6a750f673b1c9a67e61084ebe8fab44e6c31fcb1))
* use npx for svelte-kit sync in Docker build ([a5d2d41](https://github.com/hominiome/hominio/commit/a5d2d419b45ce7987b417b275310f16df4bdfd0b))

## [0.16.1](https://github.com/hominiome/hominio/compare/v0.16.0...v0.16.1) (2025-11-28)


### Bug Fixes

* add vite alias for @hominio/brand/views to resolve build errors ([3a20c18](https://github.com/hominiome/hominio/commit/3a20c18f738cd1e651cee565e057b881e6e7c057))
* correct comment in injectVibeContext to match actual behavior ([b571511](https://github.com/hominiome/hominio/commit/b571511a6ffe395e5456ea36017ef196961216e4))
* extract CalendarEntry interface to shared types file ([bb4e08b](https://github.com/hominiome/hominio/commit/bb4e08b20e6e4f968f0b51e2fda9f1e356591fcf))
* prevent duplicate AI responses from queryDataContext ([774ca6f](https://github.com/hominiome/hominio/commit/774ca6f42799d9bdca8001d95c05b72ed8cc2322))
* reduce gap between activity stream elements ([da661d0](https://github.com/hominiome/hominio/commit/da661d018b2054b6b5d0d20aef89c10f23e6391b))
* resolve calendar view props mismatch and formatDuration plural bug ([0801a99](https://github.com/hominiome/hominio/commit/0801a99e1f16e06742132ab4500568b667beb511))
* resolve context injection feedback loops and improve calendar entry UI ([48b2db6](https://github.com/hominiome/hominio/commit/48b2db6d2042f5e82a7769e3ebbda85e7f65b12b))
* resolve syntax error and wallet deployment issue ([b03f68f](https://github.com/hominiome/hominio/commit/b03f68fffad0bc881941e97facb6f3b011dd0dd4))

# [0.16.0](https://github.com/hominiome/hominio/compare/v0.15.2...v0.16.0) (2025-11-28)


### Bug Fixes

* add missing dependencies to wallet service ([f1abf64](https://github.com/hominiome/hominio/commit/f1abf64b488b4808c803c9e88c02586b0a1597bd))
* ensure svelte-kit sync runs before build in Docker ([979e0c4](https://github.com/hominiome/hominio/commit/979e0c43ff940d6ef6d63b55f4c571a3b61adbec))


### Features

* add context injection events to activity stream UI ([4586a6c](https://github.com/hominiome/hominio/commit/4586a6ced18013f58658132ad670af6e3cf907ee))


### Reverts

* remove context injection event UI logic ([6a96534](https://github.com/hominiome/hominio/commit/6a965344c4b1eb3f3d8ec23e36a4abf5d076a005))

## [0.15.2](https://github.com/hominiome/hominio/compare/v0.15.1...v0.15.2) (2025-11-28)


### Bug Fixes

* correct ActivityStreamItem state initialization to avoid Svelte warning ([ac4c616](https://github.com/hominiome/hominio/commit/ac4c6163d24763d2817d67a0a7ba3b14e81fd573))
* improve Charles vibe prompt to proactively use filters for menu and wellness ([4cc90f1](https://github.com/hominiome/hominio/commit/4cc90f1e9af4eb23c1c5cd991fcd43a4ec0b566e))
* improve UI spacing and styling for calendar, menu, and wellness components ([0ed9e0d](https://github.com/hominiome/hominio/commit/0ed9e0d26aaa6d2bc8fabd3f1c81321754590855))
* prevent duplicate AI responses and remove admin/logs view ([4e2e026](https://github.com/hominiome/hominio/commit/4e2e02682b7c0b02fe79ab309de9820a249971af))
* resolve deployment pipeline errors for app and wallet services ([0df1c21](https://github.com/hominiome/hominio/commit/0df1c214fad8cb64897bb595e6041be089dbc697))
* resolve voice session flow and API deployment issues ([fc93e95](https://github.com/hominiome/hominio/commit/fc93e95adf7a55d4416e00c153e3f821629bbf11))

## [0.15.1](https://github.com/hominiome/hominio/compare/v0.15.0...v0.15.1) (2025-11-28)


### Bug Fixes

* add call logs sidebar to /me route and fix deployment pipeline ([9f06437](https://github.com/hominiome/hominio/commit/9f0643781ab3ddfc65107ff1620dea2489339ee1))

# [0.15.0](https://github.com/hominiome/hominio/compare/v0.14.1...v0.15.0) (2025-11-28)


### Bug Fixes

* add game service to dev script on port 4205 and remove unused CSS selectors ([adb2505](https://github.com/hominiome/hominio/commit/adb250593ae67dce95065ba9851d0d61983b1761))
* ensure audio playback reliability by sequencing mixed message types ([704f866](https://github.com/hominiome/hominio/commit/704f8664b1cc577fce7ee4f0edc91439d6222ff1))
* move vibes UI components back to hominio-vibes package and refactor to use Tailwind ([0a580f7](https://github.com/hominiome/hominio/commit/0a580f7539d73f3175f8a324c6f390daa59777d1))
* respect callback origin in auth redirect and add game service support ([839158f](https://github.com/hominiome/hominio/commit/839158f827caf648be3fbe2e844ec10bb5fb3510))


### Features

* add authentication check and redirect to game service ([f84b3d0](https://github.com/hominiome/hominio/commit/f84b3d04567e9bc33eae4fcea9d16f4d10f942aa))
* add basic minecraft-like first person controls and scene to game service ([887316c](https://github.com/hominiome/hominio/commit/887316ca769ad71ef5cb54f6b393391520fe1cee))
* **game:** enhance terrain textures and generation logic ([e326f0c](https://github.com/hominiome/hominio/commit/e326f0c647bf3602e618fda578b757753cdb8239))
* replace trees with mango trees in milestone 1 and improve asset loading ([69cac64](https://github.com/hominiome/hominio/commit/69cac6429e7382b7453e18ab040bba0830689c7b))

## [0.14.1](https://github.com/hominiome/hominio/compare/v0.14.0...v0.14.1) (2025-11-22)


### Bug Fixes

* add wellness skill to Charles agent and improve tool recognition ([76d4751](https://github.com/hominiome/hominio/commit/76d47513db39213a7070e0347c7ff26d4b467352))

# [0.14.0](https://github.com/hominiome/hominio/compare/v0.13.1...v0.14.0) (2025-11-22)


### Features

* new agent calendar ([e8b2b5c](https://github.com/hominiome/hominio/commit/e8b2b5c2e8a7e871ff37da54d1824ccaf14c8da8))

## [0.13.1](https://github.com/hominiome/hominio/compare/v0.13.0...v0.13.1) (2025-11-22)


### Bug Fixes

* show 'Go To App' label on mobile in NavPill CTA button ([3f587e6](https://github.com/hominiome/hominio/commit/3f587e6a87d2589a7682f4d8e635685494b4fdd8))

# [0.13.0](https://github.com/hominiome/hominio/compare/v0.12.15...v0.13.0) (2025-11-21)


### Bug Fixes

* add admin auth check to auto-assign endpoint and improve nav pill ([159265d](https://github.com/hominiome/hominio/commit/159265d4052fab6d0d482d085f35803514b2b92d))
* align back button with nav pill styling and positioning ([e91567a](https://github.com/hominiome/hominio/commit/e91567ab42c75658c6bb017c6f37ebac83fb4135))
* correct NeonDialect import from kysely-neon package ([2d0e94f](https://github.com/hominiome/hominio/commit/2d0e94f868b55a7f4390215d8d3e4e6fca6b23eb))
* decrease nav pill bar height to 36px ([a430c01](https://github.com/hominiome/hominio/commit/a430c01262758f24fe4270770101af8084e02ad4))
* enforce exact 36px height for nav pill on all screen sizes ([ac441bf](https://github.com/hominiome/hominio/commit/ac441bf19b4dfd6706a43a906468bea80b457c97))
* enlarge back/home buttons to 56px on tablet and desktop ([92164cf](https://github.com/hominiome/hominio/commit/92164cfce3151b681460ad53585d30e248511ca4))
* filter out group capabilities from admin capabilities list ([e8d94b2](https://github.com/hominiome/hominio/commit/e8d94b29e59fd2e950c098b2672e9f0040e8a0bb))
* improve group capability styling and fix collapsible functionality ([e1afb1a](https://github.com/hominiome/hominio/commit/e1afb1ab2ca5ea768891d348f5db042d6838ab4a))
* improve group capability UI and add admin authentication ([e888883](https://github.com/hominiome/hominio/commit/e888883e762699db48a336a0e3e06933e078e081))
* improve nav pill button sizes and spacing, remove back to app label ([a14fbe7](https://github.com/hominiome/hominio/commit/a14fbe776939d4d76f6ff879eef828bad0bd1586))
* increase nav pill bar height to 48px ([ce7ce05](https://github.com/hominiome/hominio/commit/ce7ce053a29a7586d72a715fae64164099c3937f))
* keep back/home button size on tablet, only enlarge on desktop ([ce0c97a](https://github.com/hominiome/hominio/commit/ce0c97a731439d40d98b1ac8905a2f7ed0171185))
* keep call button size on tablet and enlarge back/home buttons ([6b158c1](https://github.com/hominiome/hominio/commit/6b158c1e63ee2b34d0db1270050ff4c06c8d2f9f))
* left-align collapse button and capability counter with proper padding ([92c81e3](https://github.com/hominiome/hominio/commit/92c81e365b90fb6dd32de10922bd8164d72ed270))
* make group capability UI more subtle with lighter colors and icon-only button ([2fcfd01](https://github.com/hominiome/hominio/commit/2fcfd018ac8216537934ac2940ed237e1f3c6d19))
* match bottom padding to top padding in group capability toggle row ([d1fe3fd](https://github.com/hominiome/hominio/commit/d1fe3fd75576f0c7b19df79287e1bf0600214287))
* mobile NavPill label, menu back button, call button shadow, and group capabilities display ([d624f7a](https://github.com/hominiome/hominio/commit/d624f7a9ce749e96381edec963a09983190ba04d))
* revert nav pill height constraints to restore layout ([1fa75fb](https://github.com/hominiome/hominio/commit/1fa75fb668d9b231df4daecbcec79b8ff90c3696))
* use brand colors, remove emoji, improve group capability UI ([42fdd46](https://github.com/hominiome/hominio/commit/42fdd4679d5187cdcb410b5e39efda749e546943))


### Features

* add API endpoint and admin UI button to add hotel capability to Hominio Explorer group ([1c990b1](https://github.com/hominiome/hominio/commit/1c990b1b4b75630ad6997a80fe56ca7f04c67f9a))
* add home button to Charles route and make buttons larger ([04edc9f](https://github.com/hominiome/hominio/commit/04edc9f67ce06bac5a9b0f07182a105aa8d48069))
* add read all schemas capability to Hominio Explorer group ([b864334](https://github.com/hominiome/hominio/commit/b86433430c183509e63e277ee6cb7930abc7e083))
* show group capabilities with collapsible sub-capabilities in My Capabilities ([d4b5d08](https://github.com/hominiome/hominio/commit/d4b5d08df34c0ee0e79726108b9e7e34851ee1ec))

## [0.12.15](https://github.com/hominiome/hominio/compare/v0.12.14...v0.12.15) (2025-11-21)


### Bug Fixes

* enforce truly fixed width for pricing section using CSS with !important ([2d08ca1](https://github.com/hominiome/hominio/commit/2d08ca19f73a8c7c5a0eecb193adfa474ddb8014))
* ensure pricing section has fixed width across all items ([a62f46c](https://github.com/hominiome/hominio/commit/a62f46cfdf5aed1e8b6510ac99c81adea6939f20))
* make quantity label even smaller for better proportion ([f975adb](https://github.com/hominiome/hominio/commit/f975adb12231d7ec9c3de193e11fb518d6ed9b35))
* make quantity label same size as description and consistent across views ([8e9cc4a](https://github.com/hominiome/hominio/commit/8e9cc4aae14db2a50e693fede381ed15a0f50a25))
* remove GlassCard wrapper on mobile, keep on tablet/desktop ([8a8c544](https://github.com/hominiome/hominio/commit/8a8c544ac04024e7af810ff42815d032a1e3bbc0))
* remove menu wrapper padding, category icons, and make pricing more compact ([f0a9528](https://github.com/hominiome/hominio/commit/f0a9528715ec237dc8c2fe7a9703fd934e3c6540))
* remove space between price and euro symbol ([3d671c2](https://github.com/hominiome/hominio/commit/3d671c28830cf446495ad61a2711da84acff6e7a))
* remove wrapper styling, fix quantity label size, and make price box responsive ([f93f147](https://github.com/hominiome/hominio/commit/f93f147d4358f47aedb1f2f891a155d76a9b18ed))

## [0.12.14](https://github.com/hominiome/hominio/compare/v0.12.13...v0.12.14) (2025-11-21)


### Bug Fixes

* make menu more compact on mobile with smaller text and narrower pricing ([f8de4ba](https://github.com/hominiome/hominio/commit/f8de4ba311ce70ebe71aa58a2a7b08a4d9779630))
* prevent forever-spinning loading state for hotels without capability ([68f4261](https://github.com/hominiome/hominio/commit/68f42611c1e902df230a6c2486e177cf557f9f82))

## [0.12.13](https://github.com/hominiome/hominio/compare/v0.12.12...v0.12.13) (2025-11-21)


### Bug Fixes

* add PUBLIC_DOMAIN_API to wallet service and improve WebSocket auth logging ([dadf7ed](https://github.com/hominiome/hominio/commit/dadf7ed2b6e86b040f28baf618416700a8bb4379))

## [0.12.12](https://github.com/hominiome/hominio/compare/v0.12.11...v0.12.12) (2025-11-21)


### Bug Fixes

* add ZERO_POSTGRES_SECRET to wallet service deployment ([6c31fcc](https://github.com/hominiome/hominio/commit/6c31fcc33c88f52cac672b0fbb5c1c823c4dded9))

## [0.12.11](https://github.com/hominiome/hominio/compare/v0.12.10...v0.12.11) (2025-11-21)


### Bug Fixes

* migrate capabilities to schema IDs and fix WebSocket voice API connection ([7cc57e2](https://github.com/hominiome/hominio/commit/7cc57e2c699fb19b48ed82b68bafb92372e198b8))

## [0.12.10](https://github.com/hominiome/hominio/compare/v0.12.9...v0.12.10) (2025-11-21)


### Bug Fixes

* update schema lookup to use name-scoped identifiers and fix validation export ([c6fc642](https://github.com/hominiome/hominio/commit/c6fc64290ee71692c760cd100f1965b54aa60cfd))

## [0.12.9](https://github.com/hominiome/hominio/compare/v0.12.8...v0.12.9) (2025-11-21)


### Bug Fixes

* remove invalid --listen flag, --port should be sufficient ([2a2c301](https://github.com/hominiome/hominio/commit/2a2c301a75c785c648440cc39eedaaffc01df374))
* use AUTH_SECRET instead of ZERO_AUTH_SECRET and ZERO_ADMIN_AUTH ([5472f70](https://github.com/hominiome/hominio/commit/5472f70e5b234343e0cfcd26e15445930f52fd6e))

## [0.12.8](https://github.com/hominiome/hominio/compare/v0.12.7...v0.12.8) (2025-11-21)


### Bug Fixes

* add explicit port flag and admin-password fallback ([6365ff0](https://github.com/hominiome/hominio/commit/6365ff0cac3ef149124b9753cd530be63fd03ae9))

## [0.12.7](https://github.com/hominiome/hominio/compare/v0.12.6...v0.12.7) (2025-11-21)


### Bug Fixes

* improve sync service deployment config and remove deprecated flags ([8237e2a](https://github.com/hominiome/hominio/commit/8237e2af95d65d28908663af47a2b7916ac0bda2))
* improve sync service health checks and deployment reliability ([3780cf1](https://github.com/hominiome/hominio/commit/3780cf1502c111960162f0c28d8e1ccd47dbe411))

## [0.12.6](https://github.com/hominiome/hominio/compare/v0.12.5...v0.12.6) (2025-11-21)


### Bug Fixes

* add --admin-password flag using ZERO_ADMIN_AUTH secret ([56139ba](https://github.com/hominiome/hominio/commit/56139ba32f3144a23abbff9d450c619baf9375d5))

## [0.12.5](https://github.com/hominiome/hominio/compare/v0.12.4...v0.12.5) (2025-11-21)


### Bug Fixes

* revert sync service to working configuration (remove --admin-password flag and AUTH_SECRET) ([87fdff6](https://github.com/hominiome/hominio/commit/87fdff6ee5157d7a6a7f4188f463effaecbca425))
* revert sync service to working configuration (remove --admin-password flag) ([cd420fb](https://github.com/hominiome/hominio/commit/cd420fbe0f44c29139f42122a2cf2eba615e872f))

## [0.12.4](https://github.com/hominiome/hominio/compare/v0.12.3...v0.12.4) (2025-11-21)


### Bug Fixes

* add missing --admin-password flag to sync service Dockerfile (required in production) ([a63877e](https://github.com/hominiome/hominio/commit/a63877e54c68a8e3bbcc37dcf326c2fe4cc99bc3))

## [0.12.3](https://github.com/hominiome/hominio/compare/v0.12.2...v0.12.3) (2025-11-21)


### Bug Fixes

* add PUBLIC_DOMAIN_WALLET to API service deployment secrets ([a8b0f7a](https://github.com/hominiome/hominio/commit/a8b0f7a6a13356ba2d3c8d04d4c47c04556e122f))

## [0.12.2](https://github.com/hominiome/hominio/compare/v0.12.1...v0.12.2) (2025-11-21)


### Bug Fixes

* add missing --admin-password flag to sync service Dockerfile ([a9bdbfd](https://github.com/hominiome/hominio/commit/a9bdbfd8602a00ec279f3df4e53d9c05146f37f6))
* add missing @hominio/agents dependency to API service ([38aeb92](https://github.com/hominiome/hominio/commit/38aeb92e7fe12b3dacc8040f98b31aaadff61195))


### Reverts

* Revert "fix: add missing --admin-password flag to sync service Dockerfile" ([ef0590f](https://github.com/hominiome/hominio/commit/ef0590f6b1f3125e2716980f4827fe5c1c00aba5))

## [0.12.1](https://github.com/hominiome/hominio/compare/v0.12.0...v0.12.1) (2025-11-21)


### Bug Fixes

* revert Safari WebSocket fix that broke production connections ([9b0c570](https://github.com/hominiome/hominio/commit/9b0c5702186f2fa7cc51809280d6042852ef489c))

# [0.12.0](https://github.com/hominiome/hominio/compare/v0.11.5...v0.12.0) (2025-11-21)


### Features

* add flexible schema system with hotels and admin CRUD UI ([cb84548](https://github.com/hominiome/hominio/commit/cb845485b50c3f70481a4241a949749bef412afb))

## [0.11.5](https://github.com/hominiome/hominio/compare/v0.11.4...v0.11.5) (2025-11-21)


### Bug Fixes

* iOS safe area background colors match page background ([1ce6661](https://github.com/hominiome/hominio/commit/1ce66616fbd24101e56ebb6721c0ebd1ab9d288f))
* prevent double wallet subdomain in production admin API calls ([0a7c375](https://github.com/hominiome/hominio/commit/0a7c375d7e332080e375effd05190c39364b8038))

## [0.11.4](https://github.com/hominiome/hominio/compare/v0.11.3...v0.11.4) (2025-11-21)


### Bug Fixes

* add CORS headers to capabilities endpoint and update brand colors ([346f2cc](https://github.com/hominiome/hominio/commit/346f2cc011ed6525b710d6d1e9e28308c94901f3))
* add CORS headers to capabilities endpoint for cross-origin requests ([8ee19fe](https://github.com/hominiome/hominio/commit/8ee19fe68eb705c1e561ac2adc7c1e91f34b88c6))
* improve WebSocket reconnection and admin dashboard mobile responsiveness ([a1f4621](https://github.com/hominiome/hominio/commit/a1f46218451cced07e83ade077b951d7149a3c89))
* restore service detection fallback for monorepo root execution ([5e04472](https://github.com/hominiome/hominio/commit/5e0447233983dc48a1e74bad9f5033f19770dd69))
* update voice call UI colors to match brand guidelines ([4c5dae3](https://github.com/hominiome/hominio/commit/4c5dae3727efa63043ef12bb93ed12b59e23f4f8)), closes [#dc2626](https://github.com/hominiome/hominio/issues/dc2626)
* use darker red-700 for end call button to match brand alert color ([8d443f5](https://github.com/hominiome/hominio/commit/8d443f5f0bee281877cd90055d96843c990091b7)), closes [#b91c1c](https://github.com/hominiome/hominio/issues/b91c1c)

## [0.11.3](https://github.com/hominiome/hominio/compare/v0.11.2...v0.11.3) (2025-11-21)


### Bug Fixes

* correct sync domain construction and service detection logic ([64741cf](https://github.com/hominiome/hominio/commit/64741cf50b8547c820bb177b4d575683092a1522))

## [0.11.2](https://github.com/hominiome/hominio/compare/v0.11.1...v0.11.2) (2025-11-21)


### Bug Fixes

* sync brand assets during Docker builds and pass ADMIN to migrations ([93116eb](https://github.com/hominiome/hominio/commit/93116ebe218d43fb293e95922d6b36859a1e2e8a))

## [0.11.1](https://github.com/hominiome/hominio/compare/v0.11.0...v0.11.1) (2025-11-21)


### Bug Fixes

* resolve container queries import, wallet NavPill CTA state, profile page DOM structure, and deployment issues ([2ecf8be](https://github.com/hominiome/hominio/commit/2ecf8be10f4d27db1ce2762703c03cacdd3e0752))
* update NavPill CTA state and button text styling ([db24aee](https://github.com/hominiome/hominio/commit/db24aee9061d2b1b0c52bc5649ce2d8ec9535c82))

# [0.11.0](https://github.com/hominiome/hominio/compare/v0.10.6...v0.11.0) (2025-11-21)


### Bug Fixes

* centralize design system into @hominio/brand package ([ad7c599](https://github.com/hominiome/hominio/commit/ad7c5995d285e1e3e02b29646d09dce5fc54e0bf))
* standardize menu pricing width and add voice capability check modal ([05dcdef](https://github.com/hominiome/hominio/commit/05dcdef79c5a2482b724f4d1a5018ab60855a2e8))
* universal favicon setup and tool call handler improvements ([efde2d7](https://github.com/hominiome/hominio/commit/efde2d711329dfb0b9fbea678e37468be2ff15d9))


### Features

* complete NavPill redesign with voice-controlled agent navigation ([252c641](https://github.com/hominiome/hominio/commit/252c641e3964f502989fecd92e92072940f00608))
* implement universal tool call system with dynamic menu context ([aebc9cf](https://github.com/hominiome/hominio/commit/aebc9cfe8493781a3e8c346db627d3f603cba4c4))
* move menu data to skill config and add Charles admin page ([3dc6169](https://github.com/hominiome/hominio/commit/3dc6169a6e4212ce7d6e46a06af648ff869fd3e1))

## [0.10.6](https://github.com/hominiome/hominio/compare/v0.10.5...v0.10.6) (2025-11-20)


### Bug Fixes

* remove TypeScript type annotation from JavaScript Svelte file ([db26b97](https://github.com/hominiome/hominio/commit/db26b97c2ba5945ed74bb335e7b9f4855fb08712))

## [0.10.5](https://github.com/hominiome/hominio/compare/v0.10.4...v0.10.5) (2025-11-20)


### Bug Fixes

* replace hardcoded localhost redirects with env vars in production ([dbe63ab](https://github.com/hominiome/hominio/commit/dbe63ab9682beeeb14ef65e0079c5ac89feb884f))

## [0.10.4](https://github.com/hominiome/hominio/compare/v0.10.3...v0.10.4) (2025-11-20)


### Bug Fixes

* remove --frozen-lockfile from Docker builds for testing ([cdfc8bd](https://github.com/hominiome/hominio/commit/cdfc8bd658dadef773f84e4d19eaedbeb99da2a6))

## [0.10.3](https://github.com/hominiome/hominio/compare/v0.10.2...v0.10.3) (2025-11-20)


### Bug Fixes

* pin Bun version in Dockerfiles and cleanup Zero ports ([a5a1511](https://github.com/hominiome/hominio/commit/a5a15114d2a261233c8d57fa3d6f0e85c93bdce3))
* update lockfile after version sync ([489dd06](https://github.com/hominiome/hominio/commit/489dd06ed480aff2bd7c16cdd472b84a30464df7))

## [0.10.2](https://github.com/hominiome/hominio/compare/v0.10.1...v0.10.2) (2025-11-20)


### Bug Fixes

* run capabilities migration in production deployment ([cc6d6e3](https://github.com/hominiome/hominio/commit/cc6d6e3d152c1b8298e59b7c6ea1a90758716406))
* update lockfile to sync with dependencies ([2c11bb9](https://github.com/hominiome/hominio/commit/2c11bb9260d47af7b6e72bbbcd60d4f8fd25f4b3))
* update lockfile to sync with dependencies ([13f1ae7](https://github.com/hominiome/hominio/commit/13f1ae76dd6d9dd53c941fa819ebb90c16f82179))

## [0.10.1](https://github.com/hominiome/hominio/compare/v0.10.0...v0.10.1) (2025-11-20)


### Bug Fixes

* update lockfile to sync with package.json dependencies ([33666a8](https://github.com/hominiome/hominio/commit/33666a873d3d3597fb18876bd2e086b2cc5bbef4))

# [0.10.0](https://github.com/hominiome/hominio/compare/v0.9.0...v0.10.0) (2025-11-20)


### Bug Fixes

* update lockfile for API service deployment ([3e948c8](https://github.com/hominiome/hominio/commit/3e948c8d6c67648e940703ce03249749a88e8136))


### Features

* add logout button to profile and auto-routing for auth state ([4b020a5](https://github.com/hominiome/hominio/commit/4b020a5cfb191dfc9fd4a820fa94a1fc52ef344c))
* restyle app service with light liquid glass design ([46e9d46](https://github.com/hominiome/hominio/commit/46e9d467a1e90098ff8fa03ec63e07236fd11b4e))

# [0.9.0](https://github.com/hominiome/hominio/compare/v0.8.0...v0.9.0) (2025-11-20)


### Bug Fixes

* add debug logging to capabilities routes ([f46f5c6](https://github.com/hominiome/hominio/commit/f46f5c651807b3b10e5228d8c0b2a6429850df75))
* center profile image, name, and email on x-axis ([89d2b56](https://github.com/hominiome/hominio/commit/89d2b56e5335817fa3cd9c1972bd88883b6b436c))
* comment out capabilities logic, focus on profile display only ([6cd0650](https://github.com/hominiome/hominio/commit/6cd0650755ddddb5903a5199c5ae77828b55c914))
* improve profile page loading state and error handling ([8795957](https://github.com/hominiome/hominio/commit/8795957b766190da0059908f24d8d7e818910e85))
* update Dockerfiles and workflows for new workspace dependencies ([970fb44](https://github.com/hominiome/hominio/commit/970fb44fe6c251bef6cc365b478905fcdd62c0bd))


### Features

* create unified profile page with capabilities management ([0db22d7](https://github.com/hominiome/hominio/commit/0db22d719f12cf817e7ceb67bea88e8ac3cf0190))

# [0.8.0](https://github.com/hominiome/hominio/compare/v0.7.2...v0.8.0) (2025-11-20)


### Features

* introduced capabilities system ([ab027bb](https://github.com/hominiome/hominio/commit/ab027bb8ab5afb3f8604fbe816eae8ae89fca80d))

## [0.7.2](https://github.com/hominiome/hominio/compare/v0.7.1...v0.7.2) (2025-11-19)


### Bug Fixes

* resolve @hominio/auth import error in wallet service production build ([4197a4e](https://github.com/hominiome/hominio/commit/4197a4e1771ded524b5ecee8993b53f1523496f9))

## [0.7.1](https://github.com/hominiome/hominio/compare/v0.7.0...v0.7.1) (2025-11-19)


### Bug Fixes

* centralize auth verification and move sign-in to wallet service ([efea7a1](https://github.com/hominiome/hominio/commit/efea7a19d38df37fb19fa028a17d04172faeec69))

# [0.7.0](https://github.com/hominiome/hominio/compare/v0.6.3...v0.7.0) (2025-11-19)


### Features

* add tool call example with AI state indicators ([76ae863](https://github.com/hominiome/hominio/commit/76ae863edfd1fbafedde226c85932e9227e5a0a9))
* enable voice mode with Google Live API integration ([6116c82](https://github.com/hominiome/hominio/commit/6116c828833a8c79f0c25b398215cdaa0d6a2a24))

## [0.6.3](https://github.com/hominiome/hominio/compare/v0.6.2...v0.6.3) (2025-11-18)


### Bug Fixes

* normalize API domain to prevent double https:// protocol ([3326f7c](https://github.com/hominiome/hominio/commit/3326f7c1c8bdda6b55b5409d38c444b5c66b0a30))

## [0.6.2](https://github.com/hominiome/hominio/compare/v0.6.1...v0.6.2) (2025-11-18)


### Bug Fixes

* use production API domain instead of localhost in frontend ([7e2c38d](https://github.com/hominiome/hominio/commit/7e2c38deec037ad3bda3f4a970d34d5d2eca0b50))

## [0.6.1](https://github.com/hominiome/hominio/compare/v0.6.0...v0.6.1) (2025-11-18)


### Bug Fixes

* use WALLET_POSTGRES_SECRET and add --change-db flag for Zero sync ([0a48329](https://github.com/hominiome/hominio/commit/0a483294ce3d7bf4dc4a5e1ed21096ae1a18a08b))

# [0.6.0](https://github.com/hominiome/hominio/compare/v0.5.13...v0.6.0) (2025-11-18)


### Features

* add deployment workflows for sync and API services ([5e1a178](https://github.com/hominiome/hominio/commit/5e1a17867db4488a605ece8547ed02ee75041d8a))
* add Zero sync and API services with Better Auth integration ([f8f88d4](https://github.com/hominiome/hominio/commit/f8f88d4df445a015e5104543f04f7104b0476877))

## [0.5.13](https://github.com/hominiome/hominio/compare/v0.5.12...v0.5.13) (2025-11-18)


### Bug Fixes

* add @semantic-release/npm plugin to match working v0.1.4 config ([79cf5f1](https://github.com/hominiome/hominio/commit/79cf5f1d9c6175032b1ce81a72bcb5d9abfd0d55))
* add npm plugin to releaserc config to match v0.1.4 ([072a133](https://github.com/hominiome/hominio/commit/072a1339c4db45213153da9409052f6aa816d986))
* simplify GitHub plugin config to match working v0.1.4 setup ([3904f4c](https://github.com/hominiome/hominio/commit/3904f4c7ac1f10a20c10ba4b3aa38a4efd81b216))

## [0.5.12](https://github.com/hominiome/hominio/compare/v0.5.11...v0.5.12) (2025-11-17)


### Bug Fixes

* ensure GitHub releases are created and displayed ([4ca65ac](https://github.com/hominiome/hominio/commit/4ca65acbac971df73a60911a923aaf045531f01f))

## [0.5.11](https://github.com/hominiome/hominio/compare/v0.5.10...v0.5.11) (2025-11-17)


### Bug Fixes

* add Node.js 22 setup for semantic-release compatibility ([3388dc2](https://github.com/hominiome/hominio/commit/3388dc2555166fc8b42644f7378ad944a1f51464))
* use npx to run semantic-release with Node.js ([bc53f46](https://github.com/hominiome/hominio/commit/bc53f4698b94a5218bd25c0223f77c355893fb91))

## [0.5.10](https://github.com/hominiome/hominio/compare/v0.5.9...v0.5.10) (2025-11-17)


### Bug Fixes

* correct git plugin asset paths for semantic-release ([9800a47](https://github.com/hominiome/hominio/commit/9800a472b7969974e7596d3f03774fab1e085600))

## [0.1.23](https://github.com/hominiome/hominio-app/compare/v0.1.22...v0.1.23) (2025-11-17)


### Bug Fixes

* combine duplicate push triggers in release workflow ([b37539b](https://github.com/hominiome/hominio-app/commit/b37539b48b4cb0c1adfaeb51857f73b192a0d806))

## [0.1.22](https://github.com/hominiome/hominio-app/compare/v0.1.21...v0.1.22) (2025-11-16)


### Bug Fixes

* create server address file for Tauri xcode-script ([659012e](https://github.com/hominiome/hominio-app/commit/659012e65d1fdba18606e6d3571d83761815666f))

## [0.1.21](https://github.com/hominiome/hominio-app/compare/v0.1.20...v0.1.21) (2025-11-16)


### Bug Fixes

* remove Python dependency, use sed instead ([73f5571](https://github.com/hominiome/hominio-app/commit/73f55713af3d4fcb57578422ab17238508abf85d))

## [0.1.20](https://github.com/hominiome/hominio-app/compare/v0.1.19...v0.1.20) (2025-11-16)


### Bug Fixes

* use xcodebuild directly and fix pip install issue ([2cd1277](https://github.com/hominiome/hominio-app/commit/2cd127707d11f91ed794e7ed298b77df9b8c2ef6))

## [0.1.19](https://github.com/hominiome/hominio-app/compare/v0.1.18...v0.1.19) (2025-11-16)


### Bug Fixes

* add secret availability checks and better error handling ([d8c27ca](https://github.com/hominiome/hominio-app/commit/d8c27ca16a514b2b8d0ded25d2a50ce1a41df719))

## [0.1.18](https://github.com/hominiome/hominio-app/compare/v0.1.17...v0.1.18) (2025-11-16)


### Bug Fixes

* improve iOS code signing setup and verification ([4cc65d6](https://github.com/hominiome/hominio-app/commit/4cc65d6b48714fa6b8c162d0e3dd197c01658d4b))

## [0.1.17](https://github.com/hominiome/hominio-app/compare/v0.1.16...v0.1.17) (2025-11-16)


### Bug Fixes

* remove deprecated husky hook lines ([a04ef96](https://github.com/hominiome/hominio-app/commit/a04ef96e0cd5ace35ce450e0836859efb3d8eac9))

## [0.1.16](https://github.com/hominiome/hominio-app/compare/v0.1.15...v0.1.16) (2025-11-16)


### Bug Fixes

* install PyYAML before updating project.yml ([b56f4cc](https://github.com/hominiome/hominio-app/commit/b56f4cc100e537b6a811c7c8d111507b2b728bb1))

## [0.1.15](https://github.com/hominiome/hominio-app/compare/v0.1.14...v0.1.15) (2025-11-16)


### Bug Fixes

* resolve YAML syntax error in workflow file ([f591ccd](https://github.com/hominiome/hominio-app/commit/f591ccd257df4174889f8b28d994d23d593645a5))

## [0.1.14](https://github.com/hominiome/hominio-app/compare/v0.1.13...v0.1.14) (2025-11-16)


### Bug Fixes

* ensure CI environment variables are available to Xcode build scripts ([9434cb8](https://github.com/hominiome/hominio-app/commit/9434cb8de662aa809c2e24b8599c876048b63dd3))
* ensure semantic-release creates published GitHub releases ([38d8185](https://github.com/hominiome/hominio-app/commit/38d81851d8a19fc2532055472f8807dd4f96d783))
* pass CI environment variables to xcodebuild and prevent WebSocket connection ([9abe00d](https://github.com/hominiome/hominio-app/commit/9abe00d89e76841d3a3ab13e755cc5d070bad9ee))

## [0.1.13](https://github.com/hominiome/hominio-app/compare/v0.1.12...v0.1.13) (2025-11-16)


### Bug Fixes

* resolve EmptyHost error in iOS CI build ([6acf642](https://github.com/hominiome/hominio-app/commit/6acf642ac826ba3616afcc93a39d33c71227c3b7))

## [0.1.12](https://github.com/hominiome/hominio-app/compare/v0.1.11...v0.1.12) (2025-11-16)


### Bug Fixes

* **ci:** remove --frozen-lockfile flag and add bun.lock ([e898bdf](https://github.com/hominiome/hominio-app/commit/e898bdf5ffcab05e51f1df34f550712d31b05f15))
* **ci:** remove --frozen-lockfile flag for Bun install ([70e692a](https://github.com/hominiome/hominio-app/commit/70e692a7d0032f8ab234fa33a367591a982074f9))
* **ci:** update cache keys to use bun.lock instead of bun.lockb ([dbabb1b](https://github.com/hominiome/hominio-app/commit/dbabb1b82c13475d87051f1a6ced41882e06af2f))

## [0.1.11](https://github.com/hominiome/hominio-app/compare/v0.1.10...v0.1.11) (2025-11-16)


### Performance Improvements

* **ci:** optimize iOS workflow with caching and better organization ([b0ca97c](https://github.com/hominiome/hominio-app/commit/b0ca97c11291333622c578947eb3052662488bf9))
* **ci:** use swatinem/rust-cache for better Rust build caching ([8720ebf](https://github.com/hominiome/hominio-app/commit/8720ebf51e06955b6d21a8fe1c327d55de04ae8b))

## [0.1.10](https://github.com/hominiome/hominio-app/compare/v0.1.9...v0.1.10) (2025-11-16)


### Performance Improvements

* **ci:** improve Rust library cache check with debug output ([b299071](https://github.com/hominiome/hominio-app/commit/b2990712667774a19e14b56b279701b010e961b6))
* **ci:** improve Rust library cache check with debug output ([5eca6e4](https://github.com/hominiome/hominio-app/commit/5eca6e4c2175e6fb725a29c152792dd9c915fb16))

## [0.1.9](https://github.com/hominiome/hominio-app/compare/v0.1.8...v0.1.9) (2025-11-16)


### Bug Fixes

* **ci:** create server address file in archive step right before Xcode runs ([39ae5cd](https://github.com/hominiome/hominio-app/commit/39ae5cd16bb4c0875fb4827010797168faf19e11))

## [0.1.8](https://github.com/hominiome/hominio-app/compare/v0.1.7...v0.1.8) (2025-11-16)


### Performance Improvements

* **ci:** optimize iOS build to skip Rust compilation when library exists in cache ([86d38a7](https://github.com/hominiome/hominio-app/commit/86d38a7767453c55a8be5fbecc6a3167635766fa))

## [0.1.7](https://github.com/hominiome/hominio-app/compare/v0.1.6...v0.1.7) (2025-11-16)


### Bug Fixes

* **ci:** pre-build Rust library and create dummy server address file for Tauri iOS build ([ce115c3](https://github.com/hominiome/hominio-app/commit/ce115c3a5bbd970f31b54274553f3c58bb95aa54))

## [0.1.6](https://github.com/hominiome/hominio-app/compare/v0.1.5...v0.1.6) (2025-11-16)


### Bug Fixes

* **ci:** accept lowercase UUIDs in provisioning profile validation ([f8342b0](https://github.com/hominiome/hominio-app/commit/f8342b006d17671550485f9b098ba3c2548f97c0))

## [0.1.5](https://github.com/hominiome/hominio-app/compare/v0.1.4...v0.1.5) (2025-11-16)


### Bug Fixes

* **ci:** improve UUID extraction from provisioning profiles with multiple fallback methods ([f213f55](https://github.com/hominiome/hominio-app/commit/f213f55f8929c340b59381954ea95d19c13d0416))
* **ci:** improve UUID extraction from provisioning profiles with multiple fallback methods ([f0f6a28](https://github.com/hominiome/hominio-app/commit/f0f6a28671aea26e97cfa6c7be4dc5ac7753ed4d))

## [0.1.4](https://github.com/hominiome/hominio-app/compare/v0.1.3...v0.1.4) (2025-11-16)


### Bug Fixes

* **ci:** improve provisioning profile UUID extraction in iOS workflow ([fd4b15d](https://github.com/hominiome/hominio-app/commit/fd4b15df1b913eba20419fc0b5c9be1cb5036153))

## [0.1.3](https://github.com/hominiome/hominio-app/compare/v0.1.2...v0.1.3) (2025-11-16)


### Bug Fixes

* **ci:** improve error logging for iOS build failures ([4a27071](https://github.com/hominiome/hominio-app/commit/4a270715d9c519cfd9530d99da54c486367b1b2b))

## [0.1.2](https://github.com/hominiome/hominio-app/compare/v0.1.1...v0.1.2) (2025-11-16)


### Bug Fixes

* **ci:** fix workflow syntax error with secrets check ([0d98675](https://github.com/hominiome/hominio-app/commit/0d98675d4b5ac85ee085e0ef1512449945c85f3a))
* **ci:** fix workflow syntax error with secrets check ([b6956ee](https://github.com/hominiome/hominio-app/commit/b6956eeca516171b5795963c89c1235c92810cd3))

## [0.1.12](https://github.com/hominiome/hominio-app/compare/v0.1.11...v0.1.12) (2025-11-16)


### Bug Fixes

* **ci:** implement proper iOS code signing architecture ([6199bc9](https://github.com/hominiome/hominio-app/commit/6199bc93c2af25a1ee8e9e424cbf3184b9d61356))
* **ci:** implement proper iOS code signing architecture with certificate import ([f7749a4](https://github.com/hominiome/hominio-app/commit/f7749a4b1fecd4b78e4048324392209f97eae659))

## [0.1.11](https://github.com/hominiome/hominio-app/compare/v0.1.10...v0.1.11) (2025-11-16)


### Bug Fixes

* **ci:** use Tauri build command to handle iOS signing ([5c492d4](https://github.com/hominiome/hominio-app/commit/5c492d46cc63e8934153442256d4caebbc72a627))

## [0.1.10](https://github.com/hominiome/hominio-app/compare/v0.1.9...v0.1.10) (2025-11-16)


### Bug Fixes

* **ci:** try building without code signing, sign during export ([9788f6d](https://github.com/hominiome/hominio-app/commit/9788f6dae949f6b0326253a44fa0f913af7b54dc))

## [0.1.9](https://github.com/hominiome/hominio-app/compare/v0.1.8...v0.1.9) (2025-11-16)


### Bug Fixes

* **ci:** allow manual workflow dispatch and fix checkout ref ([ece9b5a](https://github.com/hominiome/hominio-app/commit/ece9b5af88d44ffde895d45e4518dee0b865cd55))
* **ci:** allow manual workflow dispatch and fix checkout ref ([bb9fb41](https://github.com/hominiome/hominio-app/commit/bb9fb411a21a3150dfddadb2e38090e35b1cf50d))

## [0.1.8](https://github.com/hominiome/hominio-app/compare/v0.1.7...v0.1.8) (2025-11-16)


### Performance Improvements

* **ci:** remove redundant Rust build step - Xcode pre-build script handles it ([6df67d3](https://github.com/hominiome/hominio-app/commit/6df67d35890943b06c05680b946f3843aca6e4f9))

## [0.1.7](https://github.com/hominiome/hominio-app/compare/v0.1.6...v0.1.7) (2025-11-16)


### Bug Fixes

* **ci:** use Xcode 16.1 stable version for iOS builds ([1d6a225](https://github.com/hominiome/hominio-app/commit/1d6a225b6cbeb0a0e6cd02a2bc3c45daebbc2387))
* **ci:** use Xcode 16.1 stable version for iOS builds ([84d6f95](https://github.com/hominiome/hominio-app/commit/84d6f95074b1a66366434cef010f4eb3a2ce6cfc))

## [0.1.6](https://github.com/hominiome/hominio-app/compare/v0.1.5...v0.1.6) (2025-11-16)


### Bug Fixes

* **ci:** build Rust library before iOS app build ([ea4c438](https://github.com/hominiome/hominio-app/commit/ea4c4382d7b73eaa2bab15d46b9b27984b6f82b0))
* **ci:** detect available iOS SDK and use archive/export flow ([dd402b8](https://github.com/hominiome/hominio-app/commit/dd402b8f5e4278967c49db0f719f56db85ebe47b))
* **ci:** use stable Xcode version and fix iOS build destination ([567b436](https://github.com/hominiome/hominio-app/commit/567b4360413982d5ebc3bb9255058bab0df94146))

## [0.1.5](https://github.com/hominiome/hominio-app/compare/v0.1.4...v0.1.5) (2025-11-16)


### Bug Fixes

* **ci:** add destination flag for iOS xcodebuild in CI ([bc621a9](https://github.com/hominiome/hominio-app/commit/bc621a97c8b2e3a1fafa62b60687df1d7f68bf02))

## [0.1.4](https://github.com/hominiome/hominio-app/compare/v0.1.3...v0.1.4) (2025-11-16)


### Bug Fixes

* **ci:** trigger iOS workflow after Release workflow completes successfully ([e34cbf7](https://github.com/hominiome/hominio-app/commit/e34cbf7c91395ae3e622ec995e06c01a4fff7cce))

## [0.1.3](https://github.com/hominiome/hominio-app/compare/v0.1.2...v0.1.3) (2025-11-16)


### Bug Fixes

* **ci:** trigger iOS workflow on tag push instead of release event ([cef6b85](https://github.com/hominiome/hominio-app/commit/cef6b85868a07517e368099f8fd18b2076948af4))

## [0.1.2](https://github.com/hominiome/hominio-app/compare/v0.1.1...v0.1.2) (2025-11-16)


### Bug Fixes

* **ci:** add permissions to iOS workflow and set baseline version tag ([67e6fb3](https://github.com/hominiome/hominio-app/commit/67e6fb3708e95452e28e264e03736781cdb43363))

# 1.0.0 (2025-11-16)


### Bug Fixes

* **ci:** add GitHub Actions workflows for automated releases and TestFlight uploads ([b88b5ea](https://github.com/hominiome/hominio-app/commit/b88b5ea135132c851d464efd22e44ee85ae85747))
* **ci:** add write permissions to GitHub Actions workflow for semantic-release ([d3f0655](https://github.com/hominiome/hominio-app/commit/d3f065534be04db223efd3d59d38ce05533cbdc5))
