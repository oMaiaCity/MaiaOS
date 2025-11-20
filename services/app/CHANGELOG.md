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
