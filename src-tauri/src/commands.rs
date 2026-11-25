use crate::gateway;
use crate::screen_color;
use crate::settings::{self, Settings};
use crate::state::AppState;
use std::fs;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

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

const LOUPE_WIDTH: f64 = 150.0;
const LOUPE_HEIGHT: f64 = 180.0;
const LOUPE_OFFSET: i32 = 6;

fn open_loupe(app: &AppHandle) -> Result<WebviewWindow, String> {
    let loupe = WebviewWindowBuilder::new(app, "loupe", WebviewUrl::App("loupe.html".into()))
        .inner_size(LOUPE_WIDTH, LOUPE_HEIGHT)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;
    loupe.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
    Ok(loupe)
}

struct LoupeBounds {
    width: i32,
    height: i32,
    right: i32,
    bottom: i32,
}

fn loupe_bounds(loupe: &WebviewWindow) -> LoupeBounds {
    let size = loupe.outer_size().map(|s| (s.width as i32, s.height as i32)).unwrap_or((150, 180));
    let (right, bottom) = match loupe.current_monitor() {
        Ok(Some(monitor)) => (
            monitor.position().x + monitor.size().width as i32,
            monitor.position().y + monitor.size().height as i32,
        ),
        _ => (i32::MAX, i32::MAX),
    };
    LoupeBounds { width: size.0, height: size.1, right, bottom }
}

fn move_loupe(loupe: &WebviewWindow, bounds: &LoupeBounds, cursor_x: i32, cursor_y: i32) {
    let x = if cursor_x + LOUPE_OFFSET + bounds.width > bounds.right {
        cursor_x - LOUPE_OFFSET - bounds.width
    } else {
        cursor_x + LOUPE_OFFSET
    };
    let y = if cursor_y + LOUPE_OFFSET + bounds.height > bounds.bottom {
        cursor_y - LOUPE_OFFSET - bounds.height
    } else {
        cursor_y + LOUPE_OFFSET
    };
    let _ = loupe.set_position(PhysicalPosition::new(x, y));
}

#[tauri::command]
pub async fn pick_screen_color(app: AppHandle) -> Result<Option<String>, String> {
    let loupe = open_loupe(&app)?;
    let mover = loupe.clone();
    let painter = loupe.clone();
    let bounds = loupe_bounds(&loupe);
    let _ = loupe.show();
    let result = tauri::async_runtime::spawn_blocking(move || {
        screen_color::pick(
            |x, y| move_loupe(&mover, &bounds, x, y),
            |pixels| {
                let center = pixels.len() / 2 / 6 * 6;
                let _ = app.emit("screen-color-hover", format!("#{}", &pixels[center..center + 6]));
                let _ = painter.eval(format!("window.render && window.render('{pixels}')"));
            },
        )
    })
    .await
    .map_err(|e| e.to_string());
    let _ = loupe.close();
    result?
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

#[tauri::command]
pub fn open_devtools(window: WebviewWindow) {
    window.open_devtools();
}

const PLUGIN_FILES: [&str; 2] = ["StripCol.dll", "data/procedures.json"];
const WINDOWS_SHARING_VIOLATION: i32 = 32;

#[tauri::command]
pub async fn install_plugin(app: AppHandle) -> Result<Option<String>, String> {
    let Some(picked) = app
        .dialog()
        .file()
        .set_title("Choose the folder to install the StripCol plugin")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    let target = picked.into_path().map_err(|e| e.to_string())?;

    for file in PLUGIN_FILES {
        let source = app
            .path()
            .resolve(format!("plugin/{file}"), BaseDirectory::Resource)
            .map_err(|e| e.to_string())?;
        let destination = target.join(file);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::copy(&source, &destination).map_err(|e| {
            if e.raw_os_error() == Some(WINDOWS_SHARING_VIOLATION) {
                format!("{file} is in use. Unload the plugin in EuroScope and try again.")
            } else {
                format!("Could not copy {file}: {e}")
            }
        })?;
    }

    Ok(Some(target.join(PLUGIN_FILES[0]).display().to_string()))
}
