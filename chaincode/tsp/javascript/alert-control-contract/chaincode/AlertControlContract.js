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
     * @param {string} productType The product type (e.g., 'fish').
     * @param {string} propertyName The property name (e.g., 'temperature').
     * @param {string} condition The comparison condition ('equal', 'less_than', etc.).
     * @param {string} value The reference value for the rule.
     * @param {string} alertMessage The message to be emitted if the rule is violated.
     */
    async setRule(ctx, productType, propertyName, condition, value, alertMessage) {
        console.log(`Setting rule for ${productType} - ${propertyName}`);

        // Validate input
        if (!productType || !propertyName || !condition || !value || !alertMessage) {
            throw new Error('All parameters are required');
        }

        const supportedConditions = ['equal', 'not_equal', 'less_than', 'greater_than', 
                                'less_than_or_equal', 'greater_than_or_equal'];
        if (!supportedConditions.includes(condition)) {
            throw new Error(`Unsupported condition: ${condition}`);
        }

        const numericValue = parseFloat(value);
        if (isNaN(numericValue)) {
            throw new Error(`Value must be numeric: ${value}`);
        }

        const rule = {
            docType: 'alertRule',
            productType,
            propertyName,
            condition,
            value: numericValue, // Store as a number for easier comparisons
            alertMessage
        };

        // The rule's key is a combination of the product type and property name
        const ruleKey = ctx.stub.createCompositeKey('Rule', [productType, propertyName]);
        await ctx.stub.putState(ruleKey, Buffer.from(JSON.stringify(rule)));
        
        console.log(`Rule set successfully for key: ${ruleKey}`);
    }


    /**
     * @dev Main verification function
     * @param {Context} ctx The transaction context.
     * @param {string} productType The product type.
     * @param {string} propertyName The property name.
     * @param {string} currentValue The current value of the property.
     * @returns {string} Returns 'OK' if quality standards are met or AlertMessage if they are violated.
     */
    async checkAlertRule(ctx, productType, propertyName, currentValue) {
        console.log(`Checking alert for ${productType} - ${propertyName} with value ${currentValue}`);

        const ruleKey = ctx.stub.createCompositeKey('Rule', [productType, propertyName]);
        const ruleJSON = await ctx.stub.getState(ruleKey);

        if (!ruleJSON || ruleJSON.length === 0) {
            console.log(`No alert rule found for ${productType} - ${propertyName}. Skipping check.`);
            return 'NO_RULE';
        }

        const rule = JSON.parse(ruleJSON.toString());
        const numericCurrentValue = parseFloat(currentValue);

        if (isNaN(numericCurrentValue)) {
            console.log(`Value ${currentValue} is not numeric. Skipping check.`);
            return 'INVALID_VALUE';
        }

        let isRuleViolated = false;
        switch (rule.condition) {
            case 'equal':
                // Rule: value should be equal to rule.value
                // Violation: when not equal
                isRuleViolated = numericCurrentValue !== rule.value;
                break;
            case 'not_equal':
                // Rule: value should not be equal to rule.value
                // Violation: when equal
                isRuleViolated = numericCurrentValue === rule.value;
                break;
                case 'less_than':
                isRuleViolated = numericCurrentValue >= rule.value;
                break;
                case 'greater_than':
                isRuleViolated = numericCurrentValue <= rule.value;
                break;
                case 'less_than_or_equal':
                isRuleViolated = numericCurrentValue > rule.value;
                break;
                case 'greater_than_or_equal':
                isRuleViolated = numericCurrentValue < rule.value;
                break;
                default:
                    console.log(`Unknown condition: ${rule.condition}. Skipping check.`);
                    return 'UNKNOWN_CONDITION';
            }

        if (isRuleViolated) {
            console.error(`Rule violation detected for ${productType} - ${propertyName}!`);
            const alertPayload = {
                productType: productType,
                propertyName: propertyName,
                checkedValue: numericCurrentValue,
                rule: rule,
                timestamp: new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString()
            };

            ctx.stub.setEvent('Alert', Buffer.from(JSON.stringify(alertPayload)));
            console.error(`Alert: ${rule.alertMessage}`);
            return rule.alertMessage;
        }

        console.log('Rule check passed.');
        return 'OK';
    }

    
    /**
     * @dev Queries all quality rules for a specific product.
     * @param {Context} ctx The transaction context.
     * @param {string} productType The ID of the product to query rules for.
     * @returns {string} A JSON string representing an array of rules for the specified product.
     */
    async queryRulesForProduct(ctx, productType) {
        console.log(`Querying rules for product: ${productType}`);
        
        if (!productType) {
            throw new Error('Product type must be provided.');
        }

        const resultsIterator = await ctx.stub.getStateByPartialCompositeKey('Rule', [productType]);
        
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
        
        console.log(`Found ${productRules.length} rules for product ${productType}.`);
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

    
}

module.exports = AlertControlContract;