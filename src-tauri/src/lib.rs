mod commands;

use commands::compress;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            compress::compress_image,
            compress::compress_batch,
            compress::check_vips_installed,
            compress::get_file_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
