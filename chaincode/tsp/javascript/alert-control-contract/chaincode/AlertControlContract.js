/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class AlertControlContract extends Contract {
    constructor() {
        super('tsp.AlertControlContract');
    }

    /**
     * @dev Stores or updates a quality rule on the ledger.
     * This function should be called by an administrator to configure the system.
     * @param {Context} ctx The transaction context.
     * @param {string} productId The product ID (e.g., 'fish').
     * @param {string} propertyName The property name (e.g., 'temperature').
     * @param {string} condition The comparison condition ('equal', 'less_than', etc.).
     * @param {string} value The reference value for the rule.
     * @param {string} alertMessage The message to be emitted if the rule is violated.
     */
    async setRule(ctx, productId, propertyName, condition, value, alertMessage) {
        console.log(`Setting rule for ${productId} - ${propertyName}`);

        const rule = {
            docType: 'alertRule',
            productId,
            propertyName,
            condition,
            value: parseFloat(value), // Store as a number for easier comparisons
            alertMessage
        };

        // The rule's key is a combination of the product ID and property name
        const ruleKey = ctx.stub.createCompositeKey('Rule', [productId, propertyName]);
        await ctx.stub.putState(ruleKey, Buffer.from(JSON.stringify(rule)));
        
        console.log(`Rule set successfully for key: ${ruleKey}`);
    }

    /**
     * @dev Queries all quality rules for a specific product.
     * @param {Context} ctx The transaction context.
     * @param {string} productId The ID of the product to query rules for.
     * @returns {string} A JSON string representing an array of rules for the specified product.
     */
    async queryRulesForProduct(ctx, productId) {
        console.log(`Querying rules for product: ${productId}`);
        
        if (!productId) {
            throw new Error('Product ID must be provided.');
        }

        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('Rule', [productId]);
        
        const productRules = [];
        let result = await resultsIterator.next();
        
        while (!result.done) {
            if (result.value && result.value.value) {
                try {
                    const ruleRecord = JSON.parse(result.value.value.toString('utf8'));
                    productRules.push(ruleRecord);
                } catch (err) {
                    console.error('Error parsing JSON from rule record:', err);
                }
            }
            result = await resultsIterator.next();
        }
        
        await resultsIterator.close();
        
        console.log(`Found ${productRules.length} rules for product ${productId}.`);
        return JSON.stringify(productRules);
    }

    /**
     * @dev Queries all quality rules registered on the ledger.
     * @param {Context} ctx The transaction context.
     * @returns {string} A JSON string representing an array of all rules.
     */
    async queryAllRules(ctx) {
        console.log('Querying all quality rules...');
        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('Rule', []);
        
        const allRules = [];
        let result = await resultsIterator.next();
        
        while (!result.done) {
            if (result.value && result.value.value) {
                try {
                    const ruleRecord = JSON.parse(result.value.value.toString('utf8'));
                    allRules.push(ruleRecord);
                } catch (err) {
                    console.error('Error parsing JSON from rule record:', err);
                }
            }
            result = await resultsIterator.next();
        }
        
        await resultsIterator.close();
        
        console.log(`Found ${allRules.length} rules.`);
        return JSON.stringify(allRules);
    }

    /**
     * @dev Main verification function
     * @param {Context} ctx The transaction context.
     * @param {string} productId The product ID.
     * @param {string} propertyName The property name.
     * @param {string} currentValue The current value of the property.
     * @returns {string} Returns 'OK' if quality standards are met or AlertMessage if they are violated.
     */
    async checkAlertRule(ctx, productId, propertyName, currentValue) {
        console.log(`Checking alert for ${productId} - ${propertyName} with value ${currentValue}`);

        const ruleKey = ctx.stub.createCompositeKey('Rule', [productId, propertyName]);
        const ruleJSON = await ctx.stub.getState(ruleKey);

        if (!ruleJSON || ruleJSON.length === 0) {
            console.log(`No alert rule found for ${productId} - ${propertyName}. Skipping check.`);
            return 'NO_RULE';
        }

        const rule = JSON.parse(ruleJSON.toString());
        const numericCurrentValue = parseFloat(currentValue);

        if (isNaN(numericCurrentValue)) {
            console.log(`Value ${currentValue} is not numeric. Skipping check.`);
            return 'INVALID_VALUE';
        }

        let violation = false;
        switch (rule.condition) {
            case 'equal':
                violation = numericCurrentValue !== rule.value;
                break;
            case 'not_equal':
                violation = numericCurrentValue === rule.value;
                break;
            case 'less_than':
                violation = numericCurrentValue >= rule.value;
                break;
            case 'greater_than':
                violation = numericCurrentValue <= rule.value;
                break;
            case 'less_than_or_equal':
                violation = numericCurrentValue > rule.value;
                break;
            case 'greater_than_or_equal':
                violation = numericCurrentValue < rule.value;
                break;
            default:
                console.log(`Unknown condition: ${rule.condition}. Skipping check.`);
                return 'UNKNOWN_CONDITION';
        }

        if (violation) {
            console.error(`Rule violation detected for ${productId} - ${propertyName}!`);
            const alertPayload = {
                productId: productId,
                propertyName: propertyName,
                checkedValue: numericCurrentValue,
                rule: rule,
                timestamp: new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString()
            };

            // Emits an alert event for off-chain applications
            ctx.stub.setEvent('Alert', Buffer.from(JSON.stringify(alertPayload)));
            console.error(`Alert: ${rule.alertMessage}`);
            return rule.alertMessage;
        }

        console.log('Rule check passed.');
        return 'OK';
    }
}

module.exports = AlertControlContract;