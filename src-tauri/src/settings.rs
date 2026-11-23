use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const SETTINGS_FILE_NAME: &str = "settings.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub server_ip: String,
    pub discord_rpc_enabled: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            server_ip: "127.0.0.1".to_string(),
            discord_rpc_enabled: true,
        }
    }
}

fn settings_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|directory| directory.join(SETTINGS_FILE_NAME))
}

pub fn load(app: &AppHandle) -> Settings {
    settings_path(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|contents| serde_json::from_str(&contents).ok())
        .unwrap_or_default()
}

pub fn save(app: &AppHandle, settings: &Settings) {
    let Some(path) = settings_path(app) else {
        return;
    };

    if let Some(directory) = path.parent() {
        if let Err(error) = fs::create_dir_all(directory) {
            eprintln!("Failed to create settings directory: {error}");
            return;
        }
    }

    match serde_json::to_string_pretty(settings) {
        Ok(contents) => {
            if let Err(error) = fs::write(&path, contents) {
                eprintln!("Failed to save settings: {error}");
            }
        }
        Err(error) => eprintln!("Failed to serialize settings: {error}"),
    }
}
