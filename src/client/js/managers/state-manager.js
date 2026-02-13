class PanelStateManager {
    constructor() {
        this.panels = [];
        this.observers = [];
        this.saveTimeout = null;
        this.SAVE_DEBOUNCE_MS = 300;
        this.STORAGE_KEY = 'panels';
        this.loaded = false;
    }

    load() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) {
                this.panels = [];
                this.loaded = true;
                return true;
            }

            const parsed = JSON.parse(stored);

            // Validate data
            const validation = validatePanels(parsed);
            if (!validation.valid) {
                console.warn('Invalid panel data in localStorage:', validation.errors);
                this.panels = sanitizePanels(parsed);
                console.log('Sanitized panel data loaded');
            } else {
                this.panels = parsed;
            }

            this.loaded = true;
            return true;
        } catch (error) {
            console.error('Failed to load panels from localStorage:', error);
            this.panels = [];
            this.loaded = true;
            return false;
        }
    }

    save() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.panels));
                this.saveTimeout = null;
            } catch (error) {
                console.error('Failed to save panels to localStorage:', error);
            }
        }, this.SAVE_DEBOUNCE_MS);
    }

    saveImmediate() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.panels));
        } catch (error) {
            console.error('Failed to save panels to localStorage:', error);
        }
    }

    getPanels() {
        if (!this.loaded) this.load();
        return this.panels;
    }

    getPanel(name) {
        if (!this.loaded) this.load();
        return this.panels.find(p => p.name === name) || null;
    }

    addPanel(panel) {
        if (!this.loaded) this.load();

        const validation = validatePanel(panel);
        if (!validation.valid) {
            console.error('Invalid panel data:', validation.errors);
            return false;
        }

        // Check for duplicate name
        if (this.panels.some(p => p.name === panel.name)) {
            console.warn(`Panel with name "${panel.name}" already exists`);
            return false;
        }

        this.panels.push(panel);
        this.save();
        this.notifyObservers('panel-added', panel);
        return true;
    }


    removePanel(name) {
        if (!this.loaded) this.load();

        const index = this.panels.findIndex(p => p.name === name);
        if (index === -1) {
            console.warn(`Panel "${name}" not found`);
            return false;
        }

        const removed = this.panels.splice(index, 1)[0];
        this.save();
        this.notifyObservers('panel-removed', removed);
        return true;
    }

    updatePanel(name, updates) {
        if (!this.loaded) this.load();

        const panel = this.panels.find(p => p.name === name);
        if (!panel) {
            console.warn(`Panel "${name}" not found`);
            return false;
        }

        Object.assign(panel, updates);
        this.save();
        this.notifyObservers('panel-updated', panel);
        return true;
    }

    renamePanel(oldName, newName) {
        if (!this.loaded) this.load();

        const panel = this.panels.find(p => p.name === oldName);
        if (!panel) {
            console.warn(`Panel "${oldName}" not found`);
            return false;
        }

        // Check if new name already exists
        if (this.panels.some(p => p.name === newName && p !== panel)) {
            console.warn(`Panel with name "${newName}" already exists`);
            return false;
        }

        panel.name = newName;
        this.save();
        this.notifyObservers('panel-renamed', { oldName, newName, panel });
        return true;
    }

    addStrip(panelName, strip) {
        if (!this.loaded) this.load();

        const panel = this.panels.find(p => p.name === panelName);
        if (!panel) {
            console.warn(`Panel "${panelName}" not found`);
            return false;
        }

        const validation = validateStrip(strip);
        if (!validation.valid) {
            console.error('Invalid strip data:', validation.errors);
            return false;
        }

        if (!panel.strips) {
            panel.strips = [];
        }

        // Check for duplicate ID
        const existingIndex = panel.strips.findIndex(s => s.id === strip.id);
        if (existingIndex >= 0) {
            // Update existing strip
            panel.strips[existingIndex] = strip;
        } else {
            panel.strips.push(strip);
        }

        this.save();
        this.notifyObservers('strip-added', { panelName, strip });
        return true;
    }

    removeStrip(stripId) {
        if (!this.loaded) this.load();

        let removed = false;
        let removedFrom = null;

        this.panels.forEach(panel => {
            if (panel.strips) {
                const index = panel.strips.findIndex(s => s.id === stripId);
                if (index >= 0) {
                    panel.strips.splice(index, 1);
                    removed = true;
                    removedFrom = panel.name;
                }
            }
        });

        if (removed) {
            this.save();
            this.notifyObservers('strip-removed', { stripId, panelName: removedFrom });
        }

        return removed;
    }

    updateStrip(stripId, updates) {
        if (!this.loaded) this.load();

        for (const panel of this.panels) {
            if (panel.strips) {
                const strip = panel.strips.find(s => s.id === stripId);
                if (strip) {
                    Object.assign(strip, updates);
                    strip.lastUpdate = Date.now();
                    this.save();
                    this.notifyObservers('strip-updated', { stripId, strip, panelName: panel.name });
                    return true;
                }
            }
        }

        console.warn(`Strip "${stripId}" not found`);
        return false;
    }

    moveStrip(stripId, targetPanelName) {
        if (!this.loaded) this.load();

        const targetPanel = this.panels.find(p => p.name === targetPanelName);
        if (!targetPanel) {
            console.warn(`Target panel "${targetPanelName}" not found`);
            return false;
        }

        let strip = null;
        let sourcePanelName = null;

        // Find and remove from source panel
        for (const panel of this.panels) {
            if (panel.strips) {
                const index = panel.strips.findIndex(s => s.id === stripId);
                if (index >= 0) {
                    strip = panel.strips.splice(index, 1)[0];
                    sourcePanelName = panel.name;
                    break;
                }
            }
        }

        if (!strip) {
            console.warn(`Strip "${stripId}" not found`);
            return false;
        }

        // Add to target panel
        if (!targetPanel.strips) {
            targetPanel.strips = [];
        }
        targetPanel.strips.push(strip);

        this.save();
        this.notifyObservers('strip-moved', { stripId, sourcePanelName, targetPanelName, strip });
        return true;
    }

    getStrip(stripId) {
        if (!this.loaded) this.load();

        for (const panel of this.panels) {
            if (panel.strips) {
                const strip = panel.strips.find(s => s.id === stripId);
                if (strip) {
                    return strip;
                }
            }
        }

        return null;
    }

    clearEuroscopeStrips() {
        if (!this.loaded) this.load();

        this.panels.forEach(panel => {
            if (panel.strips) {
                panel.strips = panel.strips.filter(s => s.euroscope !== true);
            }
        });

        this.saveImmediate();
        this.notifyObservers('euroscope-strips-cleared', null);
    }

    subscribe(callback) {
        if (typeof callback === 'function') {
            this.observers.push(callback);
        }
    }

    unsubscribe(callback) {
        const index = this.observers.indexOf(callback);
        if (index >= 0) {
            this.observers.splice(index, 1);
        }
    }

    notifyObservers(event, data) {
        this.observers.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Observer callback error:', error);
            }
        });
    }
}

window.stateManager = new PanelStateManager();
