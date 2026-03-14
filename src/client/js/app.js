let GATEWAY_URL = "http://127.0.0.1:3000";

function getSettings() {
    const saved = localStorage.getItem('stripcol_settings');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) { return {}; }
    }
    return {};
}

function updateGatewayUrl() {
    const settings = getSettings();
    const ip = settings.serverIp || '127.0.0.1';
    GATEWAY_URL = `http://${ip}:3000`;
}

async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${GATEWAY_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;


    if (options.method && options.method !== 'GET' && !options.headers) {
        options.headers = { 'Content-Type': 'application/json' };
    }

    try {
        const response = await fetch(url, options);
        return response;
    } catch (e) {
        console.error(`API Fetch failed: ${url}`, e);
        throw e;
    }
}

updateGatewayUrl();

function getLinkCode() {
    return getSettings().linkCode || null;
}

function createGlobalMenuItem(text, icon, onClick) {
    const item = document.createElement("div");
    item.innerHTML = `<span class="material-icons">${icon}</span>${text}`;
    item.classList.add("menu-item");
    item.addEventListener("click", onClick);
    return item;
}

function updateZuluTime() {
    const now = new Date();
    const utc = now.toUTCString().match(/(\d{2}:\d{2}:\d{2})/)[0];
    const parts = utc.split(':');


    const showSeconds = (typeof currentSettings !== 'undefined') ? currentSettings.showSeconds : true;
    const timeString = showSeconds ? utc : `${parts[0]}:${parts[1]}`;

    const zuluTimeEl = document.getElementById("zuluTime");
    if (zuluTimeEl) zuluTimeEl.innerText = timeString;
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `atm-toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error';
    if (type === 'warning') icon = 'warning';

    toast.innerHTML = `
        <span class="material-icons toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => {
            toast.remove();
            if (container.childNodes.length === 0) container.remove();
        });
    }, 4000);
}

function positionMenuSafely(menu, x, y) {
    if (!menu) return;
    requestAnimationFrame(() => {
        const { innerWidth, innerHeight } = window;
        const rect = menu.getBoundingClientRect();
        let top = y;
        let left = x;
        if (x + rect.width > innerWidth) left = innerWidth - rect.width - 8;
        if (y + rect.height > innerHeight) top = innerHeight - rect.height - 8;
        menu.style.top = `${Math.max(8, top)}px`;
        menu.style.left = `${Math.max(8, left)}px`;
    });
}

function cleanupStripObservers(strip) {
    strip.querySelectorAll("input.box").forEach(input => {
        if (input._resizeObserver) {
            input._resizeObserver.disconnect();
            delete input._resizeObserver;
        }
    });
}

document.addEventListener('DOMContentLoaded', async function () {
    setInterval(updateZuluTime, 1000);
    updateZuluTime();

    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterStrips(query);
        });
    }
});

function filterStrips(query) {
    const strips = document.querySelectorAll('.strip');
    strips.forEach(strip => {
        if (!query) {
            strip.style.display = '';
            strip.classList.remove('filtered-out');
            return;
        }

        const inputs = Array.from(strip.querySelectorAll('input.box'));
        const matches = inputs.some(input => input.value.toLowerCase().includes(query));

        const dataMatches = (strip.dataset.callsign || '').toLowerCase().includes(query) ||
            (strip.dataset.type || '').toLowerCase().includes(query);

        if (matches || dataMatches) {
            strip.style.display = '';
            strip.classList.remove('filtered-out');
        } else {
            strip.style.display = 'none';
            strip.classList.add('filtered-out');
        }
    });
}

document.addEventListener('click', (event) => {
    const externalLink = event.target.closest('.external-link');
    if (externalLink) {
        event.preventDefault();
        const url = externalLink.getAttribute('href');
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    }
});

// Prevent default drag and drop behaviors to avoid accidental application resets/reloads
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
});

// Prevent default reload shortcuts and backspace navigation
document.addEventListener('keydown', (e) => {
    // Prevent F5 and Ctrl+R
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
    }
    // Prevent Backspace navigating back (if not in an input/textarea)
    if (e.key === 'Backspace') {
        const activeNode = document.activeElement ? document.activeElement.nodeName : '';
        if (activeNode !== 'INPUT' && activeNode !== 'TEXTAREA') {
            e.preventDefault();
        }
    }
});
