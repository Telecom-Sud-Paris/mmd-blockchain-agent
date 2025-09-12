---
sidebar_position: 3
---

# Chaincode

The `StandardHoneyContract` manages a single state object on the ledger which holds the entire set of quality standards for honey.

## Class Structure

```javascript
'use strict';
const { Contract } = require('fabric-contract-api');

class StandardHoneyContract extends Contract {
    constructor() {
        super('tsp.StandardHoneyContract');
    }
    // ... contract functions ...
}
module.exports = StandardHoneyContract;
```

The contract class StandardHoneyContract inherits from the base Contract class and is namespaced as tsp.StandardHoneyContract.

## Contract Functions

### Write Functions

#### `async initLedger(ctx)`

* **Purpose**: Initializes the ledger with a default, empty standards object for honey. This ensures the state exists before any updates can be made.

* **Core Logic**: Creates a JSON object with productType: 'honey', a starting version: '1.0.0', an empty phases object, and a lastUpdated timestamp. It then saves this object to the ledger under the key standards.

#### `async setStandards(ctx, standardsJSON)`

Purpose: Sets or completely replaces the quality standards on the ledger.

* **Core Logic**
    1. Parses the input standardsJSON string.
    2. Validates the object to ensure it has a productType of 'honey', a valid semantic version (e.g., '1.0.0'), and a phases object.
    3. It also validates that the phase names are from a predefined list (transportation, beekeeping, etc.).
    4. Adds a lastUpdated timestamp based on the transaction time.
    5. Saves the complete standards object to the ledger, overwriting any previous version.

#### `async updateStandard(ctx, phase, parameter, newValueJSON)`

* **Purpose**: Updates a single parameter within a specific phase without needing to resubmit the entire standards document.

* **Core Logic**:
    1. Fetches the current standards from the ledger.
    2. Validates that the specified phase and parameter exist.
    3. Parses newValueJSON and merges it with the existing parameter data.
    4. Automatically increments the patch version of the standard (e.g., from '1.0.0' to '1.0.1') using the _incrementVersion helper method.
    5. Updates the lastUpdated timestamp.
    6. Saves the modified standards object back to the ledger.

### Query Functions

#### `async getStandards(ctx)`

* **Purpose**: Retrieves the complete, current set of honey standards from the ledger.

* **Core Logic**:
It calls the internal _getStandards(ctx) helper method, which fetches the state associated with the key standards. If the state doesn't exist, it throws an error.

#### `async getPhaseStandard(ctx, phase)`

* **Purpose**: Returns the standards for a single, specified phase (e.g., 'processing').

* **Core Logic**: Fetches the full standards object and returns only the data for the requested phase. Throws an error if the phase is not found.

