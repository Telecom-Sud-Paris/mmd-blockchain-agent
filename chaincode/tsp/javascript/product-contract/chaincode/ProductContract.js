/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

/**
 * ProductContract
 *
 * A smart contract that manages properties associated with products in a supply chain.
 * It allows different publishers (such as transporters or food producers),
 * to register and update data (properties) about products, like temperature, location, etc.
 *
 * Each property is uniquely identified by the combination of:
 * - Product ID
 * - Property Name
 * - Publisher ID
 */
class ProductContract extends Contract {
    constructor() {
        // define unique namespace for this contract to avoid conflicts
        super('tsp.ProductContract');
    }
    async initLedger(ctx) {
        console.log('============= START : Initialize Ledger ===========');
        console.log('============= END : Initialize Ledger ===========');
    }


    // managing functions

    /**
    * @dev Creates a new product property or updates it if it already exists for a specific publisher.
    * @param {Context} ctx The transaction context.
    * @param {string} publisherId The ID of the entity publishing the property (e.g., 'Transporter').
    * @param {string} productId The ID of the product the property refers to (e.g., 'fish').
    * @param {string} propertyName The name of the property (e.g., 'temperature').
    * @param {string} propertyValue The new or initial value for the property (e.g., '16.5').
    * @returns {string} The created or updated property object in JSON format.
    */
    async upsertProductProperty(ctx, publisherId, productId, propertyName, propertyValue) {
        console.log('============= START : upsertProductProperty ===========');

        if (!publisherId || !productId || !propertyName || !propertyValue) {
            throw new Error('publisherId, productId, propertyName, and propertyValue cannot be empty.');
        }
        // uniquely identifies the property for a specific product and publisher
        const compositeKey = ctx.stub.createCompositeKey('ProductProperty', [productId, propertyName, publisherId]);
        const txTimestamp = ctx.stub.getTxTimestamp();
        const date = new Date(txTimestamp.seconds.low * 1000 + txTimestamp.nanos / 1000000);
        const timestamp = date.toISOString();

        const existingPropertyBuffer = await ctx.stub.getState(compositeKey);

        let finalProperty;
        let eventName;

        if (existingPropertyBuffer && existingPropertyBuffer.length > 0) {
            console.log(`Property found for key ${compositeKey}. Updating...`);
            const existingProperty = JSON.parse(existingPropertyBuffer.toString('utf8'));
            // Update the value and timestamp
            existingProperty.propertyValue = propertyValue;
            existingProperty.lastUpdated = timestamp;
            finalProperty = existingProperty;
            eventName = 'PropertyUpdated'; // Set event for an update
        } else {
            console.log(`Property not found for key ${compositeKey}. Creating new one...`);
            const newProperty = {
                docType: 'productProperty',
                publisherId: publisherId,
                productId: productId,
                propertyName: propertyName,
                propertyValue: propertyValue,
                lastUpdated: timestamp,
            };
            finalProperty = newProperty;
            eventName = 'PropertyCreated'; // Set event for a creation
        }

        const finalPropertyBuffer = Buffer.from(JSON.stringify(finalProperty));
        await ctx.stub.putState(compositeKey, finalPropertyBuffer);

        const eventPayload = Buffer.from(JSON.stringify(finalProperty));
        ctx.stub.setEvent(eventName, eventPayload);

        console.log(`Upsert successful for: ${JSON.stringify(finalProperty)}`);
        console.log('============= END : upsertProductProperty ===========');

        return JSON.stringify(finalProperty);
    }


    /**
     * @dev Deletes a product property from the ledger.
     * @param {Context} ctx The transaction context.
     * @param {string} publisherId The ID of the property's publisher.
     * @param {string} productId The product's ID.
     * @param {string} propertyName The name of the property.
     */
    async deleteProductProperty(ctx, publisherId, productId, propertyName) {
        console.log('============= START : deleteProductProperty ===========');

        const compositeKey = ctx.stub.createCompositeKey('ProductProperty', [productId, propertyName, publisherId]);
        const propertyExists = await ctx.stub.getState(compositeKey);

        if (!propertyExists || propertyExists.length === 0) {
            throw new Error(`The property ${propertyName} for product ${productId} from publisher ${publisherId} was not found.`);
        }

        await ctx.stub.deleteState(compositeKey);
        
        const eventPayload = Buffer.from(JSON.stringify({ publisherId, productId, propertyName, status: 'deleted' }));
        ctx.stub.setEvent('PropertyDeleted', eventPayload);

        console.log(`Property deleted successfully: ${compositeKey}`);
        console.log('============= END : deleteProductProperty ===========');
    }



    // Queries

    /**
     * @dev Queries all properties associated with a specific product ID.
     * Uses a partial composite key to find all records for the product.
     * @param {Context} ctx The transaction context.
     * @param {string} productId The ID of the product to be queried.
     * @returns {string} A JSON object containing the all the products and their properties.
     * If no properties are found, returns an empty array.
     * @throws {Error} If the productId is not provided.
     * @throws {Error} If no properties are found for the given productId.
     */

    async queryAllProducts(ctx) {
        console.log('============= START : queryAllProducts ===========');
        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('ProductProperty', []);
        const products = new Map();
        let result = await resultsIterator.next();
        while (!result.done) {
            if (result.value && result.value.value) {
                try {
                    const propertyRecord = JSON.parse(result.value.value.toString('utf8'));
                    const productId = propertyRecord.productId;
                    if (!products.has(productId)) {
                        products.set(productId, {
                            productId: productId,
                            properties: []
                        });
                    }
                    products.get(productId).properties.push(propertyRecord);
                } catch (err) {
                    console.error('Error parsing JSON from property record:', err);
                }
            }
            result = await resultsIterator.next();
        }
        await resultsIterator.close();
        if (products.size === 0) {
            console.warn('No products found in the ledger.');
        }
        const response = Array.from(products.values());
        console.log('============= END : queryAllProducts ===========');
        return JSON.stringify(response);
    }
    
    /**     
     * * @dev Queries all properties associated with a specific product ID.
     * Uses a partial composite key to find all records for the product.
     * @param {Context} ctx The transaction context
     * @param {string} productId The ID of the product to be queried.
     * @returns {string} A JSON object containing the product ID and its properties.
     */

    async queryProductProperties(ctx, productId) {
        console.log('============= START : queryProductProperties ===========');

        if (!productId) {
            throw new Error('The product ID is required for the query.');
        }

        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('ProductProperty', [productId]);
        const properties = [];
        
        let result = await resultsIterator.next();
        while (!result.done) {
            if (result.value && result.value.value) {
                try {
                    const propertyRecord = JSON.parse(result.value.value.toString('utf8'));
                    properties.push(propertyRecord);
                } catch (err) {
                    console.error('Error parsing JSON from property record:', err);
                }
            }
            result = await resultsIterator.next();
        }
        await resultsIterator.close();

        if (properties.length === 0) {
            console.warn(`No properties found for product with ID=${productId}`);
        }
        
        const response = {
            productId: productId,
            properties: properties
        };

        console.log('============= END : queryProductProperties ===========');
        return JSON.stringify(response);
    }


    // Util functions

    /**
     * @dev Retrieves the history of changes for a specific product property.
     * @param {Context} ctx The transaction context.
     * @param {string} publisherId The ID of the property's publisher.
     * @param {string} productId The product's ID.
     * @param {string} propertyName The name of the property.
     * @returns {string} A JSON array of historical values for the property.
     */
    async getProductPropertyHistory(ctx, publisherId, productId, propertyName) {
        console.log('============= START : getProductPropertyHistory ===========');

        const compositeKey = ctx.stub.createCompositeKey('ProductProperty', [productId, propertyName, publisherId]);
        const resultsIterator = await ctx.stub.getHistoryForKey(compositeKey);

        const history = [];
        let result = await resultsIterator.next();
        while (!result.done) {
            if (result.value) {
                const record = {
                    txId: result.value.tx_id,
                    timestamp: result.value.timestamp.toDate().toISOString(),
                    isDelete: result.value.is_delete,
                    value: result.value.value.toString('utf8'),
                };
                history.push(record);
            }
            result = await resultsIterator.next();
        }
        await resultsIterator.close();

        console.log('============= END : getProductPropertyHistory ===========');
        return JSON.stringify(history);
    }

    /**
     * @dev Checks if a property name exists for a given product (regardless of publisher).
     * @param {Context} ctx The transaction context.
     * @param {string} productId The product's ID.
     * @param {string} propertyName The name of the property to check.
     * @returns {boolean} True if the property exists for the product, false otherwise.
     */
    async propertyNameExistsForProduct(ctx, productId, propertyName, publisherId) {
        if (!productId || !propertyName || !publisherId) {
            throw new Error('productId, propertyName and publisherId are required.');
        }
        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('ProductProperty', [productId, propertyName, publisherId]);
        let exists = false;
        let result = await resultsIterator.next();
        while (!result.done) {
            if (result.value && result.value.value && result.value.value.length > 0) {
                exists = true;
                break;
            }
            result = await resultsIterator.next();
        }
        await resultsIterator.close();
        return exists;
    }
}

module.exports = ProductContract;