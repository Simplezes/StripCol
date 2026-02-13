let GATEWAY_URL = "http://127.0.0.1:3000";

function updateGatewayUrl() {
    const saved = localStorage.getItem('stripcol_settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            const ip = settings.serverIp || '127.0.0.1';
            GATEWAY_URL = `http://${ip}:3000`;
        } catch (e) { }
    }
}

updateGatewayUrl();

const DEFAULT_COLORS = {
    departure: '#6ee7b7',
    arrival: '#f87171',
    overfly: '#fde68a'
};

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getLinkCode() {
    const saved = localStorage.getItem('stripcol_settings');
    if (saved) {
        try {
            return JSON.parse(saved).linkCode;
        } catch (e) { return null; }
    }
    return null;
}

function updateZuluTime() {
    const now = new Date();
    const utc = now.toUTCString().match(/(\d{2}:\d{2}:\d{2})/)[0];
    const parts = utc.split(':');

    // Check global settings (defined in settings.js)
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

    // Choose icon based on type
    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error';
    if (type === 'warning') icon = 'warning';

    toast.innerHTML = `
        <span class="material-icons toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
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
});
