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
            
            
            if (result.status === 'skipped') {
                console.info(`  ----- Phase: ${phase} - SKIPPED: ${result.message} -----`);
            } else if (result.status === 'approved') {
                console.info(`  ----- Phase: ${phase} - APPROVED: Credential issued -----`);
            } else if (result.status === 'rejected') {
                console.info(`  ----- Phase: ${phase} - REJECTED: ${(result.violations && result.violations.length) || 0} violations found -----`);
            } else if (result.status === 'error') {
                console.error(`  ----- Phase: ${phase} - ERROR: ${result.message} -----`);
            }
        }

        console.info(`============= END: Verification for product ${productType}:${productId} complete =============\n`);
        return JSON.stringify(verificationResults);
    }

    async verifyPhaseCompliance(ctx, productType, productId, phase) {
        console.info(`    [verifyPhaseCompliance] START for phase '${phase}'`);
        const timestamp = new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString();
        
        try {
            console.info(`    [verifyPhaseCompliance] Checking if phase '${phase}' has standards defined...`);
            const hasStandards = await this._checkPhaseHasStandards(ctx, phase);
            
            if (!hasStandards) {
                const message = `No standards defined for phase '${phase}'.`;
                console.warn(`    [verifyPhaseCompliance] ${message}`);
                return { status: 'skipped', message, timestamp };
            }
            
            console.info(`    [verifyPhaseCompliance] Getting product data for phase '${phase}'...`);
            const productPhaseData = await this._getProductDataForPhase(ctx, productType, productId, phase);
            
            console.info(`    [verifyPhaseCompliance] Getting standards for phase '${phase}'...`);
            const standards = await this._getStandards(ctx, phase);
            
            console.info(`    [verifyPhaseCompliance] Checking compliance...`);
            const { compliant, violations } = await this._checkCompliance(productPhaseData, standards);
 
            if (compliant) {
                console.info(`    [verifyPhaseCompliance] Status: COMPLIANT. Issuing credential...`);
                const vc = await this._issueCredential(ctx, productType, productId, phase);
                return { status: 'approved', credential: vc, timestamp };
            } else {
                console.warn(`    [verifyPhaseCompliance] Status: NOT COMPLIANT. Violations: ${violations.length}`);
                if (violations.length > 0) {
                    console.warn(`    [verifyPhaseCompliance] Violations details: ${JSON.stringify(violations)}`);
                }
                return { status: 'rejected', violations, timestamp };
            }

        } catch (error) {
            console.error(`    [verifyPhaseCompliance] ERROR during verification for phase '${phase}': ${error.message}`);
            return { status: 'error', message: error.message, timestamp };
        }
    }

    async _checkPhaseHasStandards(ctx, phase) {
        console.info(`      [_checkPhaseHasStandards] Checking if standards exist for phase '${phase}'`);
        try {
            const response = await ctx.stub.invokeChaincode('standardhoney', ['getStandards'], 'mychannel');
            const standards = JSON.parse(response.payload.toString());
            
            // check if phase exists and has parameters
            const hasStandards = !!(standards.phases && standards.phases[phase]);
            console.info(`      [_checkPhaseHasStandards] Phase '${phase}' has standards: ${hasStandards}`);
            
            return hasStandards;
        } catch (error) {
            console.warn(`      [_checkPhaseHasStandards] Error checking standards for phase '${phase}': ${error.message}`);
            return false;
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
        console.info(`      [_getStandards] Invoking StandardHoneyContract:getPhaseStandard for phase '${phase}'`);
        try {
            const response = await ctx.stub.invokeChaincode('standardhoney', ['getPhaseStandard', phase], 'mychannel');
            const standards = JSON.parse(response.payload.toString());
            console.info(`      [_getStandards] Standards for phase '${phase}' retrieved successfully.`);
            return standards;
        } catch (error) {
            console.error(`      [_getStandards] Error getting standards for phase '${phase}': ${error.message}`);
            throw new Error(`Failed to retrieve standards for phase '${phase}': ${error.message}`);
        }
    }

    async _checkCompliance(productData, standards) {
        console.info(`        [_checkCompliance] Starting compliance check...`);
        console.info(`        [_checkCompliance] Product data: ${JSON.stringify(productData)}`);
        console.info(`        [_checkCompliance] Standards: ${JSON.stringify(standards)}`);
        
        const violations = [];
        
        for (const [param, standard] of Object.entries(standards)) {
            const value = productData[param];
            
            // check if parameter is required but missing
            if (value === undefined && standard.required) {
                const violation = { 
                    parameter: param, 
                    issue: 'Missing required parameter',
                    expected: 'Required parameter',
                    actual: 'Not found'
                };
                console.warn(`        [_checkCompliance] VIOLATION: ${JSON.stringify(violation)}`);
                violations.push(violation);
                continue;
            }
            
            // if the parameter is not present and not required, skip further checks
            if (value === undefined) {
                console.info(`        [_checkCompliance] Parameter '${param}' not found in product data but not required. Skipping.`);
                continue;
            }

            // check if value exceeds maximum allowed
            if (standard.max !== undefined && value > standard.max) {
                const violation = { 
                    parameter: param, 
                    issue: `Value exceeds maximum allowed`,
                    expected: `≤ ${standard.max}${standard.unit ? ' ' + standard.unit : ''}`,
                    actual: `${value}${standard.unit ? ' ' + standard.unit : ''}`
                };
                console.warn(`        [_checkCompliance] VIOLATION: ${JSON.stringify(violation)}`);
                violations.push(violation);
            }
            
            // check if value is below minimum required
            if (standard.min !== undefined && value < standard.min) {
                const violation = { 
                    parameter: param, 
                    issue: `Value below minimum required`,
                    expected: `≥ ${standard.min}${standard.unit ? ' ' + standard.unit : ''}`,
                    actual: `${value}${standard.unit ? ' ' + standard.unit : ''}`
                };
                console.warn(`        [_checkCompliance] VIOLATION: ${JSON.stringify(violation)}`);
                violations.push(violation);
            }
            
            // check if value is boolean/presence verification
            if (standard.required && typeof value === 'boolean' && !value) {
                const violation = { 
                    parameter: param, 
                    issue: 'Required verification failed',
                    expected: 'true (verified)',
                    actual: 'false (not verified)'
                };
                console.warn(`        [_checkCompliance] VIOLATION: ${JSON.stringify(violation)}`);
                violations.push(violation);
            }
        }
        
        const isCompliant = violations.length === 0;
        console.info(`        [_checkCompliance] Check finished. Compliant: ${isCompliant}, Violations: ${violations.length}`);
        return { compliant: isCompliant, violations };
    }

   async _issueCredential(ctx, productType, productId, phase) {
    const methodName = '_issueCredential';
    console.info(`      [${methodName}] START - Issuing credential for ${productType}:${productId} phase '${phase}'`);
    
    try {
        console.info(`      [${methodName}] Validating context and dependencies...`);
        if (!ctx || !ctx.stub || !ctx.clientIdentity) {
            throw new Error('Invalid context: missing required properties');
        }

        console.info(`      [${methodName}] Getting transaction details...`);
        const txId = ctx.stub.getTxID();
        console.info(`      [${methodName}] Transaction ID: ${txId}`);

        const txTimestamp = ctx.stub.getTxTimestamp();
        if (!txTimestamp || !txTimestamp.seconds) {
            throw new Error('Invalid transaction timestamp');
        }
        
        const timestamp = new Date(txTimestamp.seconds.low * 1000).toISOString();
        console.info(`      [${methodName}] Transaction timestamp: ${timestamp}`);

        console.info(`      [${methodName}] Generating deterministic credential ID...`);
        const credentialId = `vc:${productType}:${productId}:${phase}:${txId}`;
        console.info(`      [${methodName}] Generated credential ID: ${credentialId}`);

        console.info(`      [${methodName}] Getting issuer identity...`);
        const issuerId = ctx.clientIdentity.getID();
        console.info(`      [${methodName}] Issuer ID: ${issuerId}`);

        console.info(`      [${methodName}] Building Verifiable Credential structure...`);
        const vc = {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://example.com/honey-credentials/v1'
            ],
            id: credentialId,
            type: ['VerifiableCredential', 'HoneyQualityCredential'],
            
            issuer: {
                id: issuerId,
                name: 'Quality Assurance System'
            },
            
            issuanceDate: timestamp,
            validFrom: timestamp,
            
            credentialSubject: {
                id: `product:${productType}:${productId}`,
                type: 'HoneyProduct',
                productType: productType,
                productId: productId,
                phase: phase,
                status: 'approved',
                complianceDate: timestamp
            },
            
            proof: {
                type: 'BlockchainSignature2023',
                created: timestamp,
                proofPurpose: 'assertionMethod',
                verificationMethod: `${issuerId}#key-1`,
                proofValue: `urn:blockchain:tx:${txId}`,
                domain: 'honey-supply-chain'
            }
        };

        console.info(`      [${methodName}] VC structure built successfully`);

        console.info(`      [${methodName}] Creating composite key for ledger storage...`);
        const vcKey = ctx.stub.createCompositeKey('vc.honey.quality', [productType, productId, phase]);
        console.info(`      [${methodName}] Composite key created: ${vcKey}`);

        console.info(`      [${methodName}] Checking if credential already exists...`);
        const existingVcBytes = await ctx.stub.getState(vcKey);
        if (existingVcBytes && existingVcBytes.length > 0) {
            const existingVc = JSON.parse(existingVcBytes.toString());
            console.info(`      [${methodName}] Existing credential found: ${existingVc.id}`);
            
            console.info(`      [${methodName}] Returning existing credential to ensure consensus`);
            return existingVc;
        }

        console.info(`      [${methodName}] Converting VC to buffer and storing in ledger...`);
        const vcBuffer = Buffer.from(JSON.stringify(vc));
        await ctx.stub.putState(vcKey, vcBuffer);
        console.info(`      [${methodName}] Credential successfully stored in ledger`);

        console.info(`      [${methodName}] Emitting CredentialIssued event...`);
        const eventPayload = {
            credentialId: credentialId,
            productType: productType,
            productId: productId,
            phase: phase,
            issuanceDate: timestamp,
            status: 'approved'
        };

        await ctx.stub.setEvent('CredentialIssued', Buffer.from(JSON.stringify(eventPayload)));
        console.info(`      [${methodName}] Event emitted successfully`);

        console.info(`      [${methodName}] SUCCESS: Credential issued for ${productType}:${productId} phase '${phase}'`);

        return vc;

    } catch (error) {
        console.error(`      [${methodName}] ERROR: Failed to issue credential: ${error.message}`);
        console.error(`      [${methodName}] Error stack: ${error.stack}`);
        throw new Error(`Failed to issue credential for phase ${phase}: ${error.message}`);
    }
}

    async queryPhaseCredential(ctx, productType, productId, phase) {
        console.info(`[queryPhaseCredential] Querying credential for ${productType}:${productId} phase ${phase}`);
        
        const vcKey = ctx.stub.createCompositeKey('VC', [productType, productId, phase]);
        const vcBytes = await ctx.stub.getState(vcKey);
        
        if (!vcBytes || vcBytes.length === 0) {
            return JSON.stringify({ status: 'not_found', message: `No credential found for phase ${phase}` });
        }
        
        const vc = JSON.parse(vcBytes.toString());
        return JSON.stringify({ status: 'found', credential: vc });
    }
}

module.exports = QualityAssuranceContract;