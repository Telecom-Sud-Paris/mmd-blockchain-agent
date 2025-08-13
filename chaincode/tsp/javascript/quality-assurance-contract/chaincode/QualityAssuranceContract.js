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

    /**
     * Verifica a conformidade e emite credencial se aprovado
     */
    async verifyCompliance(ctx, productId, phase) {
        const txTimestamp = ctx.stub.getTxTimestamp();
        const date = new Date(txTimestamp.seconds.low * 1000 + txTimestamp.nanos / 1000000);
        const timestamp = date.toISOString();
        
        const productData = await this._getProductData(ctx, productId);
        const standards = await this._getStandards(ctx, phase);
        const { compliant, violations } = this._checkCompliance(productData, standards);
 
        if (compliant) {
            const vc = await this._issueCredential(ctx, productId, phase);
            return { 
                status: 'approved',
                credential: vc,
                timestamp: timestamp
            };
        }
        
        return {
            status: 'rejected',
            violations,
            timestamp: timestamp
        };
    }

    // Helper methods
    /**
     * Helper method to get and aggregate product data from ProductContract.
     * This implementation dynamically invokes the 'product' chaincode.
     * @private
     */
    async _getProductData(ctx, productId, phase) {
        console.info(`Aggregating data for product ${productId}, phase ${phase}`);

        const productResponseBytes = await ctx.stub.invokeChaincode(
            'product', 
            ['queryProductProperties', productId], 
            'mychannel' 
        );

        if (!productResponseBytes || productResponseBytes.length === 0) {
            throw new Error(`Could not retrieve properties for product ${productId} from ProductContract.`);
        }

        const productResponse = JSON.parse(productResponseBytes.toString());
        
        if (!productResponse.properties || productResponse.properties.length === 0) {
             throw new Error(`No properties data found for product ${productId} in phase ${phase}`);
        }
        
        const properties = productResponse.properties;
        const aggregatedData = {};
        for (const prop of properties) {
            const numericValue = parseFloat(prop.propertyValue);
            aggregatedData[prop.propertyName] = isNaN(numericValue) ? prop.propertyValue : numericValue;
        }

        return aggregatedData; 
    }
    
    async _getStandards(ctx, phase) {
        const response = await ctx.stub.invokeChaincode(
            'StandardHoneyContract',
            ['getStandards'],
            'mychannel'
        );
        
        const standards = JSON.parse(response.payload.toString());
        if (!standards.phases[phase]) {
            throw new Error(`No standards defined for phase ${phase}`);
        }
        return standards.phases[phase];
    }

    _checkCompliance(productData, standards) {
        const violations = [];
        
        for (const [param, standard] of Object.entries(standards)) {
            const value = productData[param];
            
            if (value === undefined && standard.required) {
                violations.push({ parameter: param, issue: 'Missing required parameter' });
                continue;
            }
            
            if (standard.max !== undefined && value > standard.max) {
                violations.push({ 
                    parameter: param, 
                    issue: `Value ${value} exceeds max ${standard.max}` 
                });
            }
            
            if (standard.min !== undefined && value < standard.min) {
                violations.push({ 
                    parameter: param, 
                    issue: `Value ${value} below min ${standard.min}` 
                });
            }
        }
        
        return {
            compliant: violations.length === 0,
            violations
        };
    }

    async _issueCredential(ctx, productId, phase) {
        const vc = {
            id: `vc:${uuidv4()}`,
            type: ['VerifiableCredential', 'HoneyQualityCredential'],
            issuer: ctx.clientIdentity.getID(),
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
                id: `product:${productId}`,
                productId,
                phase,
                status: 'approved'
            },
            proof: {
                type: 'ECDSA',
                created: new Date().toISOString(),
                verificationMethod: `${ctx.clientIdentity.getID()}#keys-1`
            }
        };
        
        const vcKey = `VC_${productId}_${phase}`;
        await ctx.stub.putState(vcKey, Buffer.from(JSON.stringify(vc)));
        
        ctx.stub.setEvent('CredentialIssued', Buffer.from(JSON.stringify({
            productId,
            credentialId: vc.id,
            timestamp: vc.issuanceDate
        })));
        
        return vc;
    }
}

module.exports = QualityAssuranceContract;