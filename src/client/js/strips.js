const CUSTOM_STRIP_BOXES = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];

function isPointInBoxes(boxes, pointName) {
    if (!pointName) return false;
    const upper = pointName.toUpperCase();
    for (let i = 18; i <= 22; i++) {
        if (boxes[i] && boxes[i].value.toUpperCase() === upper) return true;
    }
    return false;
}

function getStripTypeFromPanelName(panelName) {
    if (!panelName) return null;
    const name = panelName.toLowerCase();
    if (name.includes("departure")) return "departure";
    if (name.includes("arrival")) return "arrival";
    if (name.includes("overfly")) return "overfly";
    return null;
}

function createStrip(type = "overfly", flightplan = null, fromEuroscope = false, existingId = null) {
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    const now = new Date();
    const pad = n => n.toString().padStart(2, "0");

    const dateStr = `${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())}/${now.getUTCFullYear().toString().slice(-2)}`;
    const timeStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

    const div = document.createElement("div");
    div.className = "strip draggable";
    div.dataset.type = type;
    div.dataset.stripId = existingId || generateUUID();
    div.dataset.euroscope = fromEuroscope ? "true" : "false";

    if (type === "transfer" && flightplan) {
        div.classList.add("transfer-request");
        div.innerHTML = `
            <div class="transfer-info">
                <div class="transfer-label">HANDOFF REQUEST</div>
                <div class="transfer-callsign">${flightplan.callsign}</div>
                <div class="transfer-details">${flightplan.departure} &rarr; ${flightplan.arrival} | ${flightplan.aircraftType || '---'}</div>
            </div>
            <div class="transfer-actions">
                <button class="transfer-btn accept" title="Accept Handoff">
                    <span class="material-icons">check_circle</span>
                    ACCEPT
                </button>
                <button class="transfer-btn refuse" title="Refuse Handoff">
                    <span class="material-icons">cancel</span>
                    REFUSE
                </button>
            </div>
        `;

        const acceptBtn = div.querySelector(".accept");
        const refuseBtn = div.querySelector(".refuse");

        acceptBtn.onclick = async (e) => {
            e.stopPropagation();
            const response = await fetch(`${GATEWAY_URL}/api/accept-handoff`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: getLinkCode(), callsign: flightplan.callsign })
            });
            if (response.ok) {
                deleteStripFromPanels(flightplan.callsign);
                flightplan.transfer = false;
                if (typeof renderAircraft === 'function') renderAircraft(flightplan);
            } else div.remove();
        };

        refuseBtn.onclick = async (e) => {
            e.stopPropagation();
            const response = await fetch(`${GATEWAY_URL}/api/refuse-handoff`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: getLinkCode(), callsign: flightplan.callsign })
            });
            if (response.ok) {
                deleteStripFromPanels(flightplan.callsign);
            } else div.remove();
        };

        enableSortableForAllPanels();
        return div;
    }

    const inputClasses = [
        "c1 al_ot", "c2 le_ot ri_ot bt_ot", "c3 ri_ot bt_ot", "c4 le_ot ri_ot bt_ot",
        "c5 ri_ot bt_ot", "c6 ri_ot tp_ot bt_ot", "c7 ri_ot tp_ot bt_ot", "c8",
        "c9 ri_ot", "c10 bt_ot", "c11 bt_ot bt_ot", "c12 ri_ot bt_ot bt_ot",
        "c13 tp_ot ri_ot", "c14 ri_ot", "c15 bt_ot ri_ot",
        "c16 tp_ot ri_ot", "c17 ri_ot", "c18 bt_ot ri_ot",
        "c19 ri_ot tp_ot bt_ot", "c20 ri_ot tp_ot bt_ot", "c21 ri_ot tp_ot bt_ot",
        "c22 ri_ot tp_ot bt_ot", "c23 ri_ot tp_ot",
        "c24 ri_ot bt_ot", "c25 ri_ot bt_ot", "c26 ri_ot bt_ot", "c27 ri_ot bt_ot",
        "c28 ri_ot", "c29 ri_ot bt_ot", "c30 ri_ot bt_ot", "c31 ri_ot bt_ot", "c32 ri_ot bt_ot"
    ];

    const fragment = document.createDocumentFragment();
    inputClasses.forEach((cls, i) => {
        const input = document.createElement("input");
        input.className = `box ${cls}`;

        input.addEventListener("input", () => {
            input.value = input.value.toUpperCase();
            saveStripValues(div);
        });

        fragment.appendChild(input);

        if ([12, 15, 18, 23, 28].includes(i + 1)) {
            fragment.appendChild(document.createComment("-----------------------"));
        }
    });

    const dtDiv = document.createElement("div");
    dtDiv.className = "box c33 ri_ot bt_ot";
    dtDiv.style.cssText = "display:flex;flex-direction:column;text-align:center;font-size:60%;color:var(--font-main);";
    dtDiv.innerHTML = `<span>${dateStr}</span><span>${timeStr}</span>`;

    fragment.appendChild(dtDiv);
    div.appendChild(fragment);

    setTimeout(() => attachAutoResizeToStripInputs(div), 0);

    if (fromEuroscope) {
        if (!flightplan && existingId) {
            const existingStrip = stateManager.getStrip(existingId);
            if (existingStrip && existingStrip.flightPlan) {
                flightplan = existingStrip.flightPlan;
            }
        }

        if (flightplan && !flightplan.transfer) addStripEditListeners(div, flightplan, type);
        if (flightplan) fillStripFromFlightData(div, flightplan, type);
        OptionsMenu(div, flightplan, fromEuroscope);
    }
    else {
        applyTooltipsToStrip(div, type);
        OptionsMenu(div);
    }

    enableSortableForAllPanels()
    syncRPC();
    return div;
}

//---- STRIP LISTENER #1 ----//
function autoResizeInputFont(input) {
    const minFont = 6;
    const maxFont = 16;
    const testSpan = document.createElement("span");
    testSpan.style.visibility = "hidden";
    testSpan.style.position = "fixed";
    testSpan.style.whiteSpace = "pre";
    testSpan.style.fontWeight = "200";
    testSpan.style.fontFamily = window.getComputedStyle(input).fontFamily;
    document.body.appendChild(testSpan);

    let fontSize = maxFont;
    testSpan.textContent = input.value || input.placeholder || "";
    while (fontSize > minFont) {
        testSpan.style.fontSize = fontSize + "px";
        if (testSpan.offsetWidth <= input.offsetWidth - 8) break;
        fontSize -= 1;
    }
    input.style.fontSize = fontSize + "px";
    document.body.removeChild(testSpan);
}

function observeInputResize(input) {
    if (input._resizeObserver) return;
    input._resizeObserver = new ResizeObserver(() => autoResizeInputFont(input));
    input._resizeObserver.observe(input);
    if (input.parentElement && !input.parentElement._resizeObserver) {
        input.parentElement._resizeObserver = new ResizeObserver(() => autoResizeInputFont(input));
        input.parentElement._resizeObserver.observe(input.parentElement);
    }
}

function attachAutoResizeToStripInputs(strip) {
    strip.querySelectorAll("input.box").forEach(input => {
        input.addEventListener("input", () => autoResizeInputFont(input));
        autoResizeInputFont(input);
        observeInputResize(input);

        input.addEventListener("mousedown", e => {
            e.stopPropagation();
            let stripDiv = input.closest(".strip");
            if (stripDiv) stripDiv.draggable = false;
        });
        input.addEventListener("focus", e => {
            let stripDiv = input.closest(".strip");
            if (stripDiv) stripDiv.draggable = false;
        });
        input.addEventListener("blur", e => {
            let stripDiv = input.closest(".strip");
            if (stripDiv) stripDiv.draggable = true;
        });
    });
}

function enableSortableForAllPanels() {
    document.querySelectorAll(".strip-container").forEach(container => {
        if (!container._sortable) {
            container._sortable = Sortable.create(container, {
                animation: 150,
                ghostClass: "strip-ghost",
                dragClass: "strip-drag",
                group: {
                    name: "strips",
                    pull: true,
                    put: true
                },
                forceFallback: true,

                onSort: function () {
                    const panelElement = container.closest("[data-panel-name]");
                    if (!panelElement) return;

                    const panelName = panelElement.dataset.panelName;
                    const allStripsBefore = [];

                    // Get all strips from state manager
                    stateManager.getPanels().forEach(p => {
                        if (p.strips) allStripsBefore.push(...p.strips);
                    });

                    // Remove strips from other panels
                    Array.from(container.children).forEach(stripEl => {
                        const stripId = stripEl.dataset.stripId;
                        const currentPanel = stateManager.getPanel(panelName);
                        if (!currentPanel) return;

                        // Check if strip is in a different panel and remove it
                        stateManager.getPanels().forEach(panel => {
                            if (panel.name !== panelName && panel.strips) {
                                const stripInPanel = panel.strips.find(s => s.id === stripId);
                                if (stripInPanel) {
                                    stateManager.removeStrip(stripId);
                                }
                            }
                        });
                    });

                    // Build new order and update state
                    const newOrder = Array.from(container.children).map(stripEl => {
                        const stripId = stripEl.dataset.stripId;
                        const existing = allStripsBefore.find(s => s.id === stripId);

                        const targetType = getStripTypeFromPanelName(panelName);
                        if (targetType && stripEl.dataset.type !== targetType) {
                            stripEl.dataset.type = targetType;
                            if (existing && existing.flightPlan) {
                                fillStripFromFlightData(stripEl, existing.flightPlan, targetType);
                            } else {
                                applyTooltipsToStrip(stripEl, targetType);
                            }
                        }

                        const values = {};
                        stripEl.querySelectorAll("input").forEach(input => {
                            const cls = Array.from(input.classList).find(c => c.startsWith("c"));
                            if (cls) values[cls] = input.value;
                        });

                        return {
                            id: stripId,
                            type: stripEl.dataset.type,
                            values: values,
                            euroscope: stripEl.dataset.euroscope === "true",
                            flightPlan: existing ? (existing.flightPlan || null) : null
                        };
                    });

                    // Update state manager with new order
                    const panel = stateManager.getPanel(panelName);
                    if (panel) {
                        stateManager.updatePanel(panelName, { strips: newOrder });
                    }
                    syncRPC();
                }
            });
        }
    });
}

function showGhostMoveMode(strip) {
    const ghost = strip.cloneNode(true);
    ghost.classList.add("strip-ghost-move");
    ghost.style.pointerEvents = "none";
    ghost.style.opacity = "0.7";
    ghost.style.position = "fixed";
    ghost.style.zIndex = 10001;
    ghost.style.left = "-9999px";
    ghost.style.top = "-9999px";
    document.body.appendChild(ghost);

    const panels = Array.from(document.querySelectorAll(".strip-container"));
    panels.forEach(panel => panel.classList.add("panel-move-target"));

    function onMouseMove(e) {
        ghost.style.left = `${e.clientX + 10}px`;
        ghost.style.top = `${e.clientY + 10}px`;
    }
    document.addEventListener("mousemove", onMouseMove);

    function onPanelClick(e) {
        const targetPanelCard = e.target.closest(".card");
        if (!targetPanelCard) return;

        const targetPanelName = targetPanelCard.dataset.panelName;

        const targetStripContainer = targetPanelCard.querySelector(".strip-container");
        if (targetStripContainer) {
            targetStripContainer.appendChild(strip);
            const targetType = getStripTypeFromPanelName(targetPanelName);
            if (targetType && strip.dataset.type !== targetType) {
                strip.dataset.type = targetType;
                // Find flightplan data from state manager
                let flightPlan = null;
                const stripId = strip.dataset.stripId;
                const existingStrip = stateManager.getStrip(stripId);
                if (existingStrip?.flightPlan) {
                    flightPlan = existingStrip.flightPlan;
                }
                if (flightPlan) fillStripFromFlightData(strip, flightPlan, targetType);
                else applyTooltipsToStrip(strip, targetType);
            }
        }

        let movedStripData;
        // stripId already declared above

        // Find and remove strip from current panel
        stateManager.getPanels().forEach(panel => {
            const index = panel.strips?.findIndex(s => s.id === stripId);
            if (index !== undefined && index !== -1) {
                movedStripData = panel.strips[index];
                stateManager.removeStrip(stripId);
            }
        });

        // Add to target panel
        if (movedStripData) {
            stateManager.addStrip(targetPanelName, movedStripData);
        }
        enableSortableForAllPanels();
        syncRPC();
        cleanup();
    }

    function onCancel(e) {
        if (e.type === "keydown" && e.key === "Escape") {
            cleanup();
        } else if (e.type === "mousedown" && !e.target.closest(".strip-container")) {
            cleanup();
        }
    }

    panels.forEach(panel => panel.addEventListener("mousedown", onPanelClick));
    document.addEventListener("keydown", onCancel);
    document.addEventListener("mousedown", onCancel);

    function cleanup() {
        highlightStrip(strip, false);
        ghost.remove();
        panels.forEach(panel => {
            panel.classList.remove("panel-move-target");
            panel.removeEventListener("mousedown", onPanelClick);
        });
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("keydown", onCancel);
        document.removeEventListener("mousedown", onCancel);
    }
}

//---- STRIP MENU ----//
function OptionsMenu(strip, flight, fromEuroscope = false) {
    function createMenuItem(text, icon, onClick) {
        const item = document.createElement("div");
        item.innerHTML = `<span class="material-icons">${icon}</span>${text}`;
        item.classList.add("menu-item");
        item.addEventListener("click", onClick);
        return item;
    }

    strip.addEventListener("contextmenu", e => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll(".strip-context-menu").forEach(m => m.remove());
        const menu = document.createElement("div");
        menu.classList.add("strip-context-menu");
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;

        menu.addEventListener("wheel", e => e.stopPropagation());

        if (fromEuroscope && flight && flight.transfer) {
            const acceptOption = createMenuItem("Accept handoff", "check_circle", async () => {
                const response = await fetch(`${GATEWAY_URL}/api/accept-handoff`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: getLinkCode(), callsign: flight.callsign })
                });
                if (response.ok) {
                    deleteStripFromPanels(flight.callsign);
                    renderAircraft(flight);
                } else strip.remove();
                menu.remove();
            });

            const refuseOption = createMenuItem("Refuse handoff", "cancel", async () => {
                const response = await fetch(`${GATEWAY_URL}/api/refuse-handoff`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: getLinkCode(), callsign: flight.callsign })
                });
                if (response.ok) {
                    deleteStripFromPanels(flight.callsign);
                } else strip.remove();
                menu.remove();
            });

            const deleteOption = createMenuItem("Delete strip", "delete", () => {
                if (!fromEuroscope) {
                    let panels = JSON.parse(localStorage.getItem("panels")) || [];
                    panels.forEach(panel => {
                        if (panel.strips) panel.strips = panel.strips.filter(s => s.id !== strip.dataset.stripId);
                    });
                    localStorage.setItem("panels", JSON.stringify(panels));
                    strip.remove();
                } else {
                    deleteStripFromPanels(flight.callsign);
                }
                menu.remove();
            });

            menu.appendChild(acceptOption);
            menu.appendChild(refuseOption);
            menu.appendChild(deleteOption);
        } else {
            if (fromEuroscope) {


                const routeOption = createMenuItem("Show Route", "route", () => showRouteMenu(menu, flight, strip));
                const transferOption = createMenuItem("Transfer", "compare_arrows", () => showTransferMenu(menu, flight, strip));
                const typeOption = createMenuItem("Change Type", "flight", () => showTypeMenu(menu, strip, flight));
                let procedureOption

                if (strip.dataset.type === "departure" || strip.dataset.type === "arrival") {
                    procedureOption = createMenuItem("Change Procedure", "flight_takeoff", (e) => {
                        e.stopPropagation();
                        const airport = strip.dataset.type === "departure" ? flight.departure : flight.arrival;
                        const acProc = strip.dataset.type === "departure" ? "SID" : "STAR";
                        showProcedureMenu(menu, airport, acProc, strip);
                    });
                }

                const freeOption = createMenuItem("Free", "swap_horiz", async () => {
                    const response = await fetch(`${GATEWAY_URL}/api/end-tracking`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code: getLinkCode(), callsign: flight.callsign })
                    });
                    if (response.ok) {
                        deleteStripFromPanels(flight.callsign);
                    } else strip.remove();
                    menu.remove();
                });
                freeOption.style.cssText = "color: var(--atm-green); background-color: var(--atm-green-hover);";

                menu.appendChild(routeOption);
                if (procedureOption) menu.appendChild(procedureOption);
                menu.appendChild(typeOption);
                menu.appendChild(transferOption);
                menu.appendChild(freeOption);
            }

            /*const moveOption = createMenuItem("Move strip", "open_with", () => {
                highlightStrip(strip, true);
                showGhostMoveMode(strip);
                menu.remove();
            });*/

            const deleteOption = createMenuItem("Delete strip", "delete", () => {
                if (!fromEuroscope) {
                    let panels = JSON.parse(localStorage.getItem("panels")) || [];
                    panels.forEach(panel => {
                        if (panel.strips) panel.strips = panel.strips.filter(s => s.id !== strip.dataset.stripId);
                    });
                    localStorage.setItem("panels", JSON.stringify(panels));
                    strip.remove();
                } else {
                    deleteStripFromPanels(flight.callsign);
                }
                menu.remove();
            });

            //menu.appendChild(moveOption);
            menu.appendChild(deleteOption);
        }

        document.body.appendChild(menu);
        positionMenuSafely(menu, e.clientX, e.clientY);

        setTimeout(() => {
            const handler = ev => {
                if (!menu.contains(ev.target)) {
                    menu.remove();
                    document.removeEventListener("mousedown", handler, true);
                }
            };
            document.addEventListener("mousedown", handler, true);
        });
    });
}

function showRouteMenu(parentMenu, flight, strip) {
    parentMenu.innerHTML = '';

    addBackButton(parentMenu, strip);

    const routeDiv = document.createElement("div");
    routeDiv.className = "route-display";

    const words = flight.route.split(/\s+/);

    words.forEach(word => {
        let span = document.createElement("span");

        if (word.includes("/")) {
            const [point, extra] = word.split("/", 2);
            span.innerHTML = point;
            span.style.color = getColorForAviationPoint(point);

            const extraSpan = document.createElement("span");
            extraSpan.innerHTML = "/" + extra;
            extraSpan.style.color = "#7f8c8d";
            routeDiv.appendChild(span);
            routeDiv.appendChild(extraSpan);
        } else {
            span.innerHTML = word;
            span.style.color = getColorForAviationPoint(word);
            routeDiv.appendChild(span);
        }

        routeDiv.appendChild(document.createTextNode(" "));
    });

    parentMenu.appendChild(routeDiv);

    positionMenuSafely(
        parentMenu,
        parseInt(parentMenu.style.left) || 100,
        parseInt(parentMenu.style.top) || 100
    );
}

function getColorForAviationPoint(word) {
    const w = word.toUpperCase();
    if (w === "DCT") {
        return "#7b848f"; // Muted Steel
    } else if (/^(RWY|RW|R)\d+[LR]?$/i.test(w) || /^\d+[LR]$/i.test(w)) {
        return "#ff3d00"; // Vibrant Red (Runway)
    } else if (/^[A-Z]{3}$/i.test(w)) {
        return "#00e676"; // Emerald Green (VOR)
    } else if (/^[A-Z]{5}$/i.test(w)) {
        return "#2196f3"; // Vibrant Blue (Waypoint)
    } else if (/^[A-Z]+\d+$/i.test(w) && w.length <= 6) {
        return "#ffab00"; // Amber (Airway)
    } else if (/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{3,}$/i.test(w)) {
        return "#a855f7"; // Vibrant Purple (Procedure)
    } else {
        return "#e0e6ed"; // Default System Text
    }
}

async function showTransferMenu(menu, ac, strip) {
    menu.innerHTML = '';
    addBackButton(menu, strip);

    try {
        const res = await fetch(`${GATEWAY_URL}/api/ATC-list?code=${getLinkCode()}`);
        let atcList = await res.json();

        atcList = atcList
            .filter(atc => atc.frequency && atc.frequency !== "N/A")
            .map(atc => ({
                ...atc,
                frequency: !isNaN(atc.frequency) ? parseFloat(atc.frequency).toFixed(3) : atc.frequency,
                expandedCallsign: atc.callsign.split('_').join(' ')
            }));

        const order = ["_CTR", "_APP", "_TWR", "_GND", "_DEL"];
        atcList.sort((a, b) => {
            const aIdx = order.findIndex(suf => a.callsign.endsWith(suf));
            const bIdx = order.findIndex(suf => b.callsign.endsWith(suf));
            return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx) || a.expandedCallsign.localeCompare(b.expandedCallsign);
        });

        const typeOrder = [
            { type: '_CTR', label: 'Center', icon: 'public' },
            { type: '_APP', label: 'Approach', icon: 'flight_land' },
            { type: '_TWR', label: 'Tower', icon: 'flight_takeoff' },
            { type: '_GND', label: 'Ground', icon: 'directions_car' },
            { type: '_DEL', label: 'Delivery', icon: 'call' },
        ];

        typeOrder.forEach(({ type, label, icon }) => {
            const groupList = atcList.filter(atc => atc.callsign.endsWith(type));
            if (!groupList.length) return;

            const sep = document.createElement('div');
            sep.textContent = label;
            sep.classList.add("atc-section");
            menu.appendChild(sep);

            groupList.forEach(atc => {
                const atcBtn = document.createElement("div");
                atcBtn.classList.add("atc-btn");
                atcBtn.innerHTML = `
                    <span class="material-icons atc-icon">${icon}</span>
                    <span class="atc-callsign">${atc.expandedCallsign}</span>
                    <span class="atc-frequency">${atc.frequency}</span>
                `;
                atcBtn.addEventListener("click", async () => {
                    await fetch(`${GATEWAY_URL}/api/ATC-transfer`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code: getLinkCode(), callsign: ac.callsign, targetATC: atc.callsign })
                    });
                    document.querySelector('.strip-context-menu')?.remove();
                });
                menu.appendChild(atcBtn);
            });
        });

        const sep = document.createElement('div');
        sep.textContent = "UNICOM";
        sep.classList.add("atc-section");
        menu.appendChild(sep);

        const unicomBtn = document.createElement("div");
        unicomBtn.classList.add("atc-btn");
        unicomBtn.innerHTML = `
            <span class="material-icons atc-icon">radio</span>
            <span class="atc-callsign">UNICOM</span>
            <span class="atc-frequency">122.800</span>
        `;
        unicomBtn.addEventListener("click", async () => {
            const response = await fetch(`${GATEWAY_URL}/api/end-tracking`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: getLinkCode(), callsign: ac.callsign })
            });
            if (response.ok) {
                deleteStripFromPanels(ac.callsign);
            } else {
                strip.remove();
            }
            menu.remove();
        });
        menu.appendChild(unicomBtn);

    } catch (err) {
        menu.innerHTML = "<div style='padding:10px 18px;color:#b00;'>Failed to load ATC</div>";
    }
}

function showTypeMenu(menu, strip, flight) {
    menu.innerHTML = '';
    const types = [
        { name: "Departure", color: "var(--strip-departure)", value: "departure", icon: "flight_takeoff" },
        { name: "Arrival", color: "var(--strip-arrival)", value: "arrival", icon: "flight_land" },
        { name: "Overfly", color: "var(--strip-overfly)", value: "overfly", icon: "airplanemode_active" }
    ];

    const currentType = strip.style.backgroundColor;

    addBackButton(menu, strip);

    types.forEach(type => {
        const typeBtn = document.createElement("div");
        typeBtn.classList.add("type-option");
        typeBtn.innerHTML = `
            <span class="material-icons">${type.icon}</span>
            <span style="flex:1;font-weight:500;">${type.name}</span>
            ${currentType === type.color ? '<span class="material-icons">check</span>' : ''}
        `;

        if (currentType !== type.color) {
            typeBtn.addEventListener("click", async () => {
                strip.style.backgroundColor = type.color;
                strip.dataset.type = type.value;
                strip.querySelectorAll("input.box").forEach(box => box.value = "");
                if (flight) UpdateStrip(flight, type.value);
                syncRPC();
                document.querySelector('.strip-context-menu')?.remove();
            });
        } else {
            typeBtn.style.pointerEvents = 'none';
        }

        menu.appendChild(typeBtn);
    });
}

function showProcedureMenu(parentMenu, airport, procedureType, strip) {
    parentMenu.innerHTML = '';

    const airportData = jsonData[airport];
    if (!airportData || !airportData[procedureType]) {
        parentMenu.innerHTML = `<div class="menu-error">No ${procedureType} procedures found for ${airport}</div>`;
        return;
    }

    const procedures = airportData[procedureType];

    addBackButton(parentMenu, strip);
    positionMenuSafely(parentMenu, parseInt(parentMenu.style.left) || 100, parseInt(parentMenu.style.top) || 100);

    const runways = Object.keys(procedures).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
    if (runways.length === 0) {
        parentMenu.innerHTML += `<div class="menu-error">No runways available</div>`;
        return;
    }

    runways.forEach(runway => {
        const runwayBtn = document.createElement("div");
        runwayBtn.classList.add("runway-btn");
        runwayBtn.innerHTML = `
            <span>Runway ${runway}</span>
            <span class="procedure-count">${Object.keys(procedures[runway]).length} procedures</span>
        `;
        runwayBtn.addEventListener("click", () => {
            showProceduresForRunway(parentMenu, airport, procedureType, runway, strip);
        });
        parentMenu.appendChild(runwayBtn);
    });
}

function showProceduresForRunway(parentMenu, airport, procedureType, runway, strip) {
    parentMenu.innerHTML = '';

    const procedures = jsonData[airport][procedureType][runway];

    const backBtn = document.createElement("div");
    backBtn.classList.add("menu-back-btn");
    backBtn.innerHTML = `<span class="material-icons">arrow_back</span>Back to Runways`;
    backBtn.addEventListener("click", () => {
        showProcedureMenu(parentMenu, airport, procedureType, strip);
    });
    parentMenu.appendChild(backBtn);

    if (procedureType !== 'STAR') {
        renderProcedureList(parentMenu, airport, procedureType, runway, strip, procedures);
        return;
    }

    const approachTypes = new Set();
    const knownTypes = ['ILS', 'RNAV', 'VORDME', 'LOC'];

    Object.keys(procedures).forEach(name => {
        const upper = name.toUpperCase();
        knownTypes.forEach(type => {
            const regex = new RegExp(`(?:^|x)${type}(?:x|$)`, 'i');
            if (regex.test(upper)) approachTypes.add(type);
        });
    });

    const allApproaches = ['ALL', ...Array.from(approachTypes)];

    const approachContainer = document.createElement('div');
    approachContainer.classList.add('procedures-container');

    allApproaches.forEach(type => {
        const btn = document.createElement('div');
        btn.classList.add('procedure-btn', 'approach-type-btn');
        btn.innerHTML = `
            <div class="procedure-name">${type}</div>
            <div class="transition-count">${type === 'ALL' ? 'All STARs' : `${type} procedures`
            }</div>
        `;
        btn.addEventListener('click', () => {
            showProceduresForApproachType(parentMenu, airport, procedureType, runway, strip, procedures, type);
        });
        approachContainer.appendChild(btn);
    });

    parentMenu.appendChild(approachContainer);
}

function showProceduresForApproachType(parentMenu, airport, procedureType, runway, strip, procedures, selectedType) {
    parentMenu.innerHTML = '';

    const backBtn = document.createElement('div');
    backBtn.classList.add('menu-back-btn');
    backBtn.innerHTML = `<span class="material-icons">arrow_back</span>Back to Approaches`;
    backBtn.addEventListener('click', () => {
        showProceduresForRunway(parentMenu, airport, procedureType, runway, strip);
    });
    parentMenu.appendChild(backBtn);

    const filtered = {};
    Object.entries(procedures).forEach(([name, route]) => {
        const regex = new RegExp(`(?:^|x)${selectedType}(?:x|$)`, 'i');
        if (selectedType === 'ALL' || regex.test(name)) {
            filtered[name] = route;
        }
    });

    renderProcedureList(parentMenu, airport, procedureType, runway, strip, filtered);
}

function renderProcedureList(parentMenu, airport, procedureType, runway, strip, procedures) {
    const searchWrapper = document.createElement('div');
    searchWrapper.classList.add('search-wrapper');

    const searchIcon = document.createElement('span');
    searchIcon.classList.add('material-icons', 'search-icon');
    searchIcon.textContent = 'search';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search...';
    searchInput.classList.add('procedure-search');

    searchWrapper.appendChild(searchIcon);
    searchWrapper.appendChild(searchInput);
    parentMenu.appendChild(searchWrapper);

    const groupedProcedures = {};
    Object.entries(procedures).forEach(([procedureName, route]) => {
        const baseName = procedureName.includes('x') ? procedureName.split('x')[0] : procedureName;
        if (!groupedProcedures[baseName]) groupedProcedures[baseName] = { baseProcedure: null, transitions: [] };
        if (procedureName.includes('x')) groupedProcedures[baseName].transitions.push({ name: procedureName, route });
        else groupedProcedures[baseName].baseProcedure = { name: procedureName, route };
    });

    const procContainer = document.createElement('div');
    procContainer.classList.add('procedures-container');
    parentMenu.appendChild(procContainer);

    function renderProcedures(filterText = '') {
        procContainer.innerHTML = '';

        const sortedEntries = Object.entries(groupedProcedures).sort((a, b) => a[0].localeCompare(b[0]));

        sortedEntries.forEach(([baseName, procedureGroup]) => {
            if (!baseName.toLowerCase().includes(filterText.toLowerCase())) return;

            const hasTransitions = procedureGroup.transitions.length > 0;
            const procBtn = document.createElement('div');
            procBtn.classList.add('procedure-btn');
            if (!hasTransitions && procedureGroup.baseProcedure)
                procBtn.classList.add('base-procedure');

            let html = `<div class="procedure-name">${baseName}</div>`;
            if (hasTransitions)
                html += `<div class="transition-count">+ ${procedureGroup.transitions.length} transition(s)</div>`;
            procBtn.innerHTML = html;

            if (hasTransitions) {
                procBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showTransitionsMenu(parentMenu, airport, procedureType, runway, baseName, procedureGroup, strip);
                });
            } else if (procedureGroup.baseProcedure) {
                procBtn.addEventListener('click', () => {
                    updateStripWithProcedure(strip, procedureType, procedureGroup.baseProcedure.name, runway, procedureGroup.baseProcedure.route);
                    parentMenu.remove();
                });
            }

            procContainer.appendChild(procBtn);
        });
    }

    renderProcedures();
    searchInput.addEventListener('input', (e) => {
        renderProcedures(e.target.value);
    });
}

function showTransitionsMenu(parentMenu, airport, procedureType, runway, baseName, procedureGroup, strip) {
    parentMenu.innerHTML = '';

    const backBtn = document.createElement("div");
    backBtn.classList.add("menu-back-btn");
    backBtn.innerHTML = `<span class="material-icons">arrow_back</span>Back to Procedures`;
    backBtn.addEventListener("click", () => {
        showProceduresForRunway(parentMenu, airport, procedureType, runway, strip);
    });
    parentMenu.appendChild(backBtn);
    positionMenuSafely(parentMenu, parseInt(parentMenu.style.left) || 100, parseInt(parentMenu.style.top) || 100);

    if (procedureGroup.baseProcedure) {
        const baseProcBtn = document.createElement("div");
        baseProcBtn.classList.add("procedure-btn", "base-procedure");
        baseProcBtn.innerHTML = `<div>${procedureGroup.baseProcedure.name} (Default)</div>`;
        baseProcBtn.addEventListener("click", () => {
            updateStripWithProcedure(strip, procedureType, procedureGroup.baseProcedure.name, runway, procedureGroup.baseProcedure.route);
            parentMenu.remove();
        });
        parentMenu.appendChild(baseProcBtn);
    }

    const sortedTransitions = [...procedureGroup.transitions].sort((a, b) => a.name.localeCompare(b.name));

    sortedTransitions.forEach(transition => {
        const transBtn = document.createElement("div");
        transBtn.classList.add("transition-btn");

        // Format name for display: "OSUSU4RxGIKPUxY" -> "via GIKPU Y"
        let displayName = transition.name;
        if (displayName.includes('x')) {
            const parts = displayName.split('x');
            // Take all parts after the first 'x' and join them with spaces
            displayName = `via ${parts.slice(1).join(' ')}`;
        }

        transBtn.innerHTML = `<div>${displayName}</div>`;
        transBtn.addEventListener("click", () => {
            updateStripWithProcedure(strip, procedureType, transition.name, runway, transition.route);
            parentMenu.remove();
        });
        parentMenu.appendChild(transBtn);
    });
}


function updateStripWithProcedure(strip, procedureType, procedureName, procedureRunway, route) {
    const procedureField = strip.querySelector('.procedure');
    if (procedureField) {
        procedureField.textContent = procedureName;
    }

    if (procedureRunway) {
        let runwayInputSelector;

        if (procedureType === "STAR" || procedureType === "SID" && window.controllerMode === "approach") {
            runwayInputSelector = '.c18';
        } else if (procedureType === "SID" && window.controllerMode === "aerodrome") {
            runwayInputSelector = '.c16';
        } else {
            return;
        }

        const runwayInput = strip.querySelector(runwayInputSelector);

        if (runwayInput) {
            const callsign = strip.dataset.stripId.replace("strip-", "");
            const flightData = {
                callsign: callsign || '',
            };

            const isArrival = procedureType.includes('STAR');
            const type = isArrival ? "arrival" : "departure";

            updateRunway(flightData, procedureRunway, runwayInput, type, procedureName);
        }
    }

    // Save strip values to state manager after procedure update
    saveStripValues(strip);
}

// Menu
function addBackButton(parentMenu, strip) {
    const backBtn = document.createElement("div");
    backBtn.classList.add("menu-back-btn");
    backBtn.innerHTML = `<span class="material-icons">arrow_back</span>Back`;
    backBtn.addEventListener("click", () => {
        parentMenu.remove();
        strip.dispatchEvent(new MouseEvent('contextmenu', {
            clientX: parseInt(parentMenu.style.left) || 100,
            clientY: parseInt(parentMenu.style.top) || 100
        }));
    });
    parentMenu.appendChild(backBtn);
}

// Storage
function saveStripValues(stripEl) {
    const panelElement = stripEl.closest("[data-panel-name]");
    if (!panelElement) return;

    const panelNameInput = panelElement.querySelector(".panel-name-input");
    const panelName = panelElement.dataset.panelName || panelNameInput?.value.trim();
    if (!panelName) return;

    const stripId = stripEl.dataset.stripId;
    if (!stripId) return;

    const values = {};
    stripEl.querySelectorAll("input").forEach(input => {
        const cls = Array.from(input.classList).find(c => c.startsWith("c"));
        values[cls] = input.value;
    });

    stateManager.updateStrip(stripId, { values });
}

function deleteStripFromPanels(callsign) {
    if (!callsign) return;

    // Search and remove from DOM - try common ID patterns
    const stripEl = document.querySelector(`.strip[data-strip-id="strip-${callsign}"]`)
        || document.querySelector(`.strip[data-strip-id="${callsign}"]`)
        || document.querySelector(`.strip[data-callsign="${callsign}"]`);

    if (stripEl) {
        if (typeof cleanupStripObservers === 'function') cleanupStripObservers(stripEl);
        stripEl.remove();
    }

    // Remove from state manager by ID or callsign match
    const panels = stateManager.getPanels();
    let changed = false;

    panels.forEach(panel => {
        if (panel.strips) {
            const toRemove = panel.strips.filter(strip => {
                // Check if ID matches common patterns
                if (strip.id === `strip-${callsign}` || strip.id === callsign) return true;
                // Check if flight plan callsign matches
                if (strip.flightPlan && strip.flightPlan.callsign === callsign) return true;
                // Check if callsign is in the "c1" box value
                if (strip.values && strip.values.c1 === callsign) return true;
                return false;
            });

            toRemove.forEach(strip => {
                stateManager.removeStrip(strip.id);
                changed = true;
            });
        }
    });

    if (changed) syncRPC();
}

// Flight Data
async function fillStripFromFlightData(strip, flight, type) {
    const boxes = strip.querySelectorAll("input.box");

    const setValue = (index, value) => {
        if (CUSTOM_STRIP_BOXES.includes(index)) {
            if (!boxes[index].value) {
                boxes[index].value = value || "";
            }
        } else {
            boxes[index].value = value || "";
        }
    };

    setValue(0, flight.callsign);
    setValue(1, flight.aircraftType);
    setValue(2, "N" + flight.groundSpeed);
    setValue(3, flight.departure);
    setValue(4, flight.arrival);
    setValue(5, "A" + flight.squawk);
    setValue(6, formatTime(flight.atd));
    setValue(9, extractRegistration(flight.remarks));
    setValue(10, "STS/" + extractStatus(flight.remarks));
    setValue(12, "F" + formatAltitude(flight.finalAltitude));

    setValue(7, type === "departure" ? flight.sid : type === "arrival" ? flight.star : "");

    if (window.controllerMode === "approach" || window.controllerMode === "center") {
        handleApproachCenterMode(boxes, flight, type);
    } else {
        handleAerodromeMode(boxes, flight, type);
    }

    applyTooltipsToStrip(strip, type);
}

async function UpdateStrip(flight, type = null) {
    if (!flight || !flight.callsign) return;

    const strip = document.querySelector(`.strip[data-strip-id="strip-${flight.callsign}"]`);
    if (!strip) return;

    const stripType = type ? type : strip.dataset.type;

    const customValues = {};
    strip.querySelectorAll("input.box").forEach((input, index) => {
        if (CUSTOM_STRIP_BOXES.includes(index) && input.value.trim() !== "") {
            customValues[index] = input.value;
        }
    });

    await fillStripFromFlightData(strip, flight, stripType);

    Object.entries(customValues).forEach(([index, value]) => {
        const input = strip.querySelectorAll("input.box")[parseInt(index)];
        if (input && input.value === "") {
            input.value = value;
        }
    });

    applyTooltipsToStrip(strip, stripType);

    const panels = stateManager.getPanels();
    panels.forEach(panel => {
        const panelStrip = panel.strips?.find(s => s.id === strip.dataset.stripId);
        if (panelStrip) {
            stateManager.updateStrip(strip.dataset.stripId, {
                type: stripType,
                flightPlan: flight,
                values: getStripInputValues(strip)
            });
        }
    });
}

function getStripInputValues(strip) {
    const values = {};
    strip.querySelectorAll("input.box").forEach(input => {
        const cls = Array.from(input.classList).find(c => c.startsWith("c"));
        if (cls) values[cls] = input.value;
    });
    return values;
}

async function updateRunway(flight, runway, inputElem, type, procedureName) {
    const normalizedRunway = runway.trim().toUpperCase();
    if (!normalizedRunway) return;

    const isArrival = type === "arrival";
    const endpoint = isArrival ? "set-star" : "set-sid";
    const fieldName = isArrival ? "star" : "sid";
    const baseValue = procedureName.split("/")[0];
    const updatedValue = `${baseValue}`;
    const payload = {
        code: getLinkCode(),
        callsign: flight.callsign,
        runway: normalizedRunway,
        [fieldName]: updatedValue
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${GATEWAY_URL}/api/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        inputElem.value = normalizedRunway;

        const procedureInput = inputElem.closest(".strip")?.querySelector(".procedure");
        if (procedureInput) {
            procedureInput.textContent = updatedValue;
        }
    } catch (err) {
        console.error("Failed to update runway:", err);
        showToast(`Failed to update procedure: ${err.message}`, 'error');
    }
}

// Tooltips
let globalTooltipEl = null;
let tooltipTimeout = null;

function ensureTooltip() {
    if (globalTooltipEl) return;
    globalTooltipEl = document.createElement("div");
    globalTooltipEl.className = "custom-tooltip";
    document.body.appendChild(globalTooltipEl);
}

function showTooltip(text, x, y) {
    ensureTooltip();
    globalTooltipEl.textContent = text;
    globalTooltipEl.style.left = (x + 10) + "px";
    globalTooltipEl.style.top = (y + 10) + "px";
    globalTooltipEl.classList.add("visible");
}

function hideTooltip() {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    if (globalTooltipEl) globalTooltipEl.classList.remove("visible");
}

function applyTooltipsToStrip(strip, type) {
    const boxes = strip.querySelectorAll("input.box");
    const mode = window.controllerMode || "tower";
    const isDep = type === "departure";

    // Common/Neutral mappings
    const tooltips = {
        0: "Callsign",
        1: "Aircraft Type",
        2: "Ground Speed",
        3: "Departure Airport",
        4: "Arrival Airport",
        5: "Squawk Code",
        9: "Registration",
        12: "Final Altitude (Flight Level)",
        13: "Cleared Altitude",
    };

    if (mode === "approach" || mode === "center") {
        tooltips[6] = "Departure Time";
        tooltips[7] = "Assigned Procedure";
        tooltips[8] = "Assigned Speed / Mach";
        tooltips[10] = "Direct To Point";
        tooltips[11] = "Confirm Direct To";
        tooltips[15] = "Assigned Heading";
        tooltips[17] = isDep ? "Departure Runway" : "Arrival Runway";
        tooltips[31] = "Estimated Arrival Time";
    } else {
        // Tower Mode
        tooltips[6] = "Departure Time";
        tooltips[7] = isDep ? "Assigned SID" : "Assigned STAR";
        tooltips[10] = "Status / Remarks";
        tooltips[11] = isDep ? "Clearance Flag (Ⓑ = Cleared)" : "Manual Input";
        tooltips[15] = isDep ? "Departure Runway" : "Manual Input";
        tooltips[17] = isDep ? "Manual Input" : "Arrival Runway";
        tooltips[31] = isDep ? "Manual Input" : "Estimated Arrival Time";
    }

    boxes.forEach((box, i) => {
        let text = tooltips[i];
        if (!text) {
            if (i >= 18 && i <= 22) text = isDep ? "SID Point" : "STAR Point";
            else if (i >= 23 && i <= 27) text = "Point ETA";
            else if (i >= 28 && i <= 30) text = "Manual Input";
            else text = "Manual Input / Free Text";
        }

        // Store the tooltip text
        box.setAttribute('data-tooltip', text);

        // Remove native title if it exists
        box.removeAttribute('title');

        // Custom tooltip listeners
        box.addEventListener('mouseenter', e => {
            const tip = box.getAttribute('data-tooltip');
            if (tip) {
                if (tooltipTimeout) clearTimeout(tooltipTimeout);
                tooltipTimeout = setTimeout(() => {
                    showTooltip(tip, e.clientX, e.clientY);
                }, 500); // 2 second delay
            }
        });

        box.addEventListener('mousemove', e => {
            if (globalTooltipEl && globalTooltipEl.classList.contains('visible')) {
                globalTooltipEl.style.left = (e.clientX + 10) + "px";
                globalTooltipEl.style.top = (e.clientY + 10) + "px";
            }
        });

        box.addEventListener('mouseleave', hideTooltip);
    });
}

// Handlers
// Tower
function handleAerodromeMode(boxes, flight, type) {
    const setValue = (index, value) => {
        if (CUSTOM_STRIP_BOXES.includes(index) && boxes[index].value.trim() !== "") return;
        boxes[index].value = value || "";
    };
    const clearedAlt = formatClearedAltitude(flight.clearedAltitude, flight.finalAltitude);
    setValue(13, clearedAlt);

    if (type === "departure") {
        setValue(15, flight.departureRwy);
        if (flight.clearedFlag == 1) setValue(11, "Ⓑ");
        else setValue(11, "");
    } else if (type === "arrival") {
        handleArrivalAerodrome(boxes, flight);
    }
}

async function handleArrivalAerodrome(boxes, flight) {
    const setValue = (index, value) => {
        if (CUSTOM_STRIP_BOXES.includes(index) && boxes[index].value.trim() !== "") return;
        boxes[index].value = value || "";
    };

    setValue(17, flight.arrivalRwy);
    setValue(31, flight.estimatedArrival);

    const result = await getMatchedPointsWithETA(flight, jsonData, "STAR", true);

    result.slice(0, 3).forEach((point, i) => {
        if (point && !isPointInBoxes(boxes, point.name)) {
            setValue(18 + i, point.name);
            setValue(23 + i, point.eta);
        }
    });
}

// Approach / Center
function handleApproachCenterMode(boxes, flight, type) {
    const setValue = (index, value) => {
        if (CUSTOM_STRIP_BOXES.includes(index) && boxes[index].value.trim() !== "") return;
        boxes[index].value = value || "";
    };

    setValue(8, flight.assignedSpeed === 0
        ? (flight.assignedMach === 0 ? "" : flight.assignedMach)
        : flight.assignedSpeed);
    setValue(11, flight.directTo);
    setValue(15, flight.assignedHeading === 0 ? "" : flight.assignedHeading);
    setValue(13, formatClearedAltitude(flight.clearedAltitude, flight.finalAltitude));

    if (window.controllerMode === "approach") {
        if (type === "departure") {
            handleDepartureApproach(boxes, flight);
        } else if (type === "arrival") {
            handleArrivalApproach(boxes, flight);
        }
    } else {
        if (type === "departure") {
            handleDepartureCenter(boxes, flight);
        } else if (type === "arrival") {
            handleArrivalCenter(boxes, flight);
        }
    }
}

async function handleDepartureApproach(boxes, flight) {
    const { departurePoints, departureRwy, finalAltitude, nextCopxPoint } = flight;
    const setValue = (index, value) => {
        if (CUSTOM_STRIP_BOXES.includes(index) && boxes[index].value.trim() !== "") return;
        boxes[index].value = value || "";
    };
    setValue(17, departureRwy);

    const [pointIdx, etaIdx] = finalAltitude > 24000 ? [20, 25] : [21, 26];
    const nextPoint = departurePoints.find(p => p.name === nextCopxPoint);
    if (!isPointInBoxes(boxes, nextCopxPoint)) {
        setValue(pointIdx, nextCopxPoint);
        setValue(etaIdx, nextPoint?.eta);
    }

    const result = await getMatchedPointsWithETA(flight, jsonData, "SID");
    result?.slice(0, 2).forEach((point, i) => {
        if (!point || isPointInBoxes(boxes, point.name)) return;
        setValue(18 + i, point.name);
        setValue(23 + i, point.eta);
    });
}

async function handleArrivalApproach(boxes, flight) {
    const { arrivalPoints = [] } = flight;

    const setValue = (index, value) => {
        if (CUSTOM_STRIP_BOXES.includes(index) && boxes[index].value.trim() !== "") return;
        boxes[index].value = value || "";
    };

    function getFirstFix(flight, procedures, isArrival = true) {
        const { SID, STAR } = findProcedure(flight, procedures);
        const proc = isArrival ? STAR : SID;
        return Array.isArray(proc?.fixes) && proc.fixes.length ? proc.fixes[0] : null;
    }

    setValue(17, flight.arrivalRwy);
    setValue(31, flight.estimatedArrival);
    if (!isPointInBoxes(boxes, flight.nextCopxPoint)) {
        setValue(20, flight.nextCopxPoint);
        setValue(25, arrivalPoints.find(point => point.name === flight.nextCopxPoint)?.eta);
    }

    const entryPointName = getFirstFix(flight, jsonData, true);
    if (entryPointName && !isPointInBoxes(boxes, entryPointName)) {
        const point = await fetchPointETA(flight.callsign, { name: entryPointName });
        setValue(18, point.name);
        setValue(23, point.eta);

        const stripId = `strip-${flight.callsign}`;
        const strip = document.querySelector(`.strip[data-strip-id="${stripId}"]`);
        if (strip) {
            const etaInput = strip.querySelector('.box.c17');
            if (etaInput) autoResizeInputFont(etaInput);
        }
    }

    const result = await getMatchedPointsWithETA(flight, jsonData, "STAR");
    if (result && result.length > 1 && !isPointInBoxes(boxes, result[1].name)) {
        setValue(19, result[1].name);
        setValue(24, result[1].eta);
    }
}

async function handleDepartureCenter(boxes, flight) {
    const setValue = (index, value) => {
        if (CUSTOM_STRIP_BOXES.includes(index) && boxes[index].value.trim() !== "") return;
        boxes[index].value = value || "";
    };

    setValue(17, flight.departureRwy)
    const result = getProcedurePoint(jsonData, "SID", flight.departure, flight.departureRwy.toString(), flight.sid);

    if (result && result.length > 0 && !isPointInBoxes(boxes, result[0])) {
        const pointName = result[0];
        setValue(21, pointName);

        const pointInfo = await fetchPointETA(flight.callsign, { name: pointName });
        setValue(26, pointInfo.eta || "");
    }
}

async function handleArrivalCenter(boxes, flight) {
    const setValue = (index, value) => {
        if (CUSTOM_STRIP_BOXES.includes(index) && boxes[index].value.trim() !== "") return;
        boxes[index].value = value || "";
    };

    setValue(17, flight.arrivalRwy)
    const result = getProcedurePoint(jsonData, "STAR", flight.arrival, flight.arrivalRwy.toString(), flight.star);

    if (result && result.length > 0 && !isPointInBoxes(boxes, result[0])) {
        const pointName = result[0];
        setValue(21, pointName);

        const pointInfo = await fetchPointETA(flight.callsign, { name: pointName });
        setValue(26, pointInfo.eta || "");
    }
}

// Listeners
function addStripEditListeners(strip, flight, type) {
    if (!strip || !flight || !type) return

    // --- GLOBAL ---
    //SQUAWK
    function initSquawkField(strip, flight) {
        const c6Input = strip.querySelector(".c6");
        if (!c6Input) return;

        const boxes = strip.querySelectorAll("input.box");
        const formatSquawk = v => (v = v.replace(/[^0-7]/g, "").slice(0, 4)) ? v.padEnd(4, "0") : "2000";

        const updateSquawk = async (value) => {
            try {
                await fetch(`${GATEWAY_URL}/api/set-squawk`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: getLinkCode(), callsign: flight.callsign, squawk: value || "2000" })
                });
            } catch (err) { console.error("Failed to update Squawk:", err); }
        };

        const formatAndSubmit = () => {
            const rawValue = c6Input.value.trim();
            if (!rawValue) return;

            const formatted = formatSquawk(rawValue);

            c6Input.value = formatted;
            if (boxes[5]) boxes[5].value = formatted;
            updateSquawk(formatted);
        };

        c6Input.addEventListener("input", e => e.target.value = e.target.value.replace(/[^0-7]/g, "").slice(0, 4));
        c6Input.addEventListener("keydown", e => e.key === "Enter" && (e.preventDefault(), formatAndSubmit()));
        c6Input.addEventListener("blur", formatAndSubmit);
    }

    //FINAL ALTITUDE
    function initFAltitudeField(strip, flight) {
        const c13Input = strip.querySelector(".c13");
        if (!c13Input) return;

        const boxes = strip.querySelectorAll("input.box");

        const updateFinalAltitude = async (value) => {
            const actualAltitude = parseInt(value, 10) * 100;
            try {
                await fetch(`${GATEWAY_URL}/api/set-final-alt`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        code: getLinkCode(),
                        callsign: flight.callsign,
                        finalAltitude: String(actualAltitude)
                    })
                });
            } catch (err) {
                console.error("Failed to update Final Altitude:", err);
            }
        };

        const formatFinalAltitude = (value) => {
            let clean = value.replace(/[^0-9]/g, '').slice(0, 3);
            if (clean.length > 0 && clean.length < 3) {
                clean = clean.padEnd(3, '0');
            }
            if (!clean) clean = "000";

            let intVal = parseInt(clean, 10);
            if (intVal === 0) intVal = 1;
            if (intVal > 590) intVal = 590;

            const strVal = String(intVal).padStart(3, '0');
            return { str: strVal, int: intVal };
        };

        const formatAndSubmit = () => {
            const raw = c13Input.value.trim();

            if (!raw) {
                if (c13Input.value === "001") return;

                c13Input.value = "001";
                if (boxes[12]) boxes[12].value = "001";
                updateFinalAltitude(1);
                return;
            }

            const { str, int } = formatFinalAltitude(raw);
            if (c13Input.value === str) c13Input.value = int;

            c13Input.value = str;
            if (boxes[12]) boxes[12].value = str;
            updateFinalAltitude(int);
        };

        c13Input.addEventListener("input", e => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
        });

        c13Input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                formatAndSubmit();
            }
        });

        c13Input.addEventListener("blur", formatAndSubmit);
    }

    //CLEARED ALTITUDE
    function initCAltitudeField(strip, flight) {
        const c14Input = strip.querySelector(".c14");
        if (!c14Input) return;

        const boxes = strip.querySelectorAll("input.box");

        const updateClearedAltitude = async (value, isCode = false) => {
            let actualAltitude;

            if (isCode) {
                if (value === "CA") actualAltitude = 1;
                else if (value === "VA") actualAltitude = 2;
                else actualAltitude = 0;
            } else {
                actualAltitude = parseInt(value, 10) * 100;
            }

            try {
                await fetch(`${GATEWAY_URL}/api/set-cleared-alt`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        code: getLinkCode(),
                        callsign: flight.callsign,
                        clearedAltitude: String(actualAltitude)
                    })
                });
            } catch (err) {
                console.error("Failed to update Cleared Altitude:", err);
            }
        };

        const formatClearedAltitude = (value) => {
            const lettersOnly = value.replace(/[^A-Z]/gi, "").toUpperCase();
            const digitsOnly = value.replace(/[^0-9]/g, "");

            // Handle code inputs
            if (lettersOnly === "CA" || lettersOnly === "VA") {
                return { str: lettersOnly, int: lettersOnly, isCode: true };
            }

            // Numeric case
            let clean = digitsOnly.slice(0, 3);
            if (clean.length > 0 && clean.length < 3) {
                clean = clean.padEnd(3, "0");
            }
            if (!clean) clean = "";

            let intVal = parseInt(clean, 10);
            if (intVal > 590) intVal = 590;
            const strVal = String(intVal).padStart(3, "0");

            return { str: strVal, int: intVal, isCode: false };
        };

        const formatAndSubmit = () => {
            const raw = c14Input.value.trim().toUpperCase();

            if (!raw) {
                if (c14Input.value === "000") return;

                c14Input.value = "000";
                if (boxes[13]) boxes[13].value = "";
                updateClearedAltitude("000");
                return;
            }

            const { str, int, isCode } = formatClearedAltitude(raw);
            if (c14Input.value === str) c14Input.value = int;

            c14Input.value = str;
            if (boxes[13]) boxes[13].value = str;
            updateClearedAltitude(str, isCode);
        };

        c14Input.addEventListener("input", (e) => {
            let raw = e.target.value.toUpperCase();
            raw = raw.replace(/[^0-9CAV]/g, "");
            const letters = raw.replace(/[^A-Z]/g, "");

            if (letters.length > 0) {
                if (!/^C?A?$|^VA?$/.test(letters)) {
                    raw = raw.replace(/[A-Z]/g, "");
                } else if (letters.length > 2) {
                    raw = letters.slice(0, 2);
                }
            } else {
                raw = raw.replace(/[^0-9]/g, "").slice(0, 3);
            }

            e.target.value = raw;
        });

        c14Input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                formatAndSubmit();
            }
        });

        c14Input.addEventListener("blur", formatAndSubmit);
    }

    //DEPARTURE TIME
    function initDepTimeField(strip, flight) {
        const c7Input = strip.querySelector(".c7");
        if (!c7Input) return;

        const boxes = strip.querySelectorAll("input.box");
        const formatDepTime = (value) => {
            let clean = value.replace(/[^0-9]/g, "").slice(0, 4);
            if (clean.length > 0 && clean.length < 4) {
                clean = clean.padEnd(4, "0");
            }

            if (clean.length === 4) {
                let hours = parseInt(clean.slice(0, 2), 10);
                let minutes = parseInt(clean.slice(2, 4), 10);

                if (hours > 23) hours = 23;
                if (minutes > 59) minutes = 59;

                clean = hours.toString().padStart(2, "0") + minutes.toString().padStart(2, "0");
            }

            return clean || "0000";
        };

        const updateDepTime = async (value) => {
            try {
                await fetch(`${GATEWAY_URL}/api/set-departureTime`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        code: getLinkCode(),
                        callsign: flight.callsign,
                        Dtime: value || "0000"
                    })
                });
            } catch (err) {
                console.error("Failed to update Departure Time:", err);
            }
        };

        const formatAndSubmit = () => {
            const rawValue = c7Input.value.trim();
            if (!rawValue) {
                c7Input.value = "0000";
                if (boxes[6]) boxes[6].value = "0000";
                updateDepTime("0000");
                return;
            }

            const formatted = formatDepTime(rawValue);

            c7Input.value = formatted;
            if (boxes[6]) boxes[6].value = formatted;
            updateDepTime(formatted);
        };

        c7Input.addEventListener("input", e => e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4));
        c7Input.addEventListener("keydown", e => e.key === "Enter" && (e.preventDefault(), formatAndSubmit()));
        c7Input.addEventListener("blur", formatAndSubmit);
    }

    function initNotificationPoints(strip, flight) {
        const inputsMap = {
            c19: ".c19",
            c20: ".c20",
            c21: ".c21",
            c22: ".c22"
        };

        const etaMap = {
            c19: ".c24",
            c20: ".c25",
            c21: ".c26",
            c22: ".c27"
        };

        const lastValues = {
            c19: "",
            c20: "",
            c21: "",
            c22: ""
        };

        const updateNotificationPoint = async (value, pointType) => {
            const etaElement = strip.querySelector(etaMap[pointType]);

            if (!value) {
                lastValues[pointType] = "";
                if (etaElement) {
                    etaElement.value = "";
                    etaElement.textContent = ""; // Just in case of fallback
                }
                return;
            }

            try {
                const pointInfo = await fetchPointETA(flight.callsign, { name: value });

                if (etaElement) {
                    etaElement.value = pointInfo.eta || "N/A";
                    // Also trigger autoResize if applicable
                    if (typeof autoResizeInputFont === 'function') autoResizeInputFont(etaElement);
                }

                lastValues[pointType] = value;
                saveStripValues(strip);
            } catch (err) {
                console.error(`Failed to update ${pointType}:`, err);
            }
        };

        const formatAndSubmit = (inputElement, pointType) => {
            let raw = (inputElement.value || "").trim().toUpperCase().replace(/[^A-Z0-9]/gi, "");
            if (!raw || raw === "0") raw = "";

            if (lastValues[pointType] === raw) return;

            inputElement.value = raw;
            updateNotificationPoint(raw, pointType);
        };

        const setupInput = (inputElement, pointType) => {
            if (!inputElement) return;

            inputElement.addEventListener("input", e => {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/gi, "");
            });

            inputElement.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    formatAndSubmit(inputElement, pointType);
                }
            });

            inputElement.addEventListener("blur", () => {
                formatAndSubmit(inputElement, pointType);
            });
        };

        for (const pointType of Object.keys(inputsMap)) {
            const inputElement = strip.querySelector(inputsMap[pointType]);
            setupInput(inputElement, pointType);
        }

        saveStripValues(strip);
    }

    if (window.controllerMode === "approach" || window.controllerMode === "center") {
        //SPEED/MACH
        function initSpeedField(strip, flight) {
            const c9Input = strip.querySelector(".c9");
            if (!c9Input) return;

            // Force text input for proper formatting
            if (c9Input.type === "number") {
                c9Input.type = "text";
                c9Input.setAttribute("inputmode", "decimal");
                c9Input.autocomplete = "off";
            }

            const updateSpeed = async (intVal) => {
                try {
                    await fetch(`${GATEWAY_URL}/api/set-assigned-speed`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code: getLinkCode(),
                            callsign: flight.callsign,
                            assignedSpeed: intVal ? parseInt(intVal, 10).toString() : "0"
                        })
                    });
                } catch (err) {
                    console.error("Failed to update speed:", err);
                }
            };

            const updateMach = async (floatVal) => {
                try {
                    await fetch(`${GATEWAY_URL}/api/set-assigned-mach`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code: getLinkCode(),
                            callsign: flight.callsign,
                            assignedMach: floatVal ? parseFloat(floatVal).toString() : "0"
                        })
                    });
                } catch (err) {
                    console.error("Failed to update mach:", err);
                }
            };

            const formatSpeedMach = (raw) => {
                let val = raw.trim();

                if (!val || /^0+$/.test(val)) {
                    return { display: "", type: "empty", send: 0 };
                }

                // Mach detection
                if (val.includes(".")) {
                    if (val.startsWith(".")) val = "0" + val;
                    let floatVal = parseFloat(val);
                    if (isNaN(floatVal)) {
                        return { display: "", type: "empty", send: 0 };
                    }

                    // Clamp to range
                    if (floatVal < 0.5) floatVal = 0.5;
                    if (floatVal > 4.99) floatVal = 4.99;

                    const display = floatVal.toFixed(2);
                    return { display, type: "mach", send: floatVal };
                }

                // Speed
                let intVal = parseInt(val.replace(/[^0-9]/g, ""), 10);
                if (isNaN(intVal) || intVal <= 0) {
                    return { display: "", type: "empty", send: 0 };
                }
                if (intVal > 999) intVal = 999;

                const display = String(intVal).padStart(3, "0");
                return { display, type: "speed", send: intVal };
            };

            const formatAndSubmit = () => {
                const { display, type, send } = formatSpeedMach(c9Input.value);

                c9Input.value = display;

                if (type === "empty") {
                    updateSpeed(0);
                    updateMach(0);
                } else if (type === "speed") {
                    updateSpeed(send);
                } else if (type === "mach") {
                    updateMach(send);
                }
            };

            c9Input.addEventListener("input", e => {
                e.target.value = e.target.value.replace(/[^0-9.]/g, "");
            });

            c9Input.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    formatAndSubmit();
                }
            });

            c9Input.addEventListener("blur", formatAndSubmit);
        }

        function initDirectToField(strip, flight) {
            const c12Input = strip.querySelector(".c12");
            if (!c12Input) return;

            c12Input._lastDirectValue = "";

            const updateDirectTo = async (value) => {
                try {
                    await fetch(`${GATEWAY_URL}/api/set-direct-point`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code: getLinkCode(),
                            callsign: flight.callsign,
                            pointName: value || ""
                        })
                    });
                    c12Input._lastDirectValue = value || "";
                } catch (err) {
                    console.error("Failed to update Direct To:", err);
                }
            };

            const updateHeading = async (intValue) => {
                try {
                    await fetch(`${GATEWAY_URL}/api/set-assigned-heading`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code: getLinkCode(),
                            callsign: flight.callsign,
                            assignedHeading: intValue ? parseInt(intValue, 10).toString() : "0"
                        })
                    });
                } catch (err) {
                    console.error("Failed to update heading:", err);
                }
            };

            const formatAndSubmit = () => {
                let raw = (c12Input.value || "").trim().toUpperCase();
                raw = raw.replace(/[^A-Z0-9]/gi, "");

                if (!raw || raw === "0") {
                    if (c12Input._lastDirectValue === "" && raw !== "0") {
                        c12Input.value = "";
                        return;
                    }

                    c12Input.value = "";
                    c12Input._lastDirectValue = "";
                    updateDirectTo("");
                    updateHeading(0);
                    return;
                }

                if (c12Input._lastDirectValue === raw) return;

                const c16Input = strip.querySelector(".c16");
                if (c16Input && c16Input.value !== "") {
                    c16Input.value = "";
                    if (c16Input._lastHeadingDisplay !== undefined) {
                        c16Input._lastHeadingDisplay = "";
                    }
                }

                c12Input.value = raw;
                c12Input._lastDirectValue = raw;
                updateDirectTo(raw);
            };

            c12Input.addEventListener("input", e => {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/gi, "");
            });

            c12Input.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    formatAndSubmit();
                }
            });

            c12Input.addEventListener("blur", formatAndSubmit);
        }

        // HEADING
        function initHeadingField(strip, flight) {
            const c16Input = strip.querySelector(".c16");
            if (!c16Input) return;

            c16Input._lastHeadingDisplay = "";

            if (c16Input.type === "number") {
                c16Input.type = "text";
                c16Input.setAttribute("inputmode", "numeric");
                c16Input.setAttribute("pattern", "[0-9]*");
                c16Input.autocomplete = "off";
            }

            const updateHeading = async (intValue) => {
                try {
                    await fetch(`${GATEWAY_URL}/api/set-assigned-heading`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code: getLinkCode(),
                            callsign: flight.callsign,
                            assignedHeading: intValue ? parseInt(intValue, 10).toString() : "0",
                        }),
                    });
                } catch (err) {
                    console.error("Failed to update heading:", err);
                }
            };

            const formatHeading = (raw) => {
                let clean = (raw || "").replace(/[^0-9]/g, "").slice(0, 3);

                if (!clean || /^0+$/.test(clean)) {
                    return { display: "", send: 0 };
                }

                let intVal = parseInt(clean, 10);
                if (intVal < 1) intVal = 1;
                if (intVal > 360) intVal = 360;

                const display = String(intVal).padStart(3, "0");
                return { display, send: intVal };
            };

            const formatAndSubmit = () => {
                const { display, send } = formatHeading(c16Input.value);

                if (
                    display !== "" &&
                    c16Input.value === display &&
                    c16Input._lastHeadingDisplay === display
                ) {
                    return;
                }

                c16Input.value = display;
                c16Input._lastHeadingDisplay = display;

                const c12Input = strip.querySelector(".c12");
                if (c12Input && c12Input.value !== "") {
                    c12Input.value = "";
                    if (c12Input._lastDirectValue !== undefined) {
                        c12Input._lastDirectValue = "";
                    }
                }

                updateHeading(display === "" ? 0 : send);
            };

            c16Input.addEventListener("input", (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
            });

            c16Input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    formatAndSubmit();
                }
            });

            c16Input.addEventListener("blur", formatAndSubmit);

            c16Input.addEventListener("focus", () => {
                if (c16Input.value && /^\d{1,3}$/.test(c16Input.value)) {
                    const { display } = formatHeading(c16Input.value);
                    c16Input.value = display;
                } else if (c16Input._lastHeadingDisplay) {
                    c16Input.value = c16Input._lastHeadingDisplay;
                }
            });
        }

        initSpeedField(strip, flight);
        initDirectToField(strip, flight);
        initHeadingField(strip, flight);
        initNotificationPoints(strip, flight);
    }

    initSquawkField(strip, flight);
    initFAltitudeField(strip, flight);
    initCAltitudeField(strip, flight);
    initDepTimeField(strip, flight);

    if (window.controllerMode === "aerodrome" && type === "arrival") {
        initNotificationPoints(strip, flight);
    }
}

//---- FUNCTIONS ----//
async function fetchPointETA(flightCallsign, point) {
    if (point.eta) return point;

    try {
        const response = await fetch(
            `${GATEWAY_URL}/api/point-time?code=${getLinkCode()}&callsign=${encodeURIComponent(flightCallsign)}&points=${encodeURIComponent(point.name)}`,
            { method: "GET", headers: { "Content-Type": "application/json" } }
        );

        if (response.ok) {
            const pointData = await response.json();
            const pointInfo = pointData.find(p => p.name === point.name);
            if (pointInfo) point.eta = pointInfo.eta || "N/A";
        } else {
            point.eta = "N/A";
        }
    } catch (err) {
        console.error(`Failed to fetch ETA for ${point.name}:`, err);
        point.eta = "N/A";
    }

    return point;
}

function getProcedurePoint(procedures, procedureType, airport, runway, procedureName) {
    if (!procedures[airport] || !procedures[airport][procedureType] || !procedures[airport][procedureType][runway]) {
        console.log("Runway or procedure type not found");
        return [];
    }

    var procData = procedures[airport][procedureType][runway];
    var keys = Object.keys(procData);
    var procKey = keys.find(k => k.toLowerCase() === procedureName.toLowerCase());
    if (!procKey) {
        console.log(procedureType + " procedure not found.");
        return [];
    }

    var pointsArray = procData[procKey];
    var nameParts = procedureName.split(/x|4R|4L|4C|4/).filter(p => p.length > 0);

    if (nameParts.length === 0) return [];

    var firstPart = nameParts[nameParts.length - 1].replace(/^x+/i, '');
    if (procedureType.toUpperCase() === "STAR") {
        firstPart = nameParts[0].replace(/^x+/i, '');
    }

    for (var i = 0; i < pointsArray.length; i++) {
        if (pointsArray[i].toUpperCase() === firstPart.toUpperCase()) {
            return [pointsArray[i]];
        }
    }

    return [];
}

async function getMatchedPointsWithETA(flight, procedures, type = "SID", isTower = false) {
    if (!flight || !procedures) return [];

    const { SID, STAR } = findProcedure(flight, procedures);
    const proc = type.toUpperCase() === "SID" ? SID : STAR;
    const flightPoints = type.toUpperCase() === "SID" ? flight.departurePoints : flight.arrivalPoints;

    if (!proc || !Array.isArray(proc.fixes) || !Array.isArray(flightPoints)) return [];

    const flightMap = new Map(flightPoints.map(p => [p.name.toUpperCase(), p]));

    if (type.toUpperCase() === "STAR" && isTower) {
        let lastIndex = -1;
        proc.fixes.forEach((fix, i) => {
            if (flightMap.has(fix.toUpperCase())) lastIndex = i;
        });

        if (lastIndex > 0 && !flightMap.has(proc.fixes[lastIndex].toUpperCase())) {
            lastIndex -= 1;
        }

        if (lastIndex === -1) return [];

        const fixesToReturn = proc.fixes.slice(lastIndex, lastIndex + 3);
        const fixesWithETA = [];

        for (const fix of fixesToReturn) {
            const existing = flightMap.get(fix.toUpperCase()) || { name: fix };
            fixesWithETA.push(await fetchPointETA(flight.callsign, existing));
        }

        return fixesWithETA;
    }

    const uniqueFixes = [];
    const seen = new Set();
    for (const fix of proc.fixes) {
        const upper = fix.toUpperCase();
        if (!seen.has(upper)) {
            uniqueFixes.push(fix);
            seen.add(upper);
        }
    }

    return uniqueFixes
        .map(name => flightMap.get(name.toUpperCase()))
        .filter(Boolean);
}

function findProcedure(flight, procedures) {
    const { departure, arrival, route, sid, star, departureRwy, arrivalRwy } = flight;
    const tokens = route?.trim()?.split(/\s+/) || [];
    if (!tokens.length) return null;

    const find = (airport, type, procedureName, runway) => {
        const typeObj = getTypeObject(getAirport(procedures, airport), type);
        if (!typeObj) return null;

        const runwaysToCheck = runway && typeObj[runway] ? [runway] : Object.keys(typeObj || {});

        for (const rw of runwaysToCheck) {
            const procs = typeObj[rw];
            for (const [name, fixes] of Object.entries(procs)) {
                const normalize = s => s.toUpperCase();
                const upper = normalize(name);
                const wordNorm = normalize(procedureName);

                if (upper === wordNorm || upper.startsWith(wordNorm) || wordNorm.startsWith(upper)) {
                    return { name, runway: rw, fixes };
                }
            }
        }
        return null;
    };

    return {
        SID: find(departure, "SID", sid, departureRwy),
        STAR: find(arrival, "STAR", star, arrivalRwy)
    };
}

function highlightStrip(strip, highlight = true) {
    if (highlight) {
        strip.classList.add("highlight-move");
    } else {
        strip.classList.remove("highlight-move");
    }
}

function getStripInputValues(stripEl) {
    const values = {};
    stripEl.querySelectorAll("input").forEach(input => {
        const cls = Array.from(input.classList).find(c => c.startsWith("c"));
        values[cls] = input.value;
    });
    return values;
}

function getAirport(procedures, code) {
    if (!procedures || !code) return null;
    return procedures[code] ||
        procedures[code.toUpperCase()] ||
        procedures[code.toLowerCase()] || null;
}

function getTypeObject(airportObj, type) {
    if (!airportObj || !type) return null;
    const key = Object.keys(airportObj).find(k => k.toLowerCase() === type.toLowerCase());
    return key ? airportObj[key] : null;
}

function matchName(obj, target) {
    if (!obj || !target) return null;
    const t = target.toLowerCase();
    for (const [key, val] of Object.entries(obj)) {
        const k = key.toLowerCase();
        if (k === t || k.includes(t) || t.includes(k)) return val;
    }
    return null;
}

const hasTransition = (sid) => {
    return sid && sid.match(/[xX]/);
};

function formatTime(time) {
    if (time == null) return "";
    return String(time).padStart(4, "0");
}

function formatAltitude(alt) {
    let n = parseInt(alt, 10);
    if (isNaN(n)) return "";
    n = Math.round(n / 100);
    return n.toString().padStart(3, "0");
}

function formatClearedAltitude(clearedAlt, finalAlt) {
    if (clearedAlt == 0) return "";
    if (parseInt(clearedAlt, 10) === parseInt(finalAlt, 10)) return "";
    if (clearedAlt == 1) return "CA";
    if (clearedAlt == 2) return "VA";
    return formatAltitude(clearedAlt) || "";
}

function extractRegistration(remarks) {
    if (!remarks) return "";
    const match = remarks.match(/REG\/([A-Z0-9]+)/i);
    return match ? match[1] : "";
}

function extractStatus(remarks) {
    if (!remarks) return "";
    const match = remarks.match(/STATUS\/([A-Z]+)/i);
    const match2 = remarks.match(/STS\/([A-Z]+)/i);
    return match ? match[1] : match2 ? match2[1] : "";
}

async function syncRPC() {
    const panels = document.querySelectorAll(".card[data-panel-name]");
    let dep = 0, arr = 0, ovr = 0;

    panels.forEach(panel => {
        const name = panel.dataset.panelName.toLowerCase();
        const count = panel.querySelectorAll(".strip").length;

        if (name.includes("departure")) dep += count;
        else if (name.includes("arrival")) arr += count;
        else if (name.includes("overfly") || name.includes("unassigned")) ovr += count;
    });

    const state = `${dep} Dep / ${arr} Arr / ${ovr} Ovr`;
    const code = getLinkCode();
    if (!code) return;

    try {
        await fetch(`${GATEWAY_URL}/api/rpc-update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, state })
        });
    } catch (e) {
        console.error("[RPC] Failed to sync with server:", e);
    }
}