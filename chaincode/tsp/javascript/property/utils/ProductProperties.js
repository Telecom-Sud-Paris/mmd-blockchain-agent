/*
 * SPDX-License-Identifier: Apache-2.0
 */



/**
 * ProductProperties structure used for handling result of query
 */
class ProductProperties {
    /**
     * @param {string} productId
     * @param {Array<object>} properties - An array of ProductProperty objects,
     * where each object has 'name' and 'value' properties.
     */
    constructor(productId, properties) {
        this.productId = productId;
        this.properties = properties;
    }

    /**
     * Gets the product ID.
     * @returns {string} The product ID.
     */
    getProductId() {
        return this.productId;
    }

    /**
     * Gets the list of product properties.
     * @returns {Array<object>} The list of product properties.
     */
    getProperties() {
        return this.properties;
    }

    /**
     * Checks if this ProductProperties object is equal to another object.
     * @param {object} obj The object to compare with.
     * @returns {boolean} True if the objects are equal, false otherwise.
     */
    equals(obj) {
        if (this === obj) {
            return true;
        }

        if (!obj || obj.constructor !== this.constructor) {
            return false;
        }

        const other = obj;

        // Deep comparison for the 'properties' array
        const propertiesEqual = (Array.isArray(this.properties) && Array.isArray(other.properties)) &&
                                this.properties.length === other.properties.length &&
                                this.properties.every((prop, index) => {
                                    const otherProp = other.properties[index];
                                    return prop.name === otherProp.name && prop.value === otherProp.value;
                                });

        return this.productId === other.productId && propertiesEqual;
    }

    /**
     * Generates a hash code for this object.
     * (Note: JavaScript doesn't have a direct equivalent of Java's hashCode for object identity.
     * This is a simple hash based on property values.)
     * @returns {string} A string representation of the hash.
     */
    hashCode() {
        // A simple way to create a "hash" in JS, good for logging/debugging
        return JSON.stringify({ productId: this.productId, properties: this.properties }).split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0).toString();
    }


    /**
     * Returns a string representation of the object.
     * @returns {string} The string representation.
     */
    toString() {
        let builder = `${this.constructor.name}@${this.hashCode()} [productId=${this.productId}`;
        for (const property of this.properties) {
            builder += `, ${property.name}=${property.value}`;
        }
        builder += `]`;
        return builder;
    }
}

module.exports = ProductProperties;