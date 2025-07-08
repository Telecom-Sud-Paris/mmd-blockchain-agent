/*
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProductProperty structure representing a single product property.
 */
class ProductProperty {
    /**
     * @param {string} name - The name of the property.
     * @param {string} value - The value of the property.
     * @param {number} timestamp - The timestamp when the property was recorded (as a number, equivalent to Java's Long).
     */
    constructor(name, value, timestamp) {
        this.name = name;
        this.value = value;
        this.timestamp = timestamp;
    }

    /**
     * Gets the value of the property.
     * @returns {string} The property's value.
     */
    getValue() {
        return this.value;
    }

    /**
     * Gets the timestamp of the property.
     * @returns {number} The property's timestamp.
     */
    getTimestamp() {
        return this.timestamp;
    }

    /**
     * Gets the name of the property.
     * @returns {string} The property's name.
     */
    getName() {
        return this.name;
    }

    /**
     * Checks if this ProductProperty object is equal to another object.
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

        return this.value === other.value &&
               this.timestamp === other.timestamp &&
               this.name === other.name;
    }

    /**
     * Generates a simple hash code for this object based on its properties.
     * @returns {string} A string representation of the hash.
     */
    hashCode() {
        // A simple hash function for demonstration.
        // In practice, for true uniqueness or hashing in collections,
        // you might use a more robust hashing library or strategy.
        const str = `${this.name}-${this.value}-${this.timestamp}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString();
    }

    /**
     * Returns a string representation of the object.
     * @returns {string} The string representation.
     */
    toString() {
        return `${this.constructor.name}@${this.hashCode()} [name=${this.name}, value=${this.value}, timestamp=${this.timestamp}]`;
    }
    
}

module.exports = ProductProperty;