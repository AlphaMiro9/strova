#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Native HTTP for the Piped/Invidious APIs (no browser CORS limits)
        .plugin(tauri_plugin_http::init())
        // Opens external links in the system browser
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("Strova konnte nicht gestartet werden");
}
