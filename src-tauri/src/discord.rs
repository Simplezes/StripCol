use discord_rich_presence::activity::{Activity, Assets, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use serde::Deserialize;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const CLIENT_ID: &str = "1471575709893005445";
const THROTTLE_INTERVAL: Duration = Duration::from_secs(15);
const DEFAULT_DETAILS: &str = "Awaiting Connection";
const DEFAULT_STATE: &str = "Ready for traffic";

#[derive(Clone, Debug, Default, Deserialize)]
pub struct PresenceUpdate {
    pub details: Option<String>,
    pub state: Option<String>,
    pub callsign: Option<String>,
}

#[derive(Default)]
pub struct DiscordPresence {
    client: Option<DiscordIpcClient>,
    started_at: Option<i64>,
    last_sent: Option<(String, String)>,
    last_sent_at: Option<Instant>,
}

impl DiscordPresence {
    pub fn connect(&mut self) {
        if self.client.is_some() {
            return;
        }

        let mut client = DiscordIpcClient::new(CLIENT_ID);
        match client.connect() {
            Ok(()) => {
                self.client = Some(client);
                self.update(PresenceUpdate::default());
            }
            Err(error) => eprintln!("[RPC] Failed to connect to Discord: {error}"),
        }
    }

    pub fn update(&mut self, update: PresenceUpdate) {
        if self.client.is_none() {
            self.connect();
        }
        if self.client.is_none() {
            return;
        }

        let details = update.details.unwrap_or_else(|| DEFAULT_DETAILS.to_string());
        let state = update.state.unwrap_or_else(|| DEFAULT_STATE.to_string());

        if self.is_duplicate_within_throttle(&details, &state) {
            return;
        }
        self.last_sent = Some((details.clone(), state.clone()));
        self.last_sent_at = Some(Instant::now());

        self.track_session_start(update.callsign.is_some());
        self.send_activity(&details, &state);
    }

    pub fn clear(&mut self) {
        if let Some(mut client) = self.client.take() {
            let _ = client.clear_activity();
            let _ = client.close();
        }
        self.started_at = None;
        self.last_sent = None;
        self.last_sent_at = None;
    }

    fn is_duplicate_within_throttle(&self, details: &str, state: &str) -> bool {
        let same_content = self
            .last_sent
            .as_ref()
            .is_some_and(|(last_details, last_state)| last_details == details && last_state == state);
        let recent = self
            .last_sent_at
            .is_some_and(|sent_at| sent_at.elapsed() < THROTTLE_INTERVAL);
        same_content && recent
    }

    fn track_session_start(&mut self, has_callsign: bool) {
        if !has_callsign {
            self.started_at = None;
        } else if self.started_at.is_none() {
            self.started_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .ok()
                .map(|elapsed| elapsed.as_secs() as i64);
        }
    }

    fn send_activity(&mut self, details: &str, state: &str) {
        let Some(client) = self.client.as_mut() else {
            return;
        };

        let mut activity = Activity::new()
            .details(details)
            .state(state)
            .assets(Assets::new().large_image("icon").large_text("StripCol"));
        if let Some(started_at) = self.started_at {
            activity = activity.timestamps(Timestamps::new().start(started_at));
        }

        if let Err(error) = client.set_activity(activity) {
            eprintln!("[RPC] Failed to set activity: {error}");
            self.client = None;
        }
    }
}
