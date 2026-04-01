fn main() {
	if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
		macos_swift_runtime_rpath();
	}
	tauri_build::build()
}

/// Swift 6 host apps need `@rpath` to match `swift -print-target-info` `paths.runtimeLibraryPaths`.
/// Do not rely on `swift-5.5/macosx` - that runtime breaks Swift 6 concurrency symbols.
fn macos_swift_runtime_rpath() {
	use std::process::Command;

	let Ok(target) = std::env::var("TARGET") else {
		println!("cargo:warning=app build.rs: TARGET unset; skipping Swift runtime rpath");
		return;
	};
	let swift_triple = rust_macos_target_to_swift_triple(&target);
	let out = Command::new("swift")
		.args(["-target", &swift_triple, "-print-target-info"])
		.output();
	let Ok(out) = out else {
		println!("cargo:warning=app build.rs: failed to run `swift -print-target-info`");
		emit_xcode_swift_rpath_fallback();
		return;
	};
	if !out.status.success() {
		println!(
			"cargo:warning=app build.rs: swift -print-target-info failed (status {:?})",
			out.status.code()
		);
		emit_xcode_swift_rpath_fallback();
		return;
	}
	let Ok(v) = serde_json::from_slice::<serde_json::Value>(&out.stdout) else {
		println!("cargo:warning=app build.rs: could not parse swift -print-target-info JSON");
		emit_xcode_swift_rpath_fallback();
		return;
	};
	let Some(paths) = v["paths"]["runtimeLibraryPaths"].as_array() else {
		println!("cargo:warning=app build.rs: missing paths.runtimeLibraryPaths in target-info");
		emit_xcode_swift_rpath_fallback();
		return;
	};
	let mut any = false;
	for p in paths {
		let Some(s) = p.as_str() else {
			continue;
		};
		println!("cargo:rustc-link-arg=-Wl,-rpath,{}", s);
		any = true;
	}
	if !any {
		println!("cargo:warning=app build.rs: runtimeLibraryPaths empty; using fallback rpaths");
		emit_xcode_swift_rpath_fallback();
	}
}

fn emit_xcode_swift_rpath_fallback() {
	use std::process::Command;

	println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
	let Ok(dev) = Command::new("xcode-select").arg("-p").output() else {
		println!("cargo:warning=app build.rs: xcode-select -p failed");
		return;
	};
	if !dev.status.success() {
		println!("cargo:warning=app build.rs: xcode-select -p nonzero exit");
		return;
	}
	let Ok(root) = String::from_utf8(dev.stdout) else {
		return;
	};
	let root = root.trim();
	let swift_macosx = format!(
		"{root}/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/macosx"
	);
	println!("cargo:rustc-link-arg=-Wl,-rpath,{swift_macosx}");
}

fn rust_macos_target_to_swift_triple(rust_target: &str) -> String {
	let arch = if rust_target.starts_with("aarch64") {
		"arm64"
	} else if rust_target.starts_with("x86_64") {
		"x86_64"
	} else {
		"aarch64"
	};
	// Must match SwiftLinker minimum in maia-tauri-plugin-passkey (`15.0`)
	format!("{arch}-apple-macosx15.0")
}
