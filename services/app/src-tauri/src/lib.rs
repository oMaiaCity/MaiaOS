#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	let mut builder = tauri::Builder::default();

	#[cfg(target_os = "macos")]
	{
		builder = builder.plugin(maia_tauri_plugin_passkey::init());
	}

	builder
		.setup(|app| {
			#[cfg(debug_assertions)]
			{
				use tauri::Manager;
				if let Some(win) = app.get_webview_window("main") {
					win.open_devtools();
				}
			}
			if cfg!(debug_assertions) {
				app.handle().plugin(
					tauri_plugin_log::Builder::default()
						.level(log::LevelFilter::Info)
						.build(),
				)?;
			}
			Ok(())
		})
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
