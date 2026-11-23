#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // Native HTTP for the Piped/Invidious APIs (no browser CORS limits)
        .plugin(tauri_plugin_http::init())
        // Opens external links in the system browser
        .plugin(tauri_plugin_opener::init())
        // Restart after an update
        .plugin(tauri_plugin_process::init());

    // Signed in-app updates from GitHub Releases
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .run(tauri::generate_context!())
        .expect("Strova konnte nicht gestartet werden");
}
