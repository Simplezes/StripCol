const mainLayout = document.getElementById("mainLayout");
const addPanelBtn = document.getElementById("addPanelBtn");
const MAX_PANELS = 6;
let panelUnderMouse = null;
let stripUnderMouse = null;

function savePanel(panel) {
    const panelData = { name: panel.name, strips: [] };

    const existing = stateManager.getPanel(panel.name);
    if (existing) {
        stateManager.updatePanel(panel.name, panelData);
    } else {
        stateManager.addPanel(panelData);
    }
}

function loadPanels() {
    return stateManager.getPanels().map(panel => ({ ...panel }));
}

function removePanel(panelName) {
    stateManager.removePanel(panelName);
}

function createPanelElement(panel) {
    const panelElement = document.createElement("div");
    panelElement.className = "card h-100 mb-4";
    panelElement.dataset.panelName = panel.name;

    const stripContainer = document.createElement("div");
    stripContainer.className = "strip-container";
    const header = createPanelHeader(panel.name);

    panelElement.appendChild(header);
    panelElement.appendChild(stripContainer);
    mainLayout.appendChild(panelElement);

    panelElement.addEventListener("contextmenu", (e) => {
        showPanelContextMenu(e, panelElement, stripContainer);
    });

    return { panelElement, header };
}

function createPanelHeader(panelName) {
    const header = document.createElement("div");
    header.className = "card-header d-flex align-items-center gap-2";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = panelName;
    nameInput.className = "form-control form-control-sm flex-grow-1 bg-transparent border-0 text-white panel-name-input";
    nameInput.style = "font-weight: bold;";

    header.appendChild(nameInput);

    nameInput.addEventListener("blur", function () {
        const oldName = panelName;
        const newName = this.value.trim();

        if (oldName !== newName) {
            updatePanelName(oldName, newName);

            const panelElement = header.closest('[data-panel-name]');
            if (panelElement) {
                panelElement.dataset.panelName = newName;
            }

            panelName = newName;
        }
    });

    return header;
}

function showPanelContextMenu(event, panelElement, stripContainer) {
    event.preventDefault();
    document.querySelectorAll(".strip-context-menu").forEach(m => m.remove());

    const menu = document.createElement("div");
    menu.classList.add("strip-context-menu");
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`;

    const createMenuItem = (text, icon, onClick) => {
        const item = document.createElement("div");
        item.innerHTML = `<span class="material-icons">${icon}</span>${text}`;
        item.classList.add("menu-item");
        item.addEventListener("click", onClick);
        return item;
    };

    const addStripOption = createMenuItem("Add Strip", "add", () => {
        showPanelAddStripMenu(menu, panelElement, stripContainer);
    });

    const assumeAircraftOption = createMenuItem("Assume aircraft", "search", () => {
        showAssumeAircraftMenu(menu, panelElement, stripContainer);
    });

    const removePanelOption = createMenuItem("Remove Panel", "delete", () => {
        const panelName = panelElement.dataset.panelName;
        removePanel(panelName);
        panelElement.remove();
        updatePanels();
        menu.remove();
    });

    menu.appendChild(addStripOption);
    menu.appendChild(assumeAircraftOption);
    menu.appendChild(removePanelOption);

    document.body.appendChild(menu);
    if (typeof positionMenuSafely === 'function') {
        positionMenuSafely(menu, event.clientX, event.clientY);
    }

    setTimeout(() => {
        const handler = ev => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener("mousedown", handler);
            }
        };
        document.addEventListener("mousedown", handler);
    });
}

function showPanelAddStripMenu(menu, panelElement, stripContainer) {
    menu.innerHTML = '';

    const backBtn = document.createElement("div");
    backBtn.classList.add("menu-back-btn");
    backBtn.innerHTML = `<span class="material-icons">arrow_back</span>Back`;
    backBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showPanelContextMenu({
            preventDefault: () => { },
            clientX: parseInt(menu.style.left),
            clientY: parseInt(menu.style.top)
        }, panelElement, stripContainer);
    });
    menu.appendChild(backBtn);

    const stripTypes = [
        { label: "Departure", icon: "flight_takeoff" },
        { label: "Arrival", icon: "flight_land" },
        { label: "Overfly", icon: "airplanemode_active" }
    ];

    stripTypes.forEach(({ label, icon }) => {
        const item = document.createElement("div");
        item.innerHTML = `<span class="material-icons">${icon}</span>${label}`;
        item.classList.add("menu-item");
        item.addEventListener("click", () => {
            const strip = createStrip(label.toLowerCase());
            if (strip) {
                const panelName = panelElement.dataset.panelName;
                stripContainer.appendChild(strip);
                addStripToPanel(panelName, strip);

                // Add listener for newly created local strip
                const callsignInput = strip.querySelector(".c1");
                if (callsignInput) {
                    callsignInput.addEventListener("blur", async (e) => {
                        const callsign = e.target.value.trim();
                        if (callsign) {
                            const response = await fetch(`${GATEWAY_URL}/api/assume-aircraft`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code: getLinkCode(), callsign }),
                            });
                            if (response.ok) {
                                const data = await response.json();
                                if (data.success) {
                                    stateManager.removeStrip(strip.dataset.stripId);
                                    strip.remove();
                                }
                            }
                        }
                    });
                }
            }
            menu.remove();
        });
        menu.appendChild(item);
    });
}

function showAssumeAircraftMenu(menu, panelElement, stripContainer) {
    menu.innerHTML = `<div class="menu-item disabled">Searching...</div>`;

    // Request nearby aircraft list from plugin via server
    fetch(`${GATEWAY_URL}/api/get-nearby-aircraft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: getLinkCode() })
    });

    // Define the global handler for the response
    window.onNearbyAircraftReceived = (callsigns) => {
        menu.innerHTML = '';

        const backBtn = document.createElement("div");
        backBtn.classList.add("menu-back-btn");
        backBtn.innerHTML = `<span class="material-icons">arrow_back</span>Back`;
        backBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            showPanelContextMenu({
                preventDefault: () => { },
                clientX: parseInt(menu.style.left),
                clientY: parseInt(menu.style.top)
            }, panelElement, stripContainer);
        });
        menu.appendChild(backBtn);

        // Sort callsigns alphabetically
        if (callsigns) {
            callsigns.sort((a, b) => a.localeCompare(b));
        }

        if (!callsigns || callsigns.length === 0) {
            const empty = document.createElement("div");
            empty.className = "menu-item disabled";
            empty.textContent = "No aircraft nearby";
            menu.appendChild(empty);
            return;
        }

        // Add Search Bar
        const searchContainer = document.createElement("div");
        searchContainer.className = "menu-search-container";
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.placeholder = "Search Callsign...";
        searchInput.className = "menu-search-input";
        searchContainer.appendChild(searchInput);
        menu.appendChild(searchContainer);

        // Scrollable Container for items
        const scrollContainer = document.createElement("div");
        scrollContainer.className = "menu-scroll-container";
        menu.appendChild(scrollContainer);

        const renderItems = (filter = "") => {
            scrollContainer.innerHTML = "";
            const filtered = callsigns.filter(c => c.toLowerCase().includes(filter.toLowerCase()));

            if (filtered.length === 0) {
                const empty = document.createElement("div");
                empty.className = "menu-item disabled";
                empty.textContent = "No matches";
                scrollContainer.appendChild(empty);
                return;
            }

            filtered.forEach(callsign => {
                const item = document.createElement("div");
                item.className = "menu-item";
                item.innerHTML = `<span class="material-icons">airplanemode_active</span>${callsign}`;
                item.addEventListener("click", async () => {
                    const response = await fetch(`${GATEWAY_URL}/api/assume-aircraft`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: getLinkCode(), callsign })
                    });

                    if (response.ok) {
                        menu.remove();
                        showToast(`Assumed ${callsign}`, 'success');
                    } else {
                        showToast(`Failed to assume ${callsign}`, 'error');
                    }
                });
                scrollContainer.appendChild(item);
            });
        };

        searchInput.addEventListener("input", (e) => {
            renderItems(e.target.value);
        });

        renderItems();

        // Focus search bar
        setTimeout(() => searchInput.focus(), 50);

        // Clean up global listener
        window.onNearbyAircraftReceived = null;
    };
}


function updatePanelName(oldName, newName) {
    if (stateManager.renamePanel(oldName, newName)) {
        const panelElement = document.querySelector(`[data-panel-name="${oldName}"]`);
        if (panelElement) {
            panelElement.dataset.panelName = newName;
        }
    }
}

function createPanel(name = "Panel") {
    const panels = loadPanels();
    if (panels.find(p => p.name === name)) return;

    const panel = { name };
    savePanel(panel);
    createPanelElement(panel);
    updatePanels();
    enableSortableForAllPanels();
}

function updatePanels() {
    updateAddButton();
    updateMainLayoutGrid();
}

function updateAddButton() {
    if (addPanelBtn) addPanelBtn.disabled = mainLayout.children.length >= MAX_PANELS;
}

function updateMainLayoutGrid() {
    const paneCount = mainLayout.children.length;
    if (paneCount === 0) return;

    let columns = 1;
    let rows = 1;

    if (paneCount === 1) { columns = 1; rows = 1; }
    else if (paneCount === 2) { columns = 2; rows = 1; }
    else if (paneCount <= 4) { columns = 2; rows = 2; }
    else if (paneCount <= 6) { columns = 3; rows = 2; }

    mainLayout.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    mainLayout.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
}

function addStripToPanel(panelName, stripEl, flightPlan = null) {
    const stripId = stripEl.dataset.stripId || ("strip-" + Date.now());
    stripEl.dataset.stripId = stripId;

    const values = {};
    stripEl.querySelectorAll("input").forEach(input => {
        const cls = Array.from(input.classList).find(c => c.startsWith("c"));
        values[cls] = input.value;
    });

    const newStrip = {
        id: stripId,
        type: stripEl.dataset.type,
        values: values,
        euroscope: stripEl.dataset.euroscope === "true",
        flightPlan: flightPlan || null,
        lastUpdate: Date.now()
    };

    stateManager.addStrip(panelName, newStrip);
}

function renderStrips() {
    const panels = stateManager.getPanels();

    panels.forEach(panel => {
        const panelElement = document.querySelector(`[data-panel-name="${panel.name}"]`);
        if (!panelElement) return;

        const stripContainer = panelElement.querySelector(".strip-container");
        if (!stripContainer) return;

        stripContainer.innerHTML = "";

        if (panel.strips && panel.strips.length > 0) {
            panel.strips.forEach(stripData => {
                const isEuroscope = stripData.euroscope === true;
                const stripEl = createStrip(stripData.type, stripData.flightPlan || null, isEuroscope, stripData.id);

                stripEl.dataset.stripId = stripData.id;
                stripEl.dataset.euroscope = isEuroscope ? "true" : "false";

                setTimeout(() => {
                    if (stripData.values) {
                        Object.entries(stripData.values).forEach(([cls, val]) => {
                            const input = stripEl.querySelector(`input.${cls}`);
                            if (input && val) {
                                input.value = val;
                                autoResizeInputFont(input);
                            }
                        });
                    }
                }, 0);

                stripContainer.appendChild(stripEl);
            });
        }
    });
    enableSortableForAllPanels();
}

addPanelBtn.addEventListener("click", () => {
    if (mainLayout.children.length < MAX_PANELS) {
        const panels = loadPanels();
        let i = 1;
        let newName = `Panel ${i}`;
        while (panels.some(p => p.name === newName)) {
            i++;
            newName = `Panel ${i}`;
        }
        createPanel(newName);
        updatePanels();
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const panels = loadPanels();

    if (panels.length === 0) {
        createPanel("Departure");
        createPanel("Arrival");
        createPanel("Overfly");
        createPanel("Ground");
    } else {
        panels.forEach(panel => createPanelElement(panel));
        waitForControllerModeAndRender();
    }
    updatePanels();
});

function waitForControllerModeAndRender() {
    const interval = setInterval(() => {
        if (window.controllerMode || !window.isConnected) {
            clearInterval(interval);
            renderStrips();
        }
    }, 100);
}