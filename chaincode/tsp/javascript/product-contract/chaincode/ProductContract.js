/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class ProductContract extends Contract {
    constructor() {
        super('tsp.ProductContract');
    }
    
    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        const products = [
            {
                productType: 'honey',
                productId: 'honey-001',
                properties: [
                    { publisherId: 'Farmer', phase: 'harvesting', propertyName: 'humidity', propertyValue: '18.5' },
                    { publisherId: 'Farmer', phase: 'harvesting', propertyName: 'color', propertyValue: 'light-amber' },
                    { publisherId: 'Transporter', phase: 'testing', propertyName: 'temperature', propertyValue: '20.5' },
                    { publisherId: 'Transporter', phase: 'testing', propertyName: 'humidity', propertyValue: '50' }
                ]
            }
        ];

        for (const product of products) {
            for (const property of product.properties) {
                console.info(`  -> Initializing property: ${product.productId} / ${property.phase} / ${property.propertyName}`);
                await this.upsertProductProperty(ctx, product.productType, product.productId, property.phase, property.propertyName, property.publisherId, property.propertyValue);
            }
        }
        console.info('============= END : Initialize Ledger ===========');
    }

    async upsertProductProperty(ctx, productType, productId, phase, propertyName, publisherId, propertyValue) {
        console.info('============= START : upsertProductProperty ===========');
        console.info(`Executing with args: ${productType}, ${productId}, ${phase}, ${propertyName}, ${publisherId}, ${propertyValue}`);

        if (!productType || !publisherId || !productId || !phase || !propertyName || !propertyValue) {
            throw new Error('productType, publisherId, productId, phase, propertyName, and propertyValue cannot be empty.');
        }
      
        const compositeKey = ctx.stub.createCompositeKey('ProductProperty', [productType, productId, phase, propertyName, publisherId]);
        console.info(`Generated CompositeKey: ${compositeKey}`);

        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.low * 1000).toISOString();

        const newProperty = {
            docType: 'productProperty',
            productType,
            productId,
            phase,
            propertyName,
            publisherId,
            propertyValue,
            lastUpdated: timestamp,
        };

        const finalPropertyBuffer = Buffer.from(JSON.stringify(newProperty));
        await ctx.stub.putState(compositeKey, finalPropertyBuffer);
        console.info('Property successfully saved to ledger.');

        const eventPayload = Buffer.from(JSON.stringify(newProperty));
        ctx.stub.setEvent('PropertyUpserted', eventPayload);
        console.info('Event "PropertyUpserted" emitted.');

        console.info(`Upsert successful for: ${JSON.stringify(newProperty)}`); 
        console.info('============= END : upsertProductProperty ===========');

        return JSON.stringify(newProperty);
    }
    
    async queryProductProperties(ctx, productType, productId) {
        console.info('============= START : queryProductProperties ===========');
        console.info(`Querying for productType: ${productType}, productId: ${productId}`);

        if (!productType || !productId) {
            throw new Error('The productType and productId are required for the query.');
        }

        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('ProductProperty', [productType, productId]);
        const properties = [];
        
        let result = await resultsIterator.next();
        while (!result.done) {
            if (result.value && result.value.value.toString()) {
                properties.push(JSON.parse(result.value.value.toString('utf8')));
            }
            result = await resultsIterator.next();
        }
        await resultsIterator.close(); // Boa prática fechar o iterador

        console.info(`Found ${properties.length} properties for this product.`);

        const response = {
            productType,
            productId,
            properties
        };

        console.info('Query successful. Returning response.');
        console.info('============= END : queryProductProperties ===========');
        return JSON.stringify(response);
    }
    
    async queryProductByPhase(ctx, productType, productId, phase) { 
        console.info('============= START : queryProductByPhase ===========');
        console.info(`Querying for productType: ${productType}, productId: ${productId}, phase: ${phase}`);

        if (!productType || !productId || !phase) {
            throw new Error('productType, productId, and phase are required for the query.');
        }

        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('ProductProperty', [productType, productId, phase]);
        const properties = [];
        
        let result = await resultsIterator.next();
        while (!result.done) {
            if (result.value && result.value.value.toString()) {
                properties.push(JSON.parse(result.value.value.toString('utf8')));
            }
            result = await resultsIterator.next();
        }
        await resultsIterator.close();
        console.info(`Found ${properties.length} properties for this product in phase '${phase}'.`);
        
        const response = {
            productType,
            productId,
            phase,
            properties
        };
        
        console.info('Query successful. Returning response.');
        console.info('============= END : queryProductByPhase ===========');
        return JSON.stringify(response);
    }

;

    async getProductByType(ctx, productType) {
        console.log('============= START : getProductByType ===========');      
        if (!productType) {
            throw new Error('productType is required for the query.');
        }
        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('ProductProperty', [productType]);
        const products = [];
        for await (const res of resultsIterator) {
            const product = JSON.parse(res.value.toString('utf8'));
            if (!products.some(p => p.productId === product.productId)) {
                products.push({
                    productType: product.productType,
                    productId: product.productId,
                    properties: []
                });
            }
            products.find(p => p.productId === product.productId).properties.push(product);
        }
        if (products.length === 0) {
            console.warn(`No products found for productType=${productType}`);
        }
        console.log('============= END : getProductByType ===========');
        return JSON.stringify(products);
    }
    
}

module.exports = ProductContract;
