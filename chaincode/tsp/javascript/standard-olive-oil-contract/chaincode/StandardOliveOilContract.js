/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const { Contract } = require('fabric-contract-api');

class StandardOliveOilContract extends Contract {
    constructor() {
        super('tsp.StandardOliveOilContract');
    }

    /**
     * Initializes the ledger with empty standards
     * @param {Context} ctx The transaction context
     * @returns {Object} Operation status
     * @Transaction
     */
    async initLedger(ctx) {
        const txTimestamp = ctx.stub.getTxTimestamp();
        const date = new Date(txTimestamp.seconds.low * 1000 + txTimestamp.nanos / 1000000);
        const timestamp = date.toISOString();

        console.log('Initializing ledger with empty standards...');
        const standards = {
            productType: 'olive-oil',
            version: '1.0.0',
            phases: {},
            lastUpdated: timestamp
        };
        await ctx.stub.putState('standards', Buffer.from(JSON.stringify(standards)));
        return { status: 'success', message: 'Empty standards initialized' };
    }

    /**
     * Sets new standards or replaces existing ones
     * @param {Context} ctx The transaction context
     * @param {string} standardsJSON JSON string with the standards
     * @returns {Object} Operation status with version
     * @throws {Error} If standards are invalid
     */
    async setStandards(ctx, standardsJSON) {
        let standards;
        try {
            standards = JSON.parse(standardsJSON);
            console.log(`Setting new standards: ${JSON.stringify(standards)}`);
        } catch (e) {
            throw new Error('Invalid JSON format for standards');
        }

        if (!standards.productType || standards.productType !== 'olive-oil') {
            throw new Error('Invalid product type. Only "olive-oil" is supported');
        }
        
        if (!standards.version || !/^\d+\.\d+\.\d+$/.test(standards.version)) {
            throw new Error('Invalid version format. Use semantic versioning (e.g. 1.0.0)');
        }
        
        if (!standards.phases || typeof standards.phases !== 'object') {
            throw new Error('Standards must contain phases object');
        }

        // Validate each phase structure
        const validPhases = ['cultivation', 'harvesting', 'extraction', 'storage', 'final_product'];
        for (const phase of Object.keys(standards.phases)) {
            if (!validPhases.includes(phase)) {
                throw new Error(`Invalid phase: ${phase}. Valid phases are: ${validPhases.join(', ')}`);
            }
        }

        const txTimestamp = ctx.stub.getTxTimestamp();
        const date = new Date(txTimestamp.seconds.low * 1000 + txTimestamp.nanos / 1000000);
        const timestamp = date.toISOString();
        standards.lastUpdated = timestamp;
        console.log(`Standards set at ${timestamp}: ${JSON.stringify(standards)}`);
        await ctx.stub.putState('standards', Buffer.from(JSON.stringify(standards)));
        return { status: 'success', version: standards.version };
    }

    /**
     * Updates a specific standard parameter
     * @param {Context} ctx The transaction context
     * @param {string} phase The phase to update (e.g., 'beekeeping')
     * @param {string} parameter The parameter to update (e.g., 'pesticide_level')
     * @param {string} newValueJSON JSON string with the new value
     * @returns {Object} Operation status
     * @throws {Error} If standard not found or update is invalid
     */
    async updateStandard(ctx, phase, parameter, newValueJSON) {
        let newValue;
        const txTimestamp = ctx.stub.getTxTimestamp();
        const date = new Date(txTimestamp.seconds.low * 1000 + txTimestamp.nanos / 1000000);
        const timestamp = date.toISOString();
        try {
            newValue = JSON.parse(newValueJSON);
        } catch (e) {
            throw new Error('Invalid JSON format for new value');
        }

        const standards = JSON.parse(await this._getStandards(ctx));
        
        if (!standards.phases[phase]) {
            throw new Error(`Phase not found: ${phase}`);
        }
        
        if (!standards.phases[phase][parameter]) {
            throw new Error(`Parameter not found: ${phase}.${parameter}`);
        }

        // Validate the new value structure matches the existing one
        const existing = standards.phases[phase][parameter];
        if (typeof existing !== typeof newValue) {
            throw new Error(`Type mismatch for ${phase}.${parameter}`);
        }

        standards.phases[phase][parameter] = {
            ...existing,
            ...newValue
        };
        standards.version = this._incrementVersion(standards.version);
        standards.lastUpdated = timestamp;

        await ctx.stub.putState('standards', Buffer.from(JSON.stringify(standards)));
        return { 
            status: 'success', 
            updated: `${phase}.${parameter}`,
            newVersion: standards.version
        };
    }

    /**
     * Gets all standards
     * @param {Context} ctx The transaction context
     * @returns {string} JSON string with all standards
     * @throws {Error} If standards are not initialized
     */
    async getStandards(ctx) {
        return await this._getStandards(ctx);
    }

    /**
     * Gets standards for a specific phase
     * @param {Context} ctx The transaction context
     * @param {string} phase The phase to retrieve
     * @returns {Object} Standards for the requested phase
     * @throws {Error} If phase not found
     */
    async getPhaseStandard(ctx, phase) {
        const standards = JSON.parse(await this._getStandards(ctx));
        if (!standards.phases[phase]) {
            throw new Error(`No standards defined for phase: ${phase}`);
        }
        return standards.phases[phase];
    }

    // Helper methods

    /**
     * Internal method to get standards from ledger
     * @private
     */
    async _getStandards(ctx) {
        const standards = await ctx.stub.getState('standards');
        if (!standards || standards.length === 0) {
            throw new Error('Standards not initialized. Call initLedger first.');
        }
        return standards.toString();
    }

    /**
     * Increments the version number
     * @private
     * @param {string} current Current version (e.g., '1.0.0')
     * @returns {string} New version (e.g., '1.0.1')
     */
    _incrementVersion(current) {
        const parts = current.split('.').map(Number);
        parts[2] = (parts[2] || 0) + 1; // Increment patch version
        return parts.join('.');
    }
}

module.exports = StandardOliveOilContract;