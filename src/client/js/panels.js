const mainLayout = document.getElementById("mainLayout");




const DELIVERY_PANELS = [
    { key: "del-pending", defaultName: "Pending", cssClass: "panel-pending", badgeCount: true, col: 1 },
    { key: "del-clearance", defaultName: "Clearance", cssClass: "panel-clearance", badgeCount: true, col: 2 },
    { key: "handover", defaultName: "Handover", cssClass: "panel-handover", badgeCount: true, col: 3, noCollapse: true },
];

const GROUND_PANELS = [
    { key: "gnd-pending", defaultName: "Pending", cssClass: "panel-pending", badgeCount: true, col: 1 },
    { key: "gnd-clearance", defaultName: "Clearance", cssClass: "panel-clearance", badgeCount: true, col: 2 },
    { key: "gnd-pushback", defaultName: "Pushback", cssClass: "panel-pushback", badgeCount: true, col: 2 },
    { key: "gnd-movement", defaultName: "Ground Movement", cssClass: "panel-ground", badgeCount: true, col: 3 },
    { key: "handover", defaultName: "Handover", cssClass: "panel-handover", badgeCount: true, col: 3 },
];

const TOWER_PANELS = [
    { key: "twr-pending", defaultName: "Pending", cssClass: "panel-pending", badgeCount: true, col: 1 },
    { key: "twr-clearance", defaultName: "Clearance", cssClass: "panel-clearance", badgeCount: true, col: 1 },
    { key: "twr-pushback", defaultName: "Pushback", cssClass: "panel-pushback", badgeCount: true, col: 2 },
    { key: "twr-movement", defaultName: "Ground Movement", cssClass: "panel-ground", badgeCount: true, col: 2 },
    { key: "twr-holding", defaultName: "Holding Point", cssClass: "panel-hp-rwy", badgeCount: true, col: 2 },
    { key: "twr-sequence", defaultName: "Sequence", cssClass: "panel-sequence", badgeCount: true, col: 3 },
    { key: "handover", defaultName: "Handover", cssClass: "panel-handover", badgeCount: true, col: 3 },
];

const RADAR_PANELS = [
    { key: "departures", defaultName: "Departures", cssClass: "panel-departures", badgeCount: true, col: 1 },
    { key: "arrivals", defaultName: "Arrivals", cssClass: "panel-arrivals", badgeCount: true, col: 2 },
    { key: "overfly", defaultName: "Overfly", cssClass: "panel-overfly", badgeCount: true, col: 3 },
    { key: "holding", defaultName: "Holding", cssClass: "panel-holding", badgeCount: true, col: 3 },
    { key: "handover", defaultName: "Handover", cssClass: "panel-handover", badgeCount: true, col: 3 },
];

// Map facilityType → panel definition
const FACILITY_PANEL_MAP = {
    del: DELIVERY_PANELS,
    ground: GROUND_PANELS,
    tower: TOWER_PANELS,
    approach: RADAR_PANELS,
    center: RADAR_PANELS,
};

let currentLayoutMode = null;



function loadPanels() {
    return stateManager.getPanels().map(p => ({ ...p }));
}

function updatePanelBadge(panelElement) {
    const badge = panelElement.querySelector(".panel-strip-count");
    const count = panelElement.querySelectorAll(".strip").length;
    if (badge) badge.textContent = count;
}

function createPanelHeader(panelName, noCollapse = false) {
    const header = document.createElement("div");
    header.className = "card-header d-flex align-items-center gap-2";

    const nameText = document.createElement("span");
    nameText.textContent = panelName;
    nameText.className = "panel-name-text";

    const badge = document.createElement("span");
    badge.className = "panel-strip-count";
    badge.textContent = "0";

    header.appendChild(nameText);
    header.appendChild(badge);

    if (!noCollapse && (panelName === "Handover" || panelName.toUpperCase() === "HANDOVER")) {
        const settings = JSON.parse(localStorage.getItem('handoverCollapsed') || '{}');
        const isCollapsedInitial = settings[currentLayoutMode] !== false;

        const toggleIcon = document.createElement("span");
        toggleIcon.className = "material-icons handover-toggle-icon";
        toggleIcon.textContent = isCollapsedInitial ? "expand_less" : "expand_more";
        header.insertBefore(toggleIcon, nameText);

        header.style.cursor = "pointer";
        header.title = "Click to expand/collapse Handover";
        header.addEventListener("click", () => {
            const colElement = header.closest(".panel-col");
            if (colElement) {
                colElement.classList.toggle("handover-collapsed");
                const isCollapsed = colElement.classList.contains("handover-collapsed");

                const colIndex = colElement.dataset.col;
                const isRadar = currentLayoutMode === "radar";

                if (isCollapsed) {
                    mainLayout.style.setProperty(`--h${colIndex}`, '95%');
                    toggleIcon.textContent = "expand_less";
                } else {
                    mainLayout.style.setProperty(`--h${colIndex}`, '65%');
                    toggleIcon.textContent = "expand_more";
                }

                const settings = JSON.parse(localStorage.getItem('handoverCollapsed') || '{}');
                settings[currentLayoutMode] = isCollapsed;
                localStorage.setItem('handoverCollapsed', JSON.stringify(settings));

                if (typeof saveGridDimensions === 'function') saveGridDimensions();
            }
        });
    }

    return header;
}

function createPanelElement(panel, cssClass, colIndex, noCollapse = false) {
    const panelElement = document.createElement("div");
    panelElement.className = `card ${cssClass}`;
    panelElement.dataset.panelName = panel.name;

    const stripContainer = document.createElement("div");
    stripContainer.className = "strip-container";

    const header = createPanelHeader(panel.name, noCollapse);

    panelElement.appendChild(header);
    panelElement.appendChild(stripContainer);

    const colDiv = document.querySelector(`.panel-col[data-col="${colIndex}"]`);
    if (colDiv) colDiv.appendChild(panelElement);

    panelElement.addEventListener("contextmenu", (e) => {
        showPanelContextMenu(e, panelElement, stripContainer);
    });


    const observer = new MutationObserver(() => updatePanelBadge(panelElement));
    observer.observe(stripContainer, { childList: true, subtree: false });

    return { panelElement, header };
}

window.expandHandover = function () {
    const handoverPanel = document.querySelector('.panel-handover');
    if (!handoverPanel) return;

    const colElement = handoverPanel.closest(".panel-col");
    if (colElement && colElement.classList.contains("handover-collapsed")) {
        colElement.classList.remove("handover-collapsed");
        const colIndex = colElement.dataset.col;
        mainLayout.style.setProperty(`--h${colIndex}`, '65%');


        const icon = handoverPanel.querySelector('.handover-toggle-icon');
        if (icon) icon.textContent = "expand_more";


        const settings = JSON.parse(localStorage.getItem('handoverCollapsed') || '{}');
        settings[currentLayoutMode] = false;
        localStorage.setItem('handoverCollapsed', JSON.stringify(settings));

        if (typeof saveGridDimensions === 'function') saveGridDimensions();
    }
};

window.collapseHandoverIfEmpty = function (expectedCount = 0) {
    const handoverPanel = document.querySelector('.panel-handover');
    if (!handoverPanel) return;


    setTimeout(() => {
        const stripContainer = handoverPanel.querySelector('.strip-container');
        if (!stripContainer) return;


        const remainingTransfers = stripContainer.querySelectorAll('.transfer-request').length;

        if (remainingTransfers <= expectedCount) {
            const colElement = handoverPanel.closest(".panel-col");
            if (colElement && !colElement.classList.contains("handover-collapsed")) {
                colElement.classList.add("handover-collapsed");
                const colIndex = colElement.dataset.col;
                mainLayout.style.setProperty(`--h${colIndex}`, '95%');


                const icon = handoverPanel.querySelector('.handover-toggle-icon');
                if (icon) icon.textContent = "expand_less";


                const settings = JSON.parse(localStorage.getItem('handoverCollapsed') || '{}');
                settings[currentLayoutMode] = true;
                localStorage.setItem('handoverCollapsed', JSON.stringify(settings));

                if (typeof saveGridDimensions === 'function') saveGridDimensions();
            }
        }
    }, 100);
};

function showPanelContextMenu(event, panelElement, stripContainer) {
    event.preventDefault();
    document.querySelectorAll(".strip-context-menu").forEach(m => m.remove());

    const menu = document.createElement("div");
    menu.classList.add("strip-context-menu");
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`;

    const addStripBtn = createGlobalMenuItem("Add Strip Manually", "add", () => {
        showPanelAddStripMenu(menu, panelElement, stripContainer);
    });

    const assumeBtn = createGlobalMenuItem("Assume Aircraft", "connecting_airports", () => {
        showAssumeAircraftMenu(menu, panelElement, stripContainer);
    });

    menu.appendChild(addStripBtn);
    menu.appendChild(assumeBtn);

    document.body.appendChild(menu);
    if (typeof positionMenuSafely === "function") {
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
    menu.innerHTML = "";

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

                const callsignInput = strip.querySelector(".c1");
                if (callsignInput) {
                    callsignInput.addEventListener("blur", async (e) => {
                        const callsign = e.target.value.trim();
                        if (callsign) {
                            const response = await apiFetch(`/api/assume-aircraft`, {
                                method: "POST",
                                body: JSON.stringify({
                                    code: getLinkCode(),
                                    callsign: callsignInput.value.trim().toUpperCase(),
                                    panel: panelName
                                })
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

    apiFetch(`/api/get-nearby-aircraft`, {
        method: "POST",
        body: JSON.stringify({ code: getLinkCode() })
    });

    window.onNearbyAircraftReceived = (callsigns) => {
        menu.innerHTML = "";

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

        if (callsigns) callsigns.sort((a, b) => a.localeCompare(b));

        if (!callsigns || callsigns.length === 0) {
            const empty = document.createElement("div");
            empty.className = "menu-item disabled";
            empty.textContent = "No aircraft nearby";
            menu.appendChild(empty);
            return;
        }

        const searchContainer = document.createElement("div");
        searchContainer.className = "menu-search-container";
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.placeholder = "Search Callsign...";
        searchInput.className = "menu-search-input";
        searchContainer.appendChild(searchInput);
        menu.appendChild(searchContainer);

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
                    const panelName = panelElement.dataset.panelName;
                    const response = await apiFetch(`/api/assume-aircraft`, {
                        method: "POST",
                        body: JSON.stringify({
                            code: getLinkCode(),
                            callsign: callsign,
                            panel: panelName
                        })
                    });
                    if (response.ok) {
                        menu.remove();
                        showToast(`Assumed ${callsign}`, "success");
                    } else {
                        showToast(`Failed to assume ${callsign}`, "error");
                    }
                });
                scrollContainer.appendChild(item);
            });
        };

        searchInput.addEventListener("input", (e) => renderItems(e.target.value));
        renderItems();
        setTimeout(() => searchInput.focus(), 50);

        window.onNearbyAircraftReceived = null;
    };
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
                            if (input && val) input.value = val;
                        });
                    }
                }, 0);

                stripContainer.appendChild(stripEl);
            });
        }

        updatePanelBadge(panelElement);
    });

    enableSortableForAllPanels();
}

window.applyFacilityLayout = function () {
    const ft = window.facilityType || "tower";
    const isRadar = ft === "approach" || ft === "center";
    const targetLayout = isRadar ? "radar" : ft; // 'del' | 'ground' | 'tower' | 'radar'

    if (currentLayoutMode === targetLayout && mainLayout.children.length > 0) return;

    currentLayoutMode = targetLayout;

    mainLayout.dataset.layout = targetLayout;
    mainLayout.innerHTML = `
        <div class="panel-col" data-col="1"></div>
        <div class="panel-col" data-col="2"></div>
        <div class="panel-col" data-col="3"></div>
    `;

    const settings = JSON.parse(localStorage.getItem('layoutGridHeights') || '{}');
    if (settings[targetLayout]) {
        if (settings[targetLayout].h1 !== undefined) mainLayout.style.setProperty('--h1', `${settings[targetLayout].h1}%`);
        if (settings[targetLayout].h2 !== undefined) mainLayout.style.setProperty('--h2', `${settings[targetLayout].h2}%`);
        if (settings[targetLayout].h3 !== undefined) mainLayout.style.setProperty('--h3', `${settings[targetLayout].h3}%`);

        if (settings[targetLayout].c1 !== undefined) {
            mainLayout.style.setProperty('--c1', `${settings[targetLayout].c1}fr`);
            mainLayout.style.setProperty('--c2', `${settings[targetLayout].c2}fr`);
            mainLayout.style.setProperty('--c3', `${settings[targetLayout].c3}fr`);
        }
    } else {
        if (isRadar) {
            mainLayout.style.setProperty('--h1', '100%');
            mainLayout.style.setProperty('--h2', '100%');
            mainLayout.style.setProperty('--h3', '35%');
        } else {
            mainLayout.style.setProperty('--h1', '70%');
            mainLayout.style.setProperty('--h2', '50%');
            mainLayout.style.setProperty('--h3', '60%');
        }
        mainLayout.style.setProperty('--c1', '35fr');
        mainLayout.style.setProperty('--c2', '35fr');
        mainLayout.style.setProperty('--c3', '30fr');
    }

    const TARGET_DEF = FACILITY_PANEL_MAP[ft] || TOWER_PANELS;
    const targetNames = new Set(TARGET_DEF.map(d => d.defaultName));

    const savedPanels = loadPanels();
    const saveNames = new Set(savedPanels.map(p => p.name));

    const hasMatchingLayout = [...targetNames].some(tn => saveNames.has(tn));
    if (!hasMatchingLayout || savedPanels.length !== TARGET_DEF.length) {
        console.info(`[panels] Switching layout to ${targetLayout}. Wiping old layout data.`);
        localStorage.removeItem("panels");
        stateManager.panels = [];
    }


    TARGET_DEF.forEach(def => {
        const saved = loadPanels().find(p => p.name === def.defaultName);
        let panelName = (saved && saved.name) ? saved.name : def.defaultName;


        if (def.key === "handover") panelName = "Handover";

        if (!stateManager.getPanel(panelName)) {
            stateManager.addPanel({ name: panelName, key: def.key, strips: [] });
        }

        createPanelElement({ name: panelName }, def.cssClass, def.col, def.noCollapse || false);
    });


    // For noCollapse Handover panels (DEL), force them to always be 100% height
    const noCollapseDefs = (FACILITY_PANEL_MAP[window.facilityType || 'tower'] || []).filter(d => d.noCollapse);
    noCollapseDefs.forEach(def => {
        const colDiv = document.querySelector(`.panel-col[data-col="${def.col}"]`);
        if (colDiv) {
            colDiv.classList.remove("handover-collapsed");
            mainLayout.style.setProperty(`--h${def.col}`, '100%');
        }
    });

    // For collapsible Handover panels, apply saved state (skip cols that have noCollapse)
    const noCollapseCols = new Set(noCollapseDefs.map(d => String(d.col)));
    const collSettings = JSON.parse(localStorage.getItem('handoverCollapsed') || '{}');
    document.querySelectorAll(".panel-col").forEach(col => {
        if (noCollapseCols.has(col.dataset.col)) return; // already handled above
        const lastCard = col.querySelector(".card:last-child");
        if (!lastCard || (!lastCard.classList.contains("panel-handover") && lastCard.dataset.panelName !== "Handover")) return;

        if (collSettings[targetLayout] !== false) {
            col.classList.add("handover-collapsed");
            mainLayout.style.setProperty(`--h${col.dataset.col}`, '95%');
        } else {
            mainLayout.style.setProperty(`--h${col.dataset.col}`, '65%');
        }
    });

    renderStrips();


    setTimeout(addResizeHandles, 0);


    setTimeout(setupAdaptiveWidths, 0);
};

function setupAdaptiveWidths() {
    const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
            const width = entry.contentRect.width;
            let mode = "full";


            if (width < 220) mode = "compact-1";
            else if (width < 320) mode = "compact-2";
            else if (width < 450) mode = "compact-3";

            if (entry.target.dataset.widthMode !== mode) {
                entry.target.dataset.widthMode = mode;
            }
        }
    });

    document.querySelectorAll(".panel-col").forEach(col => {
        observer.observe(col);
    });
}

function addResizeHandles() {
    document.querySelectorAll(".resize-handle, .resize-handle-v").forEach(h => h.remove());


    [1, 2, 3].forEach(colIndex => {


        if (currentLayoutMode === 'radar') {
            if (colIndex === 1 || colIndex === 2) return;
            if (colIndex === 3) return;
        } else if (currentLayoutMode === 'tower') {
            if (colIndex === 3) return;
        }

        const colDiv = document.querySelector(`.panel-col[data-col="${colIndex}"]`);
        if (!colDiv) return;

        const secondCard = colDiv.querySelector('.card:last-child');
        if (!secondCard) return;

        secondCard.style.position = "relative";

        const handle = document.createElement("div");
        handle.className = "resize-handle d-flex justify-content-center align-items-center";

        const visual = document.createElement("div");
        visual.style.width = "40px";
        visual.style.height = "2px";
        visual.style.background = "var(--sys-border)";
        visual.style.borderRadius = "2px";
        visual.style.transition = "background 0.2s";
        handle.appendChild(visual);

        secondCard.appendChild(handle);

        handle.addEventListener("mousedown", e => {
            e.preventDefault();
            const startY = e.clientY;

            const curHStyle = mainLayout.style.getPropertyValue(`--h${colIndex}`);
            const isRadar = currentLayoutMode === "radar";
            const defaults = isRadar ? [65, 100, 50] : [70, 50, 60];
            const curH = curHStyle ? parseFloat(curHStyle) : defaults[colIndex - 1];

            const totalH = colDiv.clientHeight;

            handle.classList.add("active");
            document.body.style.cursor = 'ns-resize';

            function onMouseMove(moveEvent) {
                const deltaY = moveEvent.clientY - startY;
                const deltaPct = (deltaY / totalH) * 100;
                let newH = curH + deltaPct;

                if (newH < 10) newH = 10;
                if (newH > 90) newH = 90;

                mainLayout.style.setProperty(`--h${colIndex}`, `${newH}%`);
            }

            function onMouseUp() {
                handle.classList.remove("active");
                document.body.style.removeProperty('cursor');
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                saveGridDimensions();
            }

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        handle.addEventListener("dblclick", e => {
            e.preventDefault();
            const isRadar = currentLayoutMode === "radar";
            const defaults = isRadar ? [65, 100, 50] : [70, 50, 60];
            mainLayout.style.setProperty(`--h${colIndex}`, `${defaults[colIndex - 1]}%`);
            saveGridDimensions();
        });
    });


    [2, 3].forEach(colIndex => {
        const colDiv = document.querySelector(`.panel-col[data-col="${colIndex}"]`);
        if (!colDiv) return;

        const handleV = document.createElement("div");
        handleV.className = "resize-handle-v d-flex justify-content-center align-items-center";

        const visualV = document.createElement("div");
        visualV.style.width = "2px";
        visualV.style.height = "40px";
        visualV.style.background = "var(--sys-border)";
        visualV.style.borderRadius = "2px";
        visualV.style.transition = "background 0.2s";
        handleV.appendChild(visualV);

        colDiv.appendChild(handleV);

        handleV.addEventListener("mousedown", e => {
            e.preventDefault();
            const startX = e.clientX;
            const totalWidth = mainLayout.clientWidth;

            const isRadar = currentLayoutMode === "radar";
            const curC1 = parseFloat(mainLayout.style.getPropertyValue('--c1')) || 35;
            const curC2 = parseFloat(mainLayout.style.getPropertyValue('--c2')) || 35;
            const curC3 = parseFloat(mainLayout.style.getPropertyValue('--c3')) || 30;

            handleV.classList.add("active");
            document.body.style.cursor = 'ew-resize';

            function onMouseMove(moveEvent) {
                const deltaX = moveEvent.clientX - startX;
                const deltaPct = (deltaX / totalWidth) * 100;

                let newC1 = curC1, newC2 = curC2, newC3 = curC3;

                if (colIndex === 2) {
                    newC1 = curC1 + deltaPct;
                    newC2 = curC2 - deltaPct;
                    if (newC1 < 10) { newC1 = 10; newC2 = curC1 + curC2 - 10; }
                    if (newC2 < 10) { newC2 = 10; newC1 = curC1 + curC2 - 10; }
                } else if (colIndex === 3) {
                    newC2 = curC2 + deltaPct;
                    newC3 = curC3 - deltaPct;
                    if (newC2 < 10) { newC2 = 10; newC3 = curC2 + curC3 - 10; }
                    if (newC3 < 10) { newC3 = 10; newC2 = curC2 + curC3 - 10; }
                }

                mainLayout.style.setProperty('--c1', `${newC1}fr`);
                mainLayout.style.setProperty('--c2', `${newC2}fr`);
                mainLayout.style.setProperty('--c3', `${newC3}fr`);
            }

            function onMouseUp() {
                handleV.classList.remove("active");
                document.body.style.removeProperty('cursor');
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                saveGridDimensions();
            }

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        handleV.addEventListener("dblclick", e => {
            e.preventDefault();
            const isRadar = currentLayoutMode === "radar";
            const defaults = { c1: 35, c2: 35, c3: 30 };

            const curC1 = parseFloat(mainLayout.style.getPropertyValue('--c1')) || defaults.c1;
            const curC2 = parseFloat(mainLayout.style.getPropertyValue('--c2')) || defaults.c2;
            const curC3 = parseFloat(mainLayout.style.getPropertyValue('--c3')) || defaults.c3;

            if (colIndex === 2) {

                const combined = curC1 + curC2;
                mainLayout.style.setProperty('--c1', `${defaults.c1}fr`);
                mainLayout.style.setProperty('--c2', `${combined - defaults.c1}fr`);
            } else if (colIndex === 3) {


                const total = curC1 + curC2 + curC3;
                mainLayout.style.setProperty('--c2', `${70 - curC1}fr`);
                mainLayout.style.setProperty('--c3', `${total - 70}fr`);
            }
            saveGridDimensions();
        });
    });
}

function saveGridDimensions() {
    const isRadar = currentLayoutMode === "radar";
    const settings = JSON.parse(localStorage.getItem('layoutGridHeights') || '{}');
    if (!settings[currentLayoutMode]) settings[currentLayoutMode] = {};

    settings[currentLayoutMode].h1 = parseFloat(mainLayout.style.getPropertyValue('--h1')) || (isRadar ? 65 : 70);
    settings[currentLayoutMode].h2 = parseFloat(mainLayout.style.getPropertyValue('--h2')) || (isRadar ? 100 : 50);
    settings[currentLayoutMode].h3 = parseFloat(mainLayout.style.getPropertyValue('--h3')) || (isRadar ? 50 : 60);

    settings[currentLayoutMode].c1 = parseFloat(mainLayout.style.getPropertyValue('--c1')) || 35;
    settings[currentLayoutMode].c2 = parseFloat(mainLayout.style.getPropertyValue('--c2')) || 35;
    settings[currentLayoutMode].c3 = parseFloat(mainLayout.style.getPropertyValue('--c3')) || 30;

    localStorage.setItem('layoutGridHeights', JSON.stringify(settings));
}

function initFixedPanels() {
    applyFacilityLayout();
}

document.addEventListener("DOMContentLoaded", function () {
    initFixedPanels();
    waitForControllerModeAndRender();
});

function waitForControllerModeAndRender() {
    const interval = setInterval(() => {
        if (window.controllerMode || !window.isConnected) {
            clearInterval(interval);
            renderStrips();
        }
    }, 100);
}


