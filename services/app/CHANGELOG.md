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
