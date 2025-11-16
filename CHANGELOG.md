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
