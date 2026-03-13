const SETTINGS_KEY = 'stripcol_settings';

const DEFAULT_SETTINGS = {
    audioEnabled: true,
    cleanupEnabled: false,
    cleanupMinutes: 15,
    showSeconds: true,

    departureColor: '#6ee7b7',
    arrivalColor: '#f87171',
    overflyColor: '#fde68a',
    linkCode: '',
    serverIp: '127.0.0.1',
    discordRpcEnabled: true
};

let originalServerIp = '127.0.0.1';

let currentSettings = { ...DEFAULT_SETTINGS };

function loadSettings() {
    const settings = getSettings();
    if (settings) {
        currentSettings = { ...DEFAULT_SETTINGS, ...settings };
        originalServerIp = currentSettings.serverIp;
    }
    applySettings();
    updateUIFromSettings();
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
    if (window.electronAPI && window.electronAPI.saveSettings) {
        window.electronAPI.saveSettings({ 
            serverIp: currentSettings.serverIp,
            discordRpcEnabled: currentSettings.discordRpcEnabled 
        });
    }
    applySettings();
}

function applySettings() {
    const root = document.documentElement;
    root.style.setProperty('--custom-departure-color', currentSettings.departureColor);
    root.style.setProperty('--custom-arrival-color', currentSettings.arrivalColor);
    root.style.setProperty('--custom-overfly-color', currentSettings.overflyColor);



    const cleanupTimer = document.getElementById('cleanupTimerContainer');
    if (cleanupTimer) cleanupTimer.style.display = currentSettings.cleanupEnabled ? 'flex' : 'none';

    const codeDisplay = document.getElementById('currentLinkCodeDisplay');
    if (codeDisplay) codeDisplay.textContent = currentSettings.linkCode || '-----';
}

function updateUIFromSettings() {
    const toggles = {
        'audioToggle': currentSettings.audioEnabled,
        'cleanupToggle': currentSettings.cleanupEnabled,
        'showSecondsToggle': currentSettings.showSeconds,
        'discordRpcToggle': currentSettings.discordRpcEnabled
    };

    for (const [id, val] of Object.entries(toggles)) {
        const el = document.getElementById(id);
        if (el) el.checked = val;
    }

    const cleanupMinutes = document.getElementById('cleanupMinutes');
    if (cleanupMinutes) cleanupMinutes.value = currentSettings.cleanupMinutes;

    const colors = {
        'departureColor': currentSettings.departureColor,
        'arrivalColor': currentSettings.arrivalColor,
        'overflyColor': currentSettings.overflyColor
    };

    for (const [id, val] of Object.entries(colors)) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    const linkCodeInput = document.getElementById('linkCodeInput');
    if (linkCodeInput) linkCodeInput.value = currentSettings.linkCode;

    const serverIpInput = document.getElementById('serverIpInput');
    if (serverIpInput) serverIpInput.value = currentSettings.serverIp;
}

function initSettingsEvents() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });

    const toggleBindings = {
        'audioToggle': 'audioEnabled',
        'cleanupToggle': 'cleanupEnabled',
        'showSecondsToggle': 'showSeconds',
        'discordRpcToggle': 'discordRpcEnabled'
    };

    for (const [id, key] of Object.entries(toggleBindings)) {
        document.getElementById(id).addEventListener('change', (e) => {
            currentSettings[key] = e.target.checked;
            saveSettings();
        });
    }

    document.getElementById('cleanupMinutes').addEventListener('change', (e) => {
        currentSettings.cleanupMinutes = parseInt(e.target.value) || 15;
        saveSettings();
    });

    ['departureColor', 'arrivalColor', 'overflyColor'].forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            currentSettings[id] = e.target.value;
            saveSettings();
        });
    });

    document.getElementById('resetColors').addEventListener('click', () => {
        currentSettings.departureColor = DEFAULT_SETTINGS.departureColor;
        currentSettings.arrivalColor = DEFAULT_SETTINGS.arrivalColor;
        currentSettings.overflyColor = DEFAULT_SETTINGS.overflyColor;
        updateUIFromSettings();
        saveSettings();
    });

    initPairingLogic();

    const linkCodeStatus = document.getElementById('linkCodeStatus');
    if (linkCodeStatus) {
        linkCodeStatus.addEventListener('dblclick', () => {
            const displayEl = document.getElementById('currentLinkCodeDisplay');
            if (displayEl.querySelector('input')) return; // Already editing

            const currentCode = displayEl.textContent.trim() === '-----' ? '' : displayEl.textContent.trim();

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'sys-input-minimal';
            input.value = currentCode;
            input.maxLength = 5;

            displayEl.innerHTML = '';
            displayEl.appendChild(input);
            input.focus();

            const saveCode = async () => {
                const newCode = input.value.trim().toUpperCase();
                if (newCode.length === 5) {
                    try {
                        const response = await apiFetch(`/api/pair/${newCode}`);
                        const result = await response.json();

                        if (result.success) {
                            currentSettings.linkCode = newCode;
                            saveSettings();
                            if (window.reconnectSSE) window.reconnectSSE();
                            showToast("Linked successfully!", "success");
                            displayEl.textContent = newCode;
                        } else {
                            showToast("Pairing failed: " + result.message, "error");
                            displayEl.textContent = currentCode || '-----';
                        }
                    } catch (e) {
                        showToast("Connection failed", "error");
                        displayEl.textContent = currentCode || '-----';
                    }
                } else {
                    displayEl.textContent = currentCode || '-----';
                }
            };

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    if (displayEl.contains(input)) saveCode();
                }, 100);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });
        });
        linkCodeStatus.style.cursor = 'pointer';
        linkCodeStatus.title = "Double-click to enter Link Code directly";
    }

    initUpdateCheck();
}

function renderUpdateResult(result) {
    const updateStatus = document.getElementById('updateStatus');
    const versionDisplay = document.getElementById('appVersionDisplay');

    if (result && result.error) {
        updateStatus.innerHTML = `<span class="text-danger">Failed: ${result.error}</span>`;
    } else {
        // With electron-updater, checking-for-updates is the first step.
        // The actual update availability is handled via events.
        updateStatus.innerHTML = '<span class="text-info">Checking...</span>';
        if (versionDisplay && result && result.currentVersion) versionDisplay.textContent = result.currentVersion;
    }
}

async function initAppVersion() {
    try {
        const version = await window.electronAPI.getVersion();
        const display = document.getElementById('appVersionDisplay');
        if (display) display.textContent = version;
    } catch (e) {
        console.error("Failed to get version", e);
    }
}

function initUpdateCheck() {
    const checkBtn = document.getElementById('checkUpdatesBtn');
    const updateStatus = document.getElementById('updateStatus');

    if (!checkBtn || !window.electronAPI) return;

    // Register event listeners
    window.electronAPI.onUpdateAvailable((info) => {
        updateStatus.innerHTML = `
            <div class="update-available-box text-success p-2 rounded" style="background: rgba(110, 231, 183, 0.1); border: 1px solid rgba(110, 231, 183, 0.2);">
                <div class="fw-bold">Update Available: V${info.version}</div>
                <div id="downloadProgress" class="mt-2" style="font-size: 11px; color: var(--text-dim);">
                    Initializing download...
                </div>
            </div>
        `;
    });

    window.electronAPI.onUpdateNotAvailable(() => {
        updateStatus.innerHTML = '<span class="text-success">You are up to date!</span>';
        checkBtn.disabled = false;
        checkBtn.innerHTML = '<span class="material-icons me-2" style="font-size: 16px;">update</span>Check for Updates';
    });

    window.electronAPI.onUpdateError((message) => {
        updateStatus.innerHTML = `<span class="text-danger">Update error: ${message}</span>`;
        checkBtn.disabled = false;
        checkBtn.innerHTML = '<span class="material-icons me-2" style="font-size: 16px;">update</span>Check for Updates';
    });

    window.electronAPI.onDownloadProgress((progress) => {
        const progressEl = document.getElementById('downloadProgress');
        if (progressEl) {
            progressEl.innerHTML = `Downloading: ${Math.round(progress.percent)}% (${(progress.transferred / 1024 / 1024).toFixed(2)} MB / ${(progress.total / 1024 / 1024).toFixed(2)} MB)`;
        }
    });

    window.electronAPI.onUpdateDownloaded((info) => {
        updateStatus.innerHTML = `
            <div class="update-available-box text-success p-2 rounded" style="background: rgba(110, 231, 183, 0.1); border: 1px solid rgba(110, 231, 183, 0.2);">
                <div class="fw-bold">Update Downloaded! (V${info.version})</div>
                <div class="mt-1" style="font-size: 11px;">Restart to apply the update.</div>
                <button id="installUpdateBtn" class="btn btn-sm btn-success mt-2 py-1 px-3" style="font-size: 11px;">
                    Restart & Install
                </button>
            </div>
        `;
        document.getElementById('installUpdateBtn').addEventListener('click', () => {
            window.electronAPI.startUpdate();
        });
    });

    checkBtn.addEventListener('click', async () => {
        if (checkBtn.disabled) return;

        checkBtn.disabled = true;
        checkBtn.innerHTML = '<span class="material-icons rotating me-2" style="font-size: 16px;">sync</span>Checking...';
        updateStatus.innerHTML = '';

        try {
            await window.electronAPI.checkForUpdates();
        } catch (e) {
            updateStatus.innerHTML = '<span class="text-danger">Check failed.</span>';
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<span class="material-icons me-2" style="font-size: 16px;">update</span>Check for Updates';
        }
    });
}

async function autoCheckForUpdates() {
    try {
        const result = await window.electronAPI.checkForUpdates();
        if (result && result.updateAvailable) {
            // Open Settings Modal
            const settingsBtn = document.getElementById('settingsBtn');
            if (settingsBtn) settingsBtn.click();

            // Switch to About Tab
            const aboutTab = document.querySelector('.settings-tab[data-tab="about"]');
            if (aboutTab) aboutTab.click();

            // Populate the UI directly
            renderUpdateResult(result);
        }
    } catch (e) {
        console.error("Auto update check failed", e);
    }
}

function initPairingLogic() {
    const pairBtn = document.getElementById('pairBtn');
    const linkCodeInput = document.getElementById('linkCodeInput');
    const pairingStatus = document.getElementById('pairingStatus');

    if (!pairBtn) return;

    pairBtn.addEventListener('click', async () => {
        const code = linkCodeInput.value.trim().toUpperCase();
        if (code.length !== 5) {
            pairingStatus.innerHTML = '<span class="text-danger">Code must be 5 characters.</span>';
            return;
        }

        pairingStatus.innerHTML = '<span class="text-info">Checking connection...</span>';

        try {
            const response = await apiFetch(`/api/pair/${code}`);
            const result = await response.json();

            if (result.success) {
                pairingStatus.innerHTML = '<span class="text-success">Paired successfully!</span>';
                currentSettings.linkCode = code;
                saveSettings();

                if (window.reconnectSSE) window.reconnectSSE();

                setTimeout(() => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                    if (modal) modal.hide();
                }, 1000);
            } else {
                pairingStatus.innerHTML = `<span class="text-danger">${result.message}</span>`;
            }
        } catch (e) {
            pairingStatus.innerHTML = '<span class="text-danger">Gateway not found. Ensure server.js is running.</span>';
        }
    });

    linkCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') pairBtn.click();
    });
}

let audioCtx = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

const unlockAudio = () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log("AudioContext resumed successfully.");
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('mousedown', unlockAudio);
        });
    } else if (audioCtx && audioCtx.state === 'running') {
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('mousedown', unlockAudio);
    }
};

window.addEventListener('click', unlockAudio);
window.addEventListener('keydown', unlockAudio);
window.addEventListener('mousedown', unlockAudio);

window.playNotification = function () {
    if (!currentSettings.audioEnabled) return;

    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
        return;
    }

    try {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        console.error("Audio failed", e);
    }
}

function cleanupStrips() {
    if (!currentSettings.cleanupEnabled) return;

    const panels = JSON.parse(localStorage.getItem("panels")) || [];
    const now = Date.now();
    const threshold = currentSettings.cleanupMinutes * 60 * 1000;
    let modified = false;

    panels.forEach(panel => {
        if (!panel.strips) return;
        const initialCount = panel.strips.length;
        panel.strips = panel.strips.filter(strip => {
            const age = now - (strip.lastUpdate || now);
            const isOld = age > threshold;
            if (isOld) {
                const el = document.querySelector(`.strip[data-strip-id="${strip.id}"]`);
                if (el) el.remove();
                modified = true;
            }
            return !isOld;
        });
    });

    if (modified) {
        localStorage.setItem("panels", JSON.stringify(panels));
        console.log("Auto-cleanup performed.");
    }
}

document.getElementById('restartServerBtn').addEventListener('click', () => {
    const ip = document.getElementById('serverIpInput').value.trim() || '127.0.0.1';

    // Save the new IP to settings first
    currentSettings.serverIp = ip;
    saveSettings();

    // Ensure the global GATEWAY_URL is updated immediately in this session
    if (typeof updateGatewayUrl === 'function') {
        updateGatewayUrl();
    }

    if (window.electronAPI && window.electronAPI.restartServer) {
        window.electronAPI.restartServer(ip);
        originalServerIp = ip;

        if (typeof showToast === 'function') {
            showToast("Server IP updated. Restarting...", "success");
        }

        // Increased delay to allow the server to bind the new IP
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } else {
        console.error("restartServer bridge not available");
        if (typeof showToast === 'function') {
            showToast("Failed to restart server.", "error");
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initSettingsEvents();
    initAppVersion();
    autoCheckForUpdates();
    setInterval(cleanupStrips, 60000); // Check every minute
});
