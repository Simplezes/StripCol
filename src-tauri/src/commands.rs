use crate::gateway;
use crate::settings::{self, Settings};
use crate::state::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn save_settings(app: AppHandle, state: State<AppState>, settings: Settings) {
    let rpc_changed = {
        let mut stored = state.settings.lock().unwrap();
        let rpc_changed = stored.discord_rpc_enabled != settings.discord_rpc_enabled;
        *stored = settings.clone();
        rpc_changed
    };

    settings::save(&app, &settings);

    if rpc_changed {
        let mut presence = state.discord.lock().unwrap();
        if settings.discord_rpc_enabled {
            presence.connect();
        } else {
            presence.clear();
        }
    }
}

#[tauri::command]
pub fn restart_gateway(app: AppHandle, state: State<AppState>, server_ip: String) {
    {
        let mut stored = state.settings.lock().unwrap();
        stored.server_ip = server_ip.clone();
        settings::save(&app, &stored);
    }
    gateway::start(&app, &server_ip);
}
