const PanelSchema = {
    name: 'string',
    strips: 'array'
};

const StripSchema = {
    id: 'string',
    type: 'string',
    values: 'object',
    euroscope: 'boolean',
    flightPlan: 'object|null',
    lastUpdate: 'number'
};

function validatePanel(panel) {
    const errors = [];

    if (!panel || typeof panel !== 'object') {
        return { valid: false, errors: ['Panel must be an object'] };
    }

    if (typeof panel.name !== 'string' || panel.name.trim() === '') {
        errors.push('Panel name must be a non-empty string');
    }

    if (!Array.isArray(panel.strips)) {
        errors.push('Panel strips must be an array');
    } else {
        panel.strips.forEach((strip, index) => {
            const stripValidation = validateStrip(strip);
            if (!stripValidation.valid) {
                errors.push(`Strip at index ${index}: ${stripValidation.errors.join(', ')}`);
            }
        });
    }

    return { valid: errors.length === 0, errors };
}

function validateStrip(strip) {
    const errors = [];

    if (!strip || typeof strip !== 'object') {
        return { valid: false, errors: ['Strip must be an object'] };
    }

    if (typeof strip.id !== 'string' || strip.id.trim() === '') {
        errors.push('Strip id must be a non-empty string');
    }

    const validTypes = ['departure', 'arrival', 'overfly', 'transfer'];
    if (!validTypes.includes(strip.type)) {
        errors.push(`Strip type must be one of: ${validTypes.join(', ')}`);
    }

    if (typeof strip.values !== 'object' || strip.values === null) {
        errors.push('Strip values must be an object');
    }

    if (typeof strip.euroscope !== 'boolean') {
        errors.push('Strip euroscope must be a boolean');
    }

    if (strip.flightPlan !== null && typeof strip.flightPlan !== 'object') {
        errors.push('Strip flightPlan must be an object or null');
    }

    return { valid: errors.length === 0, errors };
}

function sanitizePanel(panel) {
    if (!panel || typeof panel !== 'object') {
        return { name: 'Panel', strips: [] };
    }

    return {
        name: typeof panel.name === 'string' ? panel.name.trim() : 'Panel',
        strips: Array.isArray(panel.strips)
            ? panel.strips.map(sanitizeStrip).filter(s => s !== null)
            : []
    };
}

function sanitizeStrip(strip) {
    if (!strip || typeof strip !== 'object') {
        return null;
    }

    const validTypes = ['departure', 'arrival', 'overfly', 'transfer'];
    const type = validTypes.includes(strip.type) ? strip.type : 'overfly';

    return {
        id: typeof strip.id === 'string' ? strip.id : `strip-${Date.now()}`,
        type: type,
        values: typeof strip.values === 'object' && strip.values !== null ? strip.values : {},
        euroscope: Boolean(strip.euroscope),
        flightPlan: strip.flightPlan && typeof strip.flightPlan === 'object' ? strip.flightPlan : null,
        lastUpdate: typeof strip.lastUpdate === 'number' ? strip.lastUpdate : Date.now()
    };
}

function validatePanels(panels) {
    const errors = [];

    if (!Array.isArray(panels)) {
        return { valid: false, errors: ['Panels must be an array'] };
    }

    panels.forEach((panel, index) => {
        const validation = validatePanel(panel);
        if (!validation.valid) {
            errors.push(`Panel at index ${index}: ${validation.errors.join(', ')}`);
        }
    });

    return { valid: errors.length === 0, errors };
}

function sanitizePanels(panels) {
    if (!Array.isArray(panels)) {
        return [];
    }

    return panels.map(sanitizePanel);
}
