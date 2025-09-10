---
sidebar_position: 3
---

# Chaincode

## Class Structure

```javascript
'use strict';

const { Contract } = require('fabric-contract-api');

class AlertControlContract extends Contract {
    constructor() {
        super('tsp.AlertControlContract');
    }

    // ... contract functions ...
}

module.exports = AlertControlContract;
```

* **`class AlertControlContract extends Contract`**: This defines our contract class, which inherits all the base functionality from the `Contract` class.
* **`constructor()`**: The constructor calls the parent class's constructor (`super`) with a unique name for the contract (`tsp.AlertControlContract`), which acts as a namespace to identify this contract on the network.

---

## Contract Functions

### Write Functions

#### `async setRule(...)`

This function is used to create a new quality rule or update an existing one on the ledger.

```javascript
async setRule(ctx, productType, propertyName, condition, value, alertMessage)
```

* **Parameters**:
    * `ctx`: The transaction context object, which provides access to ledger APIs (`stub`).
    * `productType`: The type of product (e.g., 'fish').
    * `propertyName`: The property to be monitored (e.g., 'temperature').
    * `condition`: The comparison condition (e.g., 'less_than_or_equal').
    * `value`: The reference value for the condition.
    * `alertMessage`: The alert message to be issued in case of a violation.
* **Core Logic**:
    1.  **Validation**: It checks if all parameters were provided and if the `condition` is one of the supported values (`equal`, `less_than`, etc.).
    2.  **Object Creation**: It assembles a JSON object (`rule`) with the rule's data.
    3.  **Composite Key**: It creates a unique key for the rule using `ctx.stub.createCompositeKey('Rule', [productType, propertyName])`. This enables efficient queries, such as "fetch all rules for the product 'fish'".
    4.  **Write to Ledger**: It saves the rule object to the ledger using `ctx.stub.putState()`. The object is converted to a Buffer before being saved.

#### `async checkAlertRule(...)`

This is the main verification function. It compares a received value (e.g., from a sensor) with the rule stored on the ledger.

```javascript
async checkAlertRule(ctx, productType, propertyName, currentValue)
```

* **Purpose**: To check if the current value of a property violates its defined rule.
* **Core Logic**:
    1.  **Fetch Rule**: It uses the same composite key logic from the `setRule` function to fetch the corresponding rule from the ledger with `ctx.stub.getState()`.
    2.  **Existence Check**: If no rule is found (`!ruleJSON`), the function returns `'NO_RULE'`, indicating there is nothing to check against.
    3.  **Comparison Logic**:
        * It converts the `currentValue` to a number.
        * It uses a `switch` block to evaluate the `rule.condition`. For each case (e.g., `'less_than'`), it compares the `numericCurrentValue` with the `rule.value`.
        * **Important**: The logic determines if the rule has been violated. For instance, for the condition `'less_than'`, a violation occurs if `numericCurrentValue >= rule.value`.
    4.  **Event Emission**: If the rule is violated (`isRuleViolated` is `true`):
        * It creates a payload (`alertPayload`) with details of the violation (product, checked value, rule, timestamp).
        * It emits an event on the blockchain named `Alert` using `ctx.stub.setEvent()`. Client applications can listen for these events to react in real-time.
        * It returns the `rule.alertMessage`.
    5.  **Success**: If there is no violation, the function returns `'OK'`.


### Query Functions

#### `async queryRulesForProduct(...)` & `async queryAllRules(...)`

These are query functions for reading data from the ledger without modifying it.

* **`queryRulesForProduct(ctx, productType)`**:
    * **Purpose**: To return all rules associated with a specific `productType`.
    * **Logic**: It uses `ctx.stub.getStateByPartialCompositeKey('Rule', [productType])` to fetch all records whose key starts with the provided `productType`. It iterates over the results and returns them as a JSON array.

* **`queryAllRules(ctx)`**:
    * **Purpose**: To return every single rule stored on the ledger.
    * **Logic**: It works similarly to the previous function but calls `getStateByPartialCompositeKey('Rule', [])` without specifying a `productType`, which fetches all records of type 'Rule'.

