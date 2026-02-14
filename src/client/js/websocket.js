window.isConnected = false;
window.isPluginLinked = false;
let connectionInterval = null;
let sseReconnectTimeout = null;
let sseRetryDelay = 2000;
const MAX_SSE_RETRY_DELAY = 30000;
let lastFetchTime = 0;
let aircraftMap = {};
let jsonData = {};
let jsonDataSector = {};
let lastResponseTime = Date.now();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let currentSessionCode = null;
let evtSource = null;

window.controllerMode = "aerodrome";
window.positionId = "";

function getLinkCode() {
    const saved = localStorage.getItem('stripcol_settings');
    if (saved) {
        try {
            return JSON.parse(saved).linkCode;
        } catch (e) { return null; }
    }
    return null;
}

function startConnectionMonitoring() {
    stopConnectionMonitoring();
    startEvent();

    connectionInterval = setInterval(() => {
        if (!window.isConnected) startEvent();
    }, 10000);
}

function stopConnectionMonitoring() {
    if (connectionInterval) {
        clearInterval(connectionInterval);
        connectionInterval = null;
    }
}

function closeConnection() {
    stopConnectionMonitoring();
    closeEventSource();
    isConnected = false;
    updateWsStatus(false);
}

function updateWsStatus(connected) {
    const wsStatusEl = document.getElementById('wsStatus');
    const codeDisplay = document.getElementById('currentLinkCodeDisplay');

    if (codeDisplay) codeDisplay.textContent = getLinkCode() || '-----';

    if (wsStatusEl) {
        if (connected) {
            wsStatusEl.textContent = "SYSTEM: ONLINE";
            wsStatusEl.classList.add('success');
            wsStatusEl.classList.remove('warning');
        } else {
            wsStatusEl.textContent = "SYSTEM: OFFLINE";
            wsStatusEl.classList.remove('success');
            wsStatusEl.classList.add('warning');
        }
    }
}

window.reconnectSSE = function () {
    closeEventSource();
    startEvent();
};

function startEvent() {
    closeEventSource();
    if (sseReconnectTimeout) clearTimeout(sseReconnectTimeout);

    fetch(`${GATEWAY_URL}/api`)
        .then(response => {
            if (response.ok) updateWsStatus(true);
        })
        .catch(() => {
        });

    const code = getLinkCode();
    if (!code) {
        return;
    }

    if (code !== currentSessionCode) {
        resetSession();
        currentSessionCode = code;
    }

    evtSource = new EventSource(`${GATEWAY_URL}/api/events?code=${code}`);

    evtSource.addEventListener('gateway_status', e => {
        const payload = JSON.parse(e.data);
        if (payload.status === 'plugin_connected') {
            window.isPluginLinked = true;
            if (payload.controller) setControllerInfo(payload.controller);
        } else {
            window.isPluginLinked = false;
        }
        //updateWsStatus(true);
    });

    evtSource.addEventListener('aircraft', e => {
        const flightplan = JSON.parse(e.data);
        flightplan.transfer = false;
        if (aircraftMap[flightplan.callsign]) {
            deleteStripFromPanels(flightplan.callsign);
        } else {
            if (window.playNotification) window.playNotification();
        }
        aircraftMap[flightplan.callsign] = flightplan;
        renderAircraft(flightplan);
    });

    evtSource.addEventListener('release', e => {
        const { callsign } = JSON.parse(e.data);
        delete aircraftMap[callsign];
        deleteStripFromPanels(callsign);
    });

    evtSource.addEventListener('transfer', e => {
        const flightplan = JSON.parse(e.data);
        flightplan.transfer = true;
        aircraftMap[flightplan.callsign] = flightplan;
        renderAircraft(flightplan);
    });

    evtSource.addEventListener('fpupdate', e => {
        const flightplan = JSON.parse(e.data);
        UpdateStrip(flightplan);
    });

    evtSource.addEventListener('nearby-aircraft', e => {
        const callsigns = JSON.parse(e.data);
        if (window.onNearbyAircraftReceived) {
            window.onNearbyAircraftReceived(callsigns);
        }
    });

    evtSource.onopen = function () {
        console.log("Gateway Link: Established");
        window.isConnected = true;
        updateWsStatus(true);
        sseRetryDelay = 2000; // Reset backoff on success

        // Fetch list if we haven't in some time
        const now = Date.now();
        if (now - lastFetchTime > 10000) {
            lastFetchTime = now;
            fetchAndRenderAircraftList();
        }
    };

    evtSource.onerror = function (error) {
        console.warn(`Gateway Link Error. Retrying in ${sseRetryDelay / 1000}s...`);
        window.isConnected = false;
        window.isPluginLinked = false;
        updateWsStatus(false);
        closeEventSource();

        sseReconnectTimeout = setTimeout(() => {
            sseRetryDelay = Math.min(sseRetryDelay * 1.5, MAX_SSE_RETRY_DELAY);
            startEvent();
        }, sseRetryDelay);
    };
}

function closeEventSource() {
    if (evtSource) {
        evtSource.close();
        evtSource = null;
    }
}

function resetSession() {
    console.log("Resetting session state for new Link Code");

    aircraftMap = {};

    document.querySelectorAll('.strip-container').forEach(container => {
        container.innerHTML = "";
    });

    // Clear all Euroscope strips from state manager
    stateManager.clearEuroscopeStrips();

    updateWsStatus(false);
}

function fetchAndRenderAircraftList() {
    const code = getLinkCode();
    fetch(`${GATEWAY_URL}/api/assumed?code=${code}`)
        .then(response => response.json())
        .then(aircrafts => {
            aircrafts.forEach(ac => {
                aircraftMap[ac.callsign] = ac;
            });

            for (const callsign in aircraftMap) {
                renderAircraft(aircraftMap[callsign]);
            }
        })
        .catch(error => {
            console.error('Error fetching aircraft list:', error);
        });
}

function renderAircraft(flight) {
    function CheckType(positionId, airportCode) {
        if (!jsonDataSector[positionId]) return false;
        return jsonDataSector[positionId].airports.includes(airportCode);
    }

    if (!flight || !flight.callsign) return;

    const dep = (flight.departure || "").toUpperCase();
    const arr = (flight.arrival || "").toUpperCase();
    const local = (window.localIcao || "").toUpperCase();

    let type =
        window.controllerMode === "aerodrome"
            ? dep === local
                ? "departure"
                : arr === local
                    ? "arrival"
                    : "overfly"
            : CheckType(window.positionId, dep)
                ? "departure"
                : CheckType(window.positionId, arr)
                    ? "arrival"
                    : "overfly";

    if (flight.transfer) type = "transfer";

    const stripId = `strip-${flight.callsign}`;

    // Check if strip already exists in state
    const existingStrip = stateManager.getStrip(stripId);
    if (existingStrip) return;

    let panel = document.querySelector(`[data-panel-name="${capitalize(type)}"]`);
    if (!panel) {
        panel = document.querySelector("[data-panel-name]");
        if (!panel) return;
    }

    const stripContainer = panel.querySelector(".strip-container");
    if (!stripContainer) return;

    const strip = createStrip(type, flight, true, stripId);
    strip.dataset.callsign = flight.callsign;
    if (!flight.callsign) strip.dataset.euroscope = "false";
    stripContainer.appendChild(strip);

    const panelNameInput = panel.querySelector("input");
    const panelName = panelNameInput ? panelNameInput.value.trim() : panel.dataset.panelName;

    if (panelName) addStripToPanel(panelName, strip, flight);
}

function setControllerInfo(data, returnPositionName = false) {
    const facilityMap = {
        1: ["aerodrome", "Flight Service Station"], // Flight Service Station
        2: ["aerodrome", "Clearance Delivery"],     // Clearance Delivery
        3: ["aerodrome", "Ground"],                 // Ground
        4: ["aerodrome", "Tower"],                  // Tower
        5: ["approach", "Approach / Departure"],    // Approach / Departure
        6: ["center", "Area Control Center"]        // Area Control Center
    };

    if (returnPositionName) {
        const facilityInfo = facilityMap[data.facility] || facilityMap[parseInt(data.facility)];
        return (facilityInfo && facilityInfo[1]) || "";
    }

    const match = (data.callsign || "").match(/^([A-Z]{4})/);
    window.localIcao = match ? match[1] : "";

    const facilityInfo = facilityMap[data.facility] || facilityMap[parseInt(data.facility)];
    const newMode = (facilityInfo && facilityInfo[0]) || "";
    const modeChanged = window.controllerMode !== newMode;

    window.controllerMode = newMode;
    window.positionId = data.positionId || "";
    window.controllerCallsign = data.callsign || "";

    if (modeChanged) {
        console.log(`Controller mode changed to: ${newMode}. Refreshing tooltips.`);
        document.querySelectorAll('.strip').forEach(strip => {
            if (typeof applyTooltipsToStrip === 'function') {
                applyTooltipsToStrip(strip, strip.dataset.type);
            }
        });
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const fetchJson = async (url, fallbackUrl) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`Error loading ${url}, trying fallback ${fallbackUrl}:`, error);
            if (fallbackUrl) {
                try {
                    const response = await fetch(fallbackUrl);
                    if (!response.ok) throw new Error(`Fallback HTTP error! status: ${response.status}`);
                    return await response.json();
                } catch (fallbackError) {
                    console.error(`Error loading fallback ${fallbackUrl}:`, fallbackError);
                }
            }
        }
        return null;
    };

    (async () => {
        const REMOTE_PROCEDURES = "https://raw.githubusercontent.com/Simplezes/StripCol/refs/heads/main/src/client/assets/procedures.json";
        const REMOTE_SECTORS = "https://raw.githubusercontent.com/Simplezes/StripCol/refs/heads/main/src/client/assets/sectors.json";
        const LOCAL_PROCEDURES = "./assets/procedures.json";
        const LOCAL_SECTORS = "./assets/sectors.json";

        try {
            [jsonData, jsonDataSector] = await Promise.all([
                fetchJson(REMOTE_PROCEDURES, LOCAL_PROCEDURES),
                fetchJson(REMOTE_SECTORS, LOCAL_SECTORS),
            ]);
            // Start connection only after data is ready
            startConnectionMonitoring();
        } catch (e) {
            console.error("Error loading data", e);
            startConnectionMonitoring();
        }
    })();
});