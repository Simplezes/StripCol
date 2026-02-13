/**
 * Data Validation Utilities
 * Provides schema validation and sanitization for panel and strip data
 */

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

/**
 * Validate a panel object against the schema
 * @param {Object} panel - Panel object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
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

/**
 * Validate a strip object against the schema
 * @param {Object} strip - Strip object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
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

/**
 * Sanitize panel data, fixing common issues
 * @param {Object} panel - Panel object to sanitize
 * @returns {Object} Sanitized panel object
 */
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

/**
 * Sanitize strip data, fixing common issues
 * @param {Object} strip - Strip object to sanitize
 * @returns {Object|null} Sanitized strip object or null if invalid
 */
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

/**
 * Validate an array of panels
 * @param {Array} panels - Array of panel objects
 * @returns {Object} { valid: boolean, errors: string[] }
 */
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

/**
 * Sanitize an array of panels
 * @param {Array} panels - Array of panel objects
 * @returns {Array} Sanitized array of panels
 */
function sanitizePanels(panels) {
    if (!Array.isArray(panels)) {
        return [];
    }

    return panels.map(sanitizePanel);
}
