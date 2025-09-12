---
sidebar_position: 3
---


# Chaincode 

This chaincode manages the state of product properties. Each property is stored as a unique entry, enabling a detailed and immutable history of a product's condition.

## Data Structure

The contract uses a **composite key** to uniquely identify each property entry on the ledger. This allows for efficient and complex queries. The key is structured as: `ProductProperty(productType, productId, phase, propertyName, publisherId)`.

## Contract Functions

### Write Functions

**`async initLedger(ctx)`**
* **Purpose**: Populates the ledger with a predefined set of sample products and their properties.
* **Use Case**: Intended to be run once for demonstration or to set up an initial state.

**`async upsertProductProperty(ctx, productType, productId, ...)`**
* **Purpose**: The primary function for creating or updating a product property. This is the main entry point for new data.
* **Core Logic**:
    1.  Accepts product details and the new property value.
    2.  Creates a composite key for the data point.
    3.  Constructs a JSON object containing all the property details and a transaction timestamp.
    4.  Saves the data to the ledger.
    5.  **Inter-Chaincode Invocation**: After saving the state, it immediately calls the `checkAlertRule` function on the `alertcontrol` chaincode to validate the new value against predefined quality rules.
    6.  Emits a `PropertyUpserted` event to notify subscribed clients of the change.

### Query Functions

**`async queryProductProperties(ctx, productType, productId)`**
* **Purpose**: Retrieves a complete history of all properties recorded for a specific product ID.

**`async queryProductByPhase(ctx, productType, productId, phase)`**
* **Purpose**: Retrieves all properties for a specific product that were recorded during a particular phase (e.g., 'transportation').

**`async getProductByType(ctx, productType)`**
* **Purpose**: Finds and returns all products matching a given `productType` (e.g., 'honey').

---
