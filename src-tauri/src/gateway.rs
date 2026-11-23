use crate::discord::PresenceUpdate;
use crate::state::AppState;
use serde::Deserialize;
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const GATEWAY_PORT: u16 = 3000;
const DEFAULT_IP: &str = "127.0.0.1";
const PARENT_BOUND_ENV: &str = "STRIPCOL_PARENT_BOUND";
const BRIDGE_PREFIX: &str = "@@RPC ";
const PORT_CHECK_TIMEOUT: Duration = Duration::from_secs(1);
const WATCHDOG_INTERVAL: Duration = Duration::from_secs(10);

pub struct Gateway {
    child: Mutex<Option<CommandChild>>,
    is_host: AtomicBool,
    current_ip: Mutex<String>,
}

impl Gateway {
    pub fn new(initial_ip: String) -> Self {
        Self {
            child: Mutex::new(None),
            is_host: AtomicBool::new(false),
            current_ip: Mutex::new(initial_ip),
        }
    }

    pub fn stop(&self) {
        if let Some(child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
        }
        self.is_host.store(false, Ordering::SeqCst);
    }

    fn is_hosting(&self) -> bool {
        self.is_host.load(Ordering::SeqCst) && self.child.lock().unwrap().is_some()
    }
}

#[derive(Deserialize)]
struct BridgeMessage {
    #[serde(rename = "type")]
    kind: String,
    data: Option<PresenceUpdate>,
}

fn is_port_open(host: &str) -> bool {
    let Ok(addresses) = (host, GATEWAY_PORT).to_socket_addrs() else {
        return false;
    };
    addresses
        .into_iter()
        .any(|address| TcpStream::connect_timeout(&address, PORT_CHECK_TIMEOUT).is_ok())
}

pub fn start(app: &AppHandle, requested_ip: &str) {
    let ip = if requested_ip.trim().is_empty() {
        DEFAULT_IP.to_string()
    } else {
        requested_ip.trim().to_string()
    };

    let state = app.state::<AppState>();
    let gateway = &state.gateway;

    if gateway.is_hosting() && *gateway.current_ip.lock().unwrap() == ip {
        return;
    }
    *gateway.current_ip.lock().unwrap() = ip.clone();

    gateway.stop();

    if is_port_open(&ip) {
        println!("Gateway detected on {ip}:{GATEWAY_PORT}. Joining as backup.");
        return;
    }

    println!("No gateway detected on {ip}:{GATEWAY_PORT}. Starting local gateway...");
    spawn_sidecar(app, &ip);
}

fn spawn_sidecar(app: &AppHandle, ip: &str) {
    let command = match app.shell().sidecar("gateway") {
        Ok(command) => command.args([ip]).env(PARENT_BOUND_ENV, "1"),
        Err(error) => {
            eprintln!("Gateway sidecar not available: {error}");
            return;
        }
    };

    let (mut events, child) = match command.spawn() {
        Ok(spawned) => spawned,
        Err(error) => {
            eprintln!("Failed to start gateway: {error}");
            return;
        }
    };

    let state = app.state::<AppState>();
    *state.gateway.child.lock().unwrap() = Some(child);
    state.gateway.is_host.store(true, Ordering::SeqCst);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    handle_stdout(&app_handle, &String::from_utf8_lossy(&line))
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[gateway] {}", String::from_utf8_lossy(&line).trim_end())
                }
                CommandEvent::Terminated(payload) => {
                    println!(
                        "Gateway exited (code={:?}, signal={:?})",
                        payload.code, payload.signal
                    );
                    let state = app_handle.state::<AppState>();
                    state.gateway.is_host.store(false, Ordering::SeqCst);
                    state.gateway.child.lock().unwrap().take();
                    break;
                }
                _ => {}
            }
        }
    });
}

fn handle_stdout(app: &AppHandle, line: &str) {
    let trimmed = line.trim_end();
    let Some(payload) = trimmed.strip_prefix(BRIDGE_PREFIX) else {
        println!("[gateway] {trimmed}");
        return;
    };

    let Ok(message) = serde_json::from_str::<BridgeMessage>(payload) else {
        return;
    };

    let state = app.state::<AppState>();
    if !state.settings.lock().unwrap().discord_rpc_enabled {
        return;
    }

    let mut presence = state.discord.lock().unwrap();
    match message.kind.as_str() {
        "rpc_update" => presence.update(message.data.unwrap_or_default()),
        "rpc_clear" => presence.update(PresenceUpdate::default()),
        _ => {}
    }
}

pub fn spawn_watchdog(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(WATCHDOG_INTERVAL);

        let state = app.state::<AppState>();
        if state.gateway.is_hosting() {
            continue;
        }

        let ip = state.gateway.current_ip.lock().unwrap().clone();
        if !is_port_open(&ip) {
            println!("Active gateway lost. Attempting failover...");
            start(&app, &ip);
        }
    });
}
