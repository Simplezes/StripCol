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

let currentSessionCode = null;
let evtSource = null;

window.controllerMode = "aerodrome";
window.positionId = "";
window.facilityType = "tower"; // del | ground | tower | approach | center

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

    const checkConnection = (retries = 5) => {
        apiFetch('/api')
            .then(response => {
                if (response.ok) updateWsStatus(true);
            })
            .catch(() => {
                if (retries > 0) {
                    setTimeout(() => checkConnection(retries - 1), 1000);
                }
            });
    };
    checkConnection();

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
            updateWsStatus(true);
        } else {
            window.isPluginLinked = false;
            updateWsStatus(false);
            aircraftMap = {}; // Clear aircraft map on disconnect
            stateManager.clearEuroscopeStrips();
        }
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




        if (typeof moveStripToHandover === 'function') {
            moveStripToHandover(callsign);
        } else {
            deleteStripFromPanels(callsign);
        }
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
        sseRetryDelay = 2000;

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

        aircraftMap = {}; // Clear aircraft map on error
        stateManager.clearEuroscopeStrips();

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

    stateManager.clearEuroscopeStrips();

    updateWsStatus(false);
}

function fetchAndRenderAircraftList() {
    const code = getLinkCode();
    apiFetch(`/api/assumed?code=${code}`)
        .then(response => response.json())
        .then(aircrafts => {
            aircrafts.forEach(ac => {
                aircraftMap[ac.callsign] = ac;
            });

            for (const callsign in aircraftMap) {
                renderAircraft(aircraftMap[callsign]);
            }
            if (typeof syncRPC === 'function') syncRPC();
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

    const existingStrip = stateManager.getStrip(stripId);
    if (existingStrip) return;

    let targetPanelName;
    if (flight.transfer) {
        targetPanelName = "Handover";
    } else {
        // Facility-aware spawn routing
        const settings = (typeof currentSettings !== 'undefined' && currentSettings) ? currentSettings : {};
        const autoMove = settings.autoMoveClearance;
        const aerodromeFacilities = new Set(['del', 'ground', 'tower']);

        if (autoMove && aerodromeFacilities.has(window.facilityType) && flight.clearedFlag == 1) {
            targetPanelName = "Clearance";
        } else {
            // Each position routes strip types to the correct panel
            const ft = window.facilityType || "tower";
            const cm = window.controllerMode;

            if (cm === "approach" || cm === "center") {
                // Radar positions
                if (type === "departure")    targetPanelName = "Departures";
                else if (type === "arrival") targetPanelName = "Arrivals";
                else                         targetPanelName = "Overfly";
            } else if (ft === "ground") {
                // Ground: arrivals go to Ground Movement, everything else to Pending
                if (type === "arrival")      targetPanelName = "Ground Movement";
                else                         targetPanelName = "Pending"; // departure + overfly/unknown
            } else if (ft === "tower") {
                // Tower: arrivals from Approach go to Sequence, departures/unknown to Pending
                if (type === "arrival")      targetPanelName = "Sequence";
                else                         targetPanelName = "Pending";
            } else {
                // DEL and TWR: everything starts in Pending
                targetPanelName = "Pending";
            }
        }
    }

    let panel = document.querySelector(`[data-panel-name="${targetPanelName}"]`);


    if (!panel) {
        panel = document.querySelector("[data-panel-name]");
        if (!panel) return;
    }

    const stripContainer = panel.querySelector(".strip-container");
    if (!stripContainer) return;

    const strip = createStrip(type, flight, true, stripId);
    strip.dataset.callsign = flight.callsign;
    if (!flight.callsign) strip.dataset.euroscope = "false";


    if (flight.transfer) {
        stripContainer.prepend(strip);
        if (typeof window.expandHandover === 'function') window.expandHandover();
    } else {
        stripContainer.appendChild(strip);
    }

    const panelName = panel.dataset.panelName;

    if (panelName) addStripToPanel(panelName, strip, flight);
}

function setControllerInfo(data, returnPositionName = false) {
    const facilityMap = {
        1: ["aerodrome", "Flight Service Station", "tower"],
        2: ["aerodrome", "Clearance Delivery", "del"],
        3: ["aerodrome", "Ground", "ground"],
        4: ["aerodrome", "Tower", "tower"],
        5: ["approach", "Approach / Departure", "approach"],
        6: ["center", "Area Control Center", "center"]
    };

    if (returnPositionName) {
        const facilityInfo = facilityMap[data.facility] || facilityMap[parseInt(data.facility)];
        return (facilityInfo && facilityInfo[1]) || "";
    }

    const match = (data.callsign || "").match(/^([A-Z]{4})/);
    window.localIcao = match ? match[1] : "";

    const facilityInfo = facilityMap[data.facility] || facilityMap[parseInt(data.facility)];
    const newMode = (facilityInfo && facilityInfo[0]) || "";
    const newFacilityType = (facilityInfo && facilityInfo[2]) || "tower";
    const modeChanged = window.controllerMode !== newMode || window.facilityType !== newFacilityType;

    window.controllerMode = newMode;
    window.facilityType = newFacilityType;
    window.positionId = data.positionId || "";
    window.controllerCallsign = data.callsign || "";

    if (modeChanged) {
        console.log(`Controller mode changed to: ${newMode}. Refreshing tooltips & layout.`);
        if (typeof applyFacilityLayout === 'function') {
            applyFacilityLayout();
        }
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

            startConnectionMonitoring();
        } catch (e) {
            console.error("Error loading data", e);
            startConnectionMonitoring();
        }
    })();
});
