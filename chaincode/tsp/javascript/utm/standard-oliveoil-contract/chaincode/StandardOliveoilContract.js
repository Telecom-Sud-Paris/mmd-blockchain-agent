'use strict';
const { Contract } = require('fabric-contract-api');

/**
 * Smart contract for managing agri-food standards on a Hyperledger Fabric blockchain.
 */
class StandardsContract extends Contract {
    constructor() {
        super('utm.StandardsContract');
    }

    async initLedger(ctx) {
        this._checkRole(ctx, 'standard_admin');
        const versionBytes = await ctx.stub.getState('version');
        if (versionBytes && versionBytes.length > 0) {
            throw new Error('Ledger already initialized');
        }

        const standards = {
            version: '1.1.0',
            effectiveDate: '2024-06-01',
            lastUpdated: new Date().toISOString(),
            'olive-oil': {
                description: 'IOOC (International Olive Oil Council) Standards',
                phases: {
                    'cultivation': {
                        temperature: { min: 10, max: 30, unit: '°C', reference: 'IOOC 1.1/2015 §3.2' },
                        humidity: { max: 70, unit: '%', reference: 'IOOC 1.1/2015 §3.4' },
                        pesticide_level: { max: 5, unit: 'ppm', reference: 'EU Regulation 396/2005' },
                        irrigation: {
                            water_quality: {
                                pH: { min: 6.5, max: 8.5 },
                                heavy_metals: {
                                    lead: { max: 0.1, unit: 'mg/l' },
                                    cadmium: { max: 0.01, unit: 'mg/l' }
                                }
                            }
                        }
                    },
                    'harvesting': {
                        delay_after_rain: { min: 48, unit: 'hours', reference: 'IOOC 2.3/2018 §5.1' },
                        bruising: { max: 2, unit: '%', reference: 'IOOC 2.3/2018 §5.3' },
                        harvest_method: {
                            allowed: ['hand picking', 'mechanical shaker'],
                            prohibited: ['ground collection']
                        }
                    },
                    'extraction': {
                        temperature: { max: 27, unit: '°C', reference: 'IOOC 3.5/2020 §7.2' },
                        pressure: { min: 200, max: 400, unit: 'bar', reference: 'IOOC 3.5/2020 §7.4' }
                    },
                    'storage': {
                        temperature: { min: 14, max: 18, unit: '°C', reference: 'IOOC 4.2/2019 §9.1' },
                        packaging: {
                            material: {
                                allowed: ['dark glass', 'stainless steel'],
                                prohibited: ['clear plastic', 'non-food-grade metals']
                            }
                        }
                    }
                },
                final_product: {
                    acidity: { max: 0.8, unit: '%' },
                    peroxide: { max: 20, unit: 'meqO2/kg' }
                }
            }
        };

        await ctx.stub.putState('olive-oil', Buffer.from(JSON.stringify(standards['olive-oil'])));
        await ctx.stub.putState('version', Buffer.from(JSON.stringify({
            version: standards.version,
            effectiveDate: standards.effectiveDate,
            lastUpdated: standards.lastUpdated
        })));
        ctx.stub.setEvent('StandardsInitialized', Buffer.from(JSON.stringify({
            eventType: 'StandardsInitialized',
            version: standards.version,
            timestamp: standards.lastUpdated
        })));
    }

    async addProductStandards(ctx, productType, standardsJSON) {
        this._checkRole(ctx, 'standard_admin');
        if (typeof productType !== 'string' || !productType.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new Error('productType must be a non-empty alphanumeric string');
        }
        if (await ctx.stub.getState(productType)) {
            throw new Error(`Standards for ${productType} already exist`);
        }
        let standards;
        try {
            standards = JSON.parse(standardsJSON);
        } catch (err) {
            throw new Error(`Invalid standards JSON: ${err.message}`);
        }
        await ctx.stub.putState(productType, Buffer.from(JSON.stringify(standards)));
        ctx.stub.setEvent('ProductStandardsAdded', Buffer.from(JSON.stringify({
            eventType: 'ProductStandardsAdded',
            productType,
            timestamp: new Date().toISOString()
        })));
        return { success: true, productType };
    }

    async getPhaseStandard(ctx, productType, phase) {
        this._checkRole(ctx, 'standard_reader');
        if (typeof productType !== 'string' || !productType.match(/^[a-zA-Z0-9_-]+$/) ||
            typeof phase !== 'string' || !phase.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new Error('productType and phase must be non-empty alphanumeric strings');
        }

        const standardBytes = await ctx.stub.getState(productType);
        if (!standardBytes || standardBytes.length === 0) {
            throw new Error(`Standards for ${productType} not found`);
        }

        let standards;
        try {
            standards = JSON.parse(standardBytes.toString());
        } catch (e) {
            throw new Error(`Failed to parse standards for ${productType}: ${e.message}`);
        }

        if (!standards.phases[phase] && phase !== 'final_product') {
            throw new Error(`Phase ${phase} not defined for ${productType}`);
        }

        return phase === 'final_product' ? standards.final_product : standards.phases[phase];
    }

    async updateStandard(ctx, productType, phase, updates) {
        this._checkRole(ctx, 'standard_admin');
        if (typeof productType !== 'string' || !productType.match(/^[a-zA-Z0-9_-]+$/) ||
            typeof phase !== 'string' || !phase.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new Error('productType and phase must be non-empty alphanumeric strings');
        }

        let updatesObj;
        try {
            updatesObj = JSON.parse(updates);
        } catch (err) {
            throw new Error(`Invalid updates JSON: ${err.message}`);
        }

        this._validateUpdates(phase, updatesObj);
        const standardBytes = await ctx.stub.getState(productType);
        if (!standardBytes || standardBytes.length === 0) {
            throw new Error(`Standards for ${productType} not found`);
        }

        let standards;
        try {
            standards = JSON.parse(standardBytes.toString());
        } catch (e) {
            throw new Error(`Failed to parse standards for ${productType}: ${e.message}`);
        }

        if (!standards.phases[phase]) {
            throw new Error(`Phase ${phase} not defined for ${productType}`);
        }

        const oldValue = JSON.parse(JSON.stringify(standards.phases[phase]));
        const timestamp = new Date().toISOString();
        standards.phases[phase] = { ...standards.phases[phase], ...updatesObj };
        standards.lastUpdated = timestamp;

        const versionBytes = await ctx.stub.getState('version');
        let versionData;
        try {
            versionData = JSON.parse(versionBytes.toString());
        } catch (e) {
            throw new Error(`Failed to parse version data: ${e.message}`);
        }
        versionData.version = this._incrementVersion(versionData.version);
        versionData.lastUpdated = timestamp;
        await ctx.stub.putState('version', Buffer.from(JSON.stringify(versionData)));

        const historyKey = ctx.stub.createCompositeKey('HISTORY', [productType, phase, ctx.stub.getTxID()]);
        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify({
            old: oldValue,
            new: standards.phases[phase],
            updatedBy: ctx.clientIdentity.getID(),
            timestamp
        })));

        await ctx.stub.putState(productType, Buffer.from(JSON.stringify(standards)));
        ctx.stub.setEvent('StandardUpdated', Buffer.from(JSON.stringify({
            eventType: 'StandardUpdated',
            productType,
            phase,
            timestamp
        })));
        return { success: true, updatedFields: Object.keys(updatesObj) };
    }

    async getStandardHistory(ctx, productType, phase, limit = 100) {
        this._checkRole(ctx, 'standard_reader');
        if (typeof productType !== 'string' || !productType.match(/^[a-zA-Z0-9_-]+$/) ||
            typeof phase !== 'string' || !phase.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new Error('productType and phase must be non-empty alphanumeric strings');
        }

        const iterator = await ctx.stub.getStateByPartialCompositeKey('HISTORY', [productType, phase]);
        const history = [];
        let count = 0;
        try {
            for await (const { value } of iterator) {
                if (count >= limit) break;
                try {
                    history.push(JSON.parse(value.toString()));
                    count++;
                } catch (e) {
                    console.error(`Failed to parse history entry: ${e.message}`);
                }
            }
        } finally {
            iterator.close();
        }
        return history;
    }

    _validateNestedUpdates(updates, allowedFields, phase, prefix = '') {
        for (const [key, value] of Object.entries(updates)) {
            if (!allowedFields[phase].includes(key) && typeof value !== 'object') {
                throw new Error(`Invalid field ${prefix}${key} for phase ${phase}`);
            }
            if (typeof value === 'object' && value !== null) {
                this._validateNestedUpdates(value, allowedFields, phase, `${prefix}${key}.`);
            }
        }
    }

    _validateUpdates(phase, updates) {
        const allowedFields = {
            cultivation: ['temperature', 'humidity', 'pesticide_level', 'irrigation'],
            harvesting: ['delay_after_rain', 'bruising', 'harvest_method'],
            extraction: ['temperature', 'pressure'],
            storage: ['temperature', 'packaging']
        };
        if (!allowedFields[phase]) {
            throw new Error(`Invalid phase: ${phase}`);
        }
        this._validateNestedUpdates(updates, allowedFields, phase);
        if (updates.temperature) {
            if (typeof updates.temperature.min !== 'number' || typeof updates.temperature.max !== 'number') {
                throw new Error('Temperature min and max must be numbers');
            }
            if (updates.temperature.min >= updates.temperature.max) {
                throw new Error('Temperature min must be less than max');
            }
        }
    }

    _incrementVersion(version) {
        const parts = version.split('.').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) {
            throw new Error(`Invalid version format: ${version}`);
        }
        parts[2] += 1;
        return parts.join('.');
    }

    _checkRole(ctx, requiredRole) {
        const clientRoles = ctx.clientIdentity.getAttributeValue('roles');
        if (!clientRoles) {
            throw new Error(`No roles defined for client ${ctx.clientIdentity.getID()}`);
        }
        const roles = clientRoles.split(',');
        if (!roles.includes(requiredRole)) {
            throw new Error(`Client ${ctx.clientIdentity.getID()} lacks required role ${requiredRole}`);
        }
    }
}

module.exports = StandardsContract;