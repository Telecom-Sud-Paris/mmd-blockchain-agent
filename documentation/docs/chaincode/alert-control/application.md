---
sidebar_position: 4
---

# Application

The client application is responsible for interacting with the `AlertControlContract` smart contract from an environment outside the blockchain (in this case, a Node.js script). Its primary function is to read quality control rules from a configuration file and submit them to the ledger via transactions. Its being used locally to emulate what the blockchain agent will do.

It is composed of two main files:
1.  **`alert-rules.yaml`**: A human-readable configuration file for defining the rules.
2.  **`load-rules.js`**: A script that reads the YAML file and invokes the smart contract to register each rule.

---

## 2. Application Components

### 2.1. Configuration File (`alert-rules.yaml`)

This file serves as the "source of truth" for the quality control rules. The YAML format was chosen for its readability and ease of use.

#### File Structure

The file is a list of products. Each product is an object containing:
* `productType`: The unique identifier for the product (e.g., `'fish'`, `'tomato'`).
* `rules`: A list of rules to be applied to that product.

Each `rule` object in the list contains the fields required to call the `setRule` function in the smart contract:
* `propertyName`: The property to be monitored.
* `condition`: The comparison operator.
* `value`: The threshold value.
* `alertMessage`: The alert message for a violation.

#### Example Structure

```yaml
- productType: 'fish'
  rules:
    - propertyName: 'temperature'
      # Fish must be kept refrigerated during transport.
      condition: 'less_than_or_equal'
      value: 4
      alertMessage: 'ALERT: Fish temperature has exceeded the safe limit of 4°C!'
    
    - propertyName: 'impact'
      # Any physical impact should trigger an alert.
      condition: 'equal'
      value: 0
      alertMessage: 'ALERT: Physical impact detected during fish transport!'

- productType: 'tomato'
  rules:
    - propertyName: 'temperature'
      condition: 'greater_than'
      value: 10
      alertMessage: 'ALERT: Tomato storage temperature is below the optimal 10°C.'
```
---

### 2.2. Loading Script (`load-rules.js`)

This Node.js script automates the process of populating the ledger with the rules defined in the YAML file.

#### Code Analysis

1.  **Module Imports**:
    * `fabric-network`, `fabric-ca-client`: Hyperledger Fabric SDK modules for connecting to and interacting with the network.
    * `path`, `fs`: Native Node.js modules for handling file paths and the file system.
    * `js-yaml`: A library to parse the content of the `.yaml` file into a JavaScript object.
    * `AppUtil.js`, `CAUtil.js`: Helper files to simplify connection setup, user registration, and enrollment.

2.  **Connection Configuration**:
    * Defines constants like `channelName`, `chaincodeName`, `mspOrg1`, `walletPath`, etc. These values must match your Fabric network configuration.

3.  **`main()` Function**:
    * **Establish Connection**: The script first connects to the Fabric network. It builds the connection profile (CCP), connects to the Certificate Authority (CA) to enroll the admin and application user, and finally establishes a gateway connection to the network.
    * **Get Contract**: Once connected, it gets a reference to the `alertcontrol` smart contract on the `mychannel`.

    ```javascript
    const network = await gateway.getNetwork(channelName);
    contract = network.getContract(chaincodeName);
    ```
    * **Read and Parse YAML**:
    * The script reads the `alert-rules.yaml` file synchronously using `fs.readFileSync`.
    * It parses the file's text content into a JavaScript object using `yaml.load()`.

    ```javascript
    const fileContents = fs.readFileSync(path.join(__dirname, 'alert-rules.yaml'), 'utf8');
    const data = yaml.load(fileContents);
    ```
    * **Submit Transactions**:
    * The script iterates through each product and each rule within the `data` object.
    * For each rule, it calls the `contract.submitTransaction()` function, passing `'setRule'` as the name of the function to invoke, followed by all the necessary parameters (`productType`, `rule.propertyName`, etc.).
    * `submitTransaction` ensures the transaction is sent to peers, ordered, executed, and validated before returning, guaranteeing that the rule has been saved to the ledger.
   
    ```javascript
    await contract.submitTransaction(
        'setRule',
        productType,
        rule.propertyName,
        rule.condition,
        String(rule.value), 
        rule.alertMessage
    );
    ```
    * **Disconnect**: Finally, `gateway.disconnect()` cleanly closes the connection to the network.







