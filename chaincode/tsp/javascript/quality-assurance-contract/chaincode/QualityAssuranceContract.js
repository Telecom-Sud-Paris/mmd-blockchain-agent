/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const { Contract } = require('fabric-contract-api');
const { v4: uuidv4 } = require('uuid');

class QualityAssuranceContract extends Contract {
    constructor() {
        super('utm.QualityAssuranceContract');
    }

    async verifyProductCompliance(ctx, productType, productId) {
        console.info(`\n============= START: Verifying all phases for product ${productType}:${productId} =============`);

        console.info('  -> Step 1: Invoking ProductContract to get all product properties.');
        const productResponseBytes = await ctx.stub.invokeChaincode('product', ['queryProductProperties', productType, productId], 'mychannel');
        if (!productResponseBytes || !productResponseBytes.payload || productResponseBytes.payload.length === 0) {
            throw new Error(`Could not retrieve data for product ${productType}:${productId}`);
        }
        console.info('  -> Step 1: Successfully retrieved product properties.');
        
        const productData = JSON.parse(productResponseBytes.payload.toString());
        if (!productData.properties || productData.properties.length === 0) {
            const message = `No properties found for product ${productType}:${productId}. Nothing to verify.`;
            console.warn(`  -> ${message}`);
            return JSON.stringify({ status: 'complete', message, results: [] });
        }

        console.info('  -> Step 2: Extracting unique phases from product data.');
        const phases = [...new Set(productData.properties.map(p => p.phase))];
        console.info(`  -> Step 2: Found ${phases.length} unique phases to verify: [${phases.join(', ')}]`);

        const verificationResults = [];

        console.info('  -> Step 3: Starting verification loop for each phase.');
        for (const phase of phases) {
            console.info(`\n  ----- Verifying phase: ${phase} -----`);
            const result = await this.verifyPhaseCompliance(ctx, productType, productId, phase);
            verificationResults.push({ phase, ...result });
            console.info(`  ----- Finished phase: ${phase} with status: ${result.status.toUpperCase()} -----`);
        }

        console.info(`============= END: Verification for product ${productType}:${productId} complete =============\n`);
        return JSON.stringify(verificationResults);
    }

    async verifyPhaseCompliance(ctx, productType, productId, phase) {
        console.info(`    [verifyPhaseCompliance] START for phase '${phase}'`);
        const timestamp = new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString();
        
        try {
            console.info(`    [verifyPhaseCompliance] Getting product data for phase '${phase}'...`);
            const productPhaseData = await this._getProductDataForPhase(ctx, productType, productId, phase);
            
            console.info(`    [verifyPhaseCompliance] Getting standards for phase '${phase}'...`);
            const standards = await this._getStandards(ctx, phase);
            
            console.info(`    [verifyPhaseCompliance] Checking compliance...`);
            const { compliant, violations } = this._checkCompliance(productPhaseData, standards);
 
            if (compliant) {
                console.info(`    [verifyPhaseCompliance] Status: COMPLIANT. Issuing credential...`);
                const vc = await this._issueCredential(ctx, productType, productId, phase);
                return { status: 'approved', credential: vc, timestamp };
            }
            
            console.warn(`    [verifyPhaseCompliance] Status: NOT COMPLIANT.`);
            return { status: 'rejected', violations, timestamp };

        } catch (error) {
            console.error(`    [verifyPhaseCompliance] ERROR during verification for phase '${phase}': ${error.message}`);
            return { status: 'error', message: error.message, timestamp };
        }
    }

    async _getProductDataForPhase(ctx, productType, productId, phase) {
        console.info(`      [_getProductDataForPhase] Invoking ProductContract:queryProductByPhase for phase '${phase}'`);
        const productResponseBytes = await ctx.stub.invokeChaincode('product', ['queryProductByPhase', productType, productId, phase], 'mychannel');
        if (!productResponseBytes || !productResponseBytes.payload || productResponseBytes.payload.length === 0) {
            throw new Error(`Could not retrieve properties for product ${productId}, phase ${phase}.`);
        }
        
        const productResponse = JSON.parse(productResponseBytes.payload.toString());
        if (!productResponse.properties || productResponse.properties.length === 0) {
            throw new Error(`No properties data found for product ${productId} in phase ${phase}`);
        }
        
        console.info(`      [_getProductDataForPhase] Aggregating ${productResponse.properties.length} properties...`);
        const aggregatedData = {};
        for (const prop of productResponse.properties) {
            const numericValue = parseFloat(prop.propertyValue);
            aggregatedData[prop.propertyName] = isNaN(numericValue) ? prop.propertyValue : numericValue;
        }
        console.info(`      [_getProductDataForPhase] Aggregated data: ${JSON.stringify(aggregatedData)}`);
        return aggregatedData;
    }
    
    async _getStandards(ctx, phase) {
        console.info(`      [_getStandards] Invoking StandardHoneyContract:getStandards for phase '${phase}'`);
        const response = await ctx.stub.invokeChaincode('standardhoney', ['getStandards'], 'mychannel');
        const standards = JSON.parse(response.payload.toString());
        if (!standards.phases[phase]) {
            throw new Error(`No standards defined for phase ${phase}`);
        }
        console.info(`      [_getStandards] Standards for phase '${phase}' retrieved successfully.`);
        return standards.phases[phase];
    }

    _checkCompliance(productData, standards) {
        console.info(`        [_checkCompliance] Starting compliance check...`);
        const violations = [];
        for (const [param, standard] of Object.entries(standards)) {
            const value = productData[param];
            if (value === undefined && standard.required) {
                const violation = { parameter: param, issue: 'Missing required parameter' };
                console.warn(`        [_checkCompliance] VIOLATION: ${JSON.stringify(violation)}`);
                violations.push(violation);
                continue;
            }
            if (standard.max !== undefined && value > standard.max) {
                const violation = { parameter: param, issue: `Value ${value} exceeds max ${standard.max}` };
                console.warn(`        [_checkCompliance] VIOLATION: ${JSON.stringify(violation)}`);
                violations.push(violation);
            }
            if (standard.min !== undefined && value < standard.min) {
                const violation = { parameter: param, issue: `Value ${value} below min ${standard.min}` };
                console.warn(`        [_checkCompliance] VIOLATION: ${JSON.stringify(violation)}`);
                violations.push(violation);
            }
        }
        const isCompliant = violations.length === 0;
        console.info(`        [_checkCompliance] Check finished. Compliant: ${isCompliant}, Violations: ${violations.length}`);
        return { compliant: isCompliant, violations };
    }

    async _issueCredential(ctx, productType, productId, phase) {
        console.info(`      [_issueCredential] START - Issuing credential for phase '${phase}'...`);
        const timestamp = new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString();
        const vc = {
            id: `vc:${uuidv4()}`,
            type: ['VerifiableCredential', 'HoneyQualityCredential'],
            issuer: ctx.clientIdentity.getID(),
            issuanceDate: timestamp,
            credentialSubject: {
                id: `product:${productType}:${productId}`,
                productType, productId, phase, status: 'approved'
            }
        };
        
        const vcKey = ctx.stub.createCompositeKey('VC', [productType, productId, phase]);
        await ctx.stub.putState(vcKey, Buffer.from(JSON.stringify(vc)));
        console.info(`      [_issueCredential] Credential saved to ledger with key: ${vcKey}`);
        
        ctx.stub.setEvent('CredentialIssued', Buffer.from(JSON.stringify({ productId, phase, credentialId: vc.id })));
        console.info(`      [_issueCredential] Event "CredentialIssued" emitted.`);
        
        return vc;
    }
}

module.exports = QualityAssuranceContract;