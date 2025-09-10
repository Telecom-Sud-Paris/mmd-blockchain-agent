---
sidebar_position: 4
---

# Application
The client application is responsible for populating the ledger with the initial set of standards defined in the configuration file.

## Configuration File (honey-standards.yaml)
This YAML file defines the quality control rules in a human-readable format.

* **Structure**: The file specifies the productType and version at the top level. The core of the file is the phases object, which contains keys for each stage of the supply chain (transportation, beekeeping, processing, distribution, retailing, final_product).

* **Parameters**: Under each phase, specific parameters are defined with their required constraints, such as max temperature, min hive health score, or a required boolean for checks like origin_verification.

#### Example
```yaml
beekeeping:
    pesticide_level: 
      max: 0.01 
      unit: 'mg/kg'
    hive_health_score: 
      min: 80 
      max: 100 
      unit: 'score'
```

## Loading Script (load-standards.js)
This Node.js script serves as the client to interact with the blockchain.

* **Purpose**: To automate the process of reading the honey-standards.yaml file and populating the ledger using the StandardHoneyContract.

* **Workflow**:
    1. Connect to Network: Establishes a connection to the Hyperledger Fabric network by building a connection profile (CCP), enrolling an admin and an application user, and setting up a gateway.
    2. Initialize Ledger: It first submits a transaction to call the initLedger function, ensuring the ledger is ready.
    3. Read and Parse YAML: The script reads the honey-standards.yaml file from the local directory and uses the js-yaml library to parse its contents into a JavaScript object.
    4. Submit Transaction: It then calls contract.submitTransaction, invoking the setStandards function and passing the entire standards object as a JSON string.
    5. Disconnect: Finally, it closes the gateway connection.
