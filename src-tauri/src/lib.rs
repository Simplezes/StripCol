mod commands;
mod discord;
mod gateway;
mod screen_color;
mod settings;
mod state;

use state::AppState;
use tauri::{Manager, RunEvent};

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::save_settings,
            commands::restart_gateway,
            commands::pick_screen_color,
            commands::open_devtools,
            commands::install_plugin
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let stored_settings = settings::load(&handle);
            let server_ip = stored_settings.server_ip.clone();
            let rpc_enabled = stored_settings.discord_rpc_enabled;

            app.manage(AppState::new(stored_settings));

            gateway::start(&handle, &server_ip);
            gateway::spawn_watchdog(handle.clone());

            if rpc_enabled {
                app.state::<AppState>().discord.lock().unwrap().connect();
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build StripCol");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            let state = handle.state::<AppState>();
            state.gateway.stop();
            state.discord.lock().unwrap().clear();
        }
    });
}
