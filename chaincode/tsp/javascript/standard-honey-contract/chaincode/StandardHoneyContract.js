'use strict';
const { Contract } = require('fabric-contract-api');

/**
 * Smart contract for managing honey standards based on ISO 15798:2001, ISO 5529:2001, ISO/TS 23401:2021, and ISO 21527-1:2008.
 */
class HoneyStandardContract extends Contract {
    constructor() {
        super('utm.HoneyStandardContract');
        this.standardCache = new Map();
        this.cacheOrder = []; // Track insertion order for LRU cache
    }

    /**
     * Initializes the honey standards registry on first deployment.
     * @param {Context} ctx - The transaction context.
     * @throws {Error} If the registry is already initialized or the client lacks admin privileges.
     */
    async init(ctx) {
        if (!ctx.clientIdentity.getAttributeValue('admin')) {
            throw new Error('Only admins can initialize the standards registry');
        }

        const registryBytes = await ctx.stub.getState('standardsRegistry');
        if (registryBytes && registryBytes.length > 0) {
            throw new Error('Standards registry already initialized');
        }

        const standards = {
            productType: 'honey',
            version: '1.0.0',
            phases: {
                beekeeping: {
                    pesticide_level: { max: 0.01, unit: 'mg/kg' }, // No specific ISO, general safety
                    hive_health_score: { min: 80, max: 100, unit: 'score' }, // Custom metric
                    origin_verification: { required: true } // ISO/TS 23401:2021
                },
                processing: {
                    moisture_content: { max: 20, unit: '%' }, // ISO 5529:2001
                    temperature: { max: 40, unit: '°C' }, // Prevent degradation
                    filtration_quality: { required: true } // Custom processing standard
                },
                distribution: {
                    storage_temperature: { min: 10, max: 25, unit: '°C' }, // Stability
                    humidity: { max: 60, unit: '%' }, // Prevent moisture absorption
                    origin_verification: { required: true } // ISO/TS 23401:2021
                },
                retailing: {
                    packaging_integrity: { required: true }, // Ensure no contamination
                    storage_temperature: { min: 10, max: 25, unit: '°C' },
                    origin_verification: { required: true } // ISO/TS 23401:2021
                },
                final_product: {
                    moisture_content: { max: 20, unit: '%' }, // ISO 5529:2001
                    fructose_content: { min: 30, max: 50, unit: '%' }, // ISO 15798:2001
                    glucose_content: { min: 25, max: 45, unit: '%' }, // ISO 15798:2001
                    sucrose_content: { max: 5, unit: '%' }, // ISO 15798:2001
                    microbial_count: { max: 1000, unit: 'CFU/g' }, // ISO 21527-1:2008
                    origin_verification: { required: true } // ISO/TS 23401:2021
                }
            },
            lastUpdated: new Date().toISOString()
        };

        try {
            await ctx.stub.putState('standardsRegistry', Buffer.from(JSON.stringify(standards)));
            ctx.stub.setEvent('StandardsInitialized', Buffer.from(JSON.stringify({
                productType: 'honey',
                timestamp: standards.lastUpdated
            })));
        } catch (err) {
            throw new Error(`Failed to initialize standards registry: ${err.message}`);
        }
    }

    /**
     * Retrieves the standard for a specific phase of honey production.
     * @param {Context} ctx - The transaction context.
     * @param {string} productType - The type of product ('honey').
     * @param {string} phase - The phase of production or 'final_product'.
     * @returns {Object} The standard for the phase.
     * @throws {Error} If the product type or phase is invalid or not found.
     */
    async getPhaseStandard(ctx, productType, phase) {
        if (typeof productType !== 'string' || typeof phase !== 'string') {
            throw new Error('productType and phase must be strings');
        }

        if (productType !== 'honey') {
            throw new Error('Unsupported product type');
        }

        const validPhases = ['beekeeping', 'processing', 'distribution', 'retailing', 'final_product'];
        if (!validPhases.includes(phase)) {
            throw new Error(`Invalid phase: ${phase}`);
        }

        const cacheKey = `${productType}_${phase}`;
        if (this.standardCache.has(cacheKey)) {
            return this.standardCache.get(cacheKey);
        }

        const standards = await this._getStandardsRegistry(ctx);
        const phaseStandard = standards.phases[phase];

        if (!phaseStandard) {
            throw new Error(`No standard found for phase: ${phase}`);
        }

        if (this.standardCache.size >= 50) {
            const oldestKey = this.cacheOrder.shift();
            this.standardCache.delete(oldestKey);
        }

        this.standardCache.set(cacheKey, phaseStandard);
        this.cacheOrder.push(cacheKey);

        return phaseStandard;
    }

    /**
     * Updates the standards registry with new or modified standards.
     * @param {Context} ctx - The transaction context.
     * @param {string} updatesJSON - JSON string of updates to standards.
     * @returns {Object} Updated standards status.
     * @throws {Error} If the client lacks admin privileges, updates are invalid, or state update fails.
     */
    async updateStandards(ctx, updatesJSON) {
        if (!ctx.clientIdentity.getAttributeValue('admin')) {
            throw new Error('Only admins can update standards');
        }

        let updates;
        try {
            updates = JSON.parse(updatesJSON);
        } catch (err) {
            throw new Error(`Invalid updates JSON: ${err.message}`);
        }

        if (typeof updates !== 'object' || updates === null || updates.productType !== 'honey') {
            throw new Error('Invalid updates: must be an object with productType "honey"');
        }

        const standards = await this._getStandardsRegistry(ctx);
        const validPhases = ['beekeeping', 'processing', 'distribution', 'retailing', 'final_product'];

        if (updates.phases) {
            for (const [phase, phaseStandards] of Object.entries(updates.phases)) {
                if (!validPhases.includes(phase)) {
                    throw new Error(`Invalid phase in updates: ${phase}`);
                }
                if (typeof phaseStandards !== 'object' || phaseStandards === null) {
                    throw new Error(`Invalid standards for phase: ${phase}`);
                }
                standards.phases[phase] = { ...standards.phases[phase], ...phaseStandards };
            }
        }

        standards.lastUpdated = new Date().toISOString();
        standards.version = this._incrementVersion(standards.version);

        try {
            await ctx.stub.putState('standardsRegistry', Buffer.from(JSON.stringify(standards)));
            ctx.stub.setEvent('StandardsUpdated', Buffer.from(JSON.stringify({
                productType: 'honey',
                version: standards.version,
                timestamp: standards.lastUpdated
            })));
            this.standardCache.clear(); // Clear cache to ensure updated standards are used
            this.cacheOrder = [];
        } catch (err) {
            throw new Error(`Failed to update standards registry: ${err.message}`);
        }

        return { status: 'SUCCESS', updated: standards };
    } 

    /**
     * Retrieves the standards registry.
     * @param {Context} ctx - The transaction context.
     * @returns {Object} Standards registry.
     * @throws {Error} If registry is not initialized or cannot be parsed.
     * @private
     */
    async _getStandardsRegistry(ctx) {
        const registryBytes = await ctx.stub.getState('standardsRegistry');
        if (!registryBytes || registryBytes.length === 0) {
            throw new Error('Standards registry not initialized');
        }
        try {
            return JSON.parse(registryBytes.toString());
        } catch (err) {
            throw new Error(`Failed to parse standards registry: ${err.message}`);
        }
    }

    /** 
     * Increments the version number of the standards registry.
     * @param {string} version - Current version (e.g., '1.0.0').
     * @returns {string} Incremented version.
     * @private
     */
    _incrementVersion(version) {
        const parts = version.split('.').map(Number);
        parts[2]++;
        if (parts[2] >= 100) {
            parts[2] = 0;
            parts[1]++;
        }
        if (parts[1] >= 100) {
            parts[1] = 0;
            parts[0]++;
        }
        return parts.join('.');
    }
}

module.exports = HoneyStandardContract;