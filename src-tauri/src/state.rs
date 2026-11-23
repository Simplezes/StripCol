use crate::discord::DiscordPresence;
use crate::gateway::Gateway;
use crate::settings::Settings;
use std::sync::Mutex;

pub struct AppState {
    pub settings: Mutex<Settings>,
    pub gateway: Gateway,
    pub discord: Mutex<DiscordPresence>,
}

impl AppState {
    pub fn new(settings: Settings) -> Self {
        let gateway = Gateway::new(settings.server_ip.clone());
        Self {
            settings: Mutex::new(settings),
            gateway,
            discord: Mutex::new(DiscordPresence::default()),
        }
    }
}
