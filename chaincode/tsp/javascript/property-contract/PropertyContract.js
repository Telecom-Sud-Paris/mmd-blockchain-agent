/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class PropertyContract extends Contract {

    constructor() {
        //namespace the contract
        //avoid conflicts with other contracts
        super('edu.tsp.PropertyContract');
    }

    
    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        const initialProperties = [
            {
                productId: 'product1',
                propertyName: 'color',
                propertyValue: 'red',
                timestamp: Date.now()
            },
            {
                productId: 'product2',
                propertyName: 'size',
                propertyValue: 'large',
                timestamp: Date.now()
            },
        ]
        for (const property of initialProperties) {
            await this.createOrUpdateProductProperty(
                ctx,
                property.productId,
                property.propertyName,
                property.propertyValue,
                property.timestamp
            );
        }   
        console.info('============= END : Initialize Ledger ===========');
    }


    async createOrUpdateProductProperty(ctx, productId, propertyName, propertyValue, timestamp) {
        console.info('============= START : createOrUpdateProductProperty ===========');

        const productProperty = {
            name: propertyName,
            value: propertyValue,
            timestamp: parseInt(timestamp),
            docType: 'productProperty', 
        };

        const compositeKey = ctx.stub.createCompositeKey('ProductProperty', [productId, propertyName]);
        const propertyBuffer = Buffer.from(JSON.stringify(productProperty));

        await ctx.stub.putState(compositeKey, propertyBuffer);

        console.info('============= END : createOrUpdateProductProperty ===========');
        return JSON.stringify(productProperty);
    }

   
    async queryProductProperties(ctx, productId) {
        console.info('============= START : queryProductProperties ===========');

        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('ProductProperty', [productId]);

        const properties = [];
        let result = await resultsIterator.next();
        while (!result.done) {
            if (result.value && result.value.value.toString()) {
                const jsonRes = {};
                try {
                    jsonRes.key = result.value.key;
                    jsonRes.record = JSON.parse(result.value.value.toString('utf8'));
                    properties.push(jsonRes.record);
                } catch (err) {
                    console.log(err);
                    jsonRes.record = result.value.value.toString('utf8');
                }
            }
            result = await resultsIterator.next();
        }

        if (properties.length === 0) {
            throw new Error(`Product with ID=${productId} does not exist or has no properties`);
        }
        
        const productProperties = {
            productId: productId,
            properties: properties
        };

        console.info('============= END : queryProductProperties ===========');
        return JSON.stringify(productProperties);
    }
}

module.exports = PropertyContract;