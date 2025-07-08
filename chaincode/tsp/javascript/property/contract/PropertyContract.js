/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'; // Enforce strict mode for better code quality

// Import the Contract and Context classes from the Fabric Contract API

const { Contract, Context } = require('fabric-contract-api');

// Import the custom data structures
const ProductProperties = require('./ProductProperties');
const ProductProperty = require('./ProductProperty');

/**
 * Custom context for the PropertyContract.
 * This class can be extended to add custom properties to the transaction context.
 * In this example, it's not strictly necessary, but good practice if you foresee
 * adding custom context data.
 */
class PropertyContext extends Context {
    constructor() {
        super();
        // You can add custom properties to the context here if needed
        // For instance: this.myCustomData = someService;
    }
}

/**
 * JavaScript implementation of the Property Contract
 */
class PropertyContract extends Contract {

    constructor() {
        super('PropertyContract'); // Give the contract a name
        // No direct equivalent for Genson in Node.js smart contracts.
        // JSON.parse() and JSON.stringify() are used implicitly or explicitly.
        // The Fabric SDK handles serialization/deserialization for ledger interactions.
        this.ProductProperties = ProductProperties; // Make ProductProperties available within the contract
        this.ProductProperty = ProductProperty;     // Make ProductProperty available within the contract
    }

    /**
     * Override the createContext method to use our custom context.
     * This is useful if you add custom properties to PropertyContext.
     * @returns {PropertyContext} The custom transaction context.
     */
    createContext() {
        return new PropertyContext();
    }

    /**
     * Enum-like object for error codes.
     * In JavaScript, you often use plain objects or Maps for enums.
     */
    static get PropertyContractErrors() {
        return {
            NOT_FOUND: 'NOT_FOUND',
            ALREADY_EXISTS: 'ALREADY_EXISTS' // Not used in this specific Java contract, but good to include if it was there
        };
    }

    /**
     * Retrieves properties for a product with the specified ID from the ledger.
     *
     * @param {Context} ctx The transaction context.
     * @param {string} productId The product ID.
     * @returns {string} A JSON string representation of ProductProperties.
     */
    async queryProductProperties(ctx, productId) {
        const stub = ctx.getStub(); // Get the ChaincodeStub
        
        // In Node.js, createCompositeKey returns a string directly.
        // It's recommended to include an objectType as the first argument for composite keys.
        // For a collection of ProductProperty under a productId, you'd typically query by the 'productId'
        // as the objectType or a prefix, and then iterate.
        // Let's use 'productProperty' as the objectType for keys involving individual properties.
        // So, a key for a specific property might be 'productProperty<productId><propertyName>'.
        // To query all properties for a productId, we query by partial composite key with 'productProperty' and 'productId'.
        const partialKey = stub.createCompositeKey('productProperty', [productId]);
        
        // getStateByPartialCompositeKey returns an async iterator
        const resultsIterator = await stub.getStateByPartialCompositeKey('productProperty', [productId]);
        
        const properties = [];
        let result = await resultsIterator.next();
        while (!result.done) {
            const strValue = result.value.value.toString('utf8');
            let productProperty;
            try {
                productProperty = JSON.parse(strValue); // Deserialize JSON string to object
            } catch (err) {
                console.log(err);
                productProperty = strValue; // Fallback in case it's not JSON
            }
            properties.push(productProperty);
            result = await resultsIterator.next();
        }
        await resultsIterator.close(); // Important to close the iterator

        if (properties.length === 0) {
            const errorMessage = `Product with ID=${productId} does not exist`;
            console.log(errorMessage);
            // Throwing an error in JavaScript smart contract, Fabric handles it as ChaincodeException
            throw new Error(errorMessage, PropertyContract.PropertyContractErrors.NOT_FOUND);
        }

        // Create a new ProductProperties instance using the imported class
        const productProperties = new ProductProperties(productId, properties);
        // Return a JSON string of the ProductProperties object
        return JSON.stringify(productProperties);
    }

    /**
     * Initializes the ledger. (No operation in this case).
     * @param {Context} ctx The transaction context.
     */
    async initLedger(ctx) {
        // Do nothing
        console.log('Ledger initialized (no initial data added).');
    }

    /**
     * Creates (or updates) a new product property state on the ledger.
     *
     * @param {Context} ctx The transaction context.
     * @param {string} productId ID of the product.
     * @param {string} propertyName Product property name.
     * @param {string} propertyValue Product property value.
     * @param {number} timestamp The timestamp for the property (equivalent to Java's Long).
     * @returns {string} The created/updated ProductProperty as a JSON string.
     */
    async createOrUpdateProductProperty(ctx, productId, propertyName, propertyValue, timestamp) {
        const stub = ctx.getStub();

        // Create a new ProductProperty instance
        const productProperty = new ProductProperty(propertyName, propertyValue, timestamp);
        
        // Serialize the object to a JSON string
        const productPropertyState = JSON.stringify(productProperty);

        // Create a composite key using an objectType and attributes
        // It's good practice to have an objectType for composite keys, e.g., 'productProperty'
        const key = stub.createCompositeKey('productProperty', [productId, propertyName]);
        
        // Put the state on the ledger
        await stub.putState(key, Buffer.from(productPropertyState));

        // Return the JSON string of the created/updated ProductProperty
        return productPropertyState;
    }
}

module.exports = PropertyContract;