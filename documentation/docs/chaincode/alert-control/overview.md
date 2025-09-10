---
sidebar_position: 1
---
# Overview

This project implements a smart contract on a Hyperledger Fabric network designed to manage and check quality control rules for various products. It allows administrators to define specific conditions for product properties (e.g., temperature, humidity). If a product's property value violates a predefined rule, the system triggers an alert.

The system is composed of three main components:
1.  **`AlertControlContract.js`**: The chaincode (smart contract) that contains the business logic for setting, querying, and checking rules on the blockchain ledger.
2.  **`alert-rules.yaml`**: A configuration file used to define the specific alert rules for different products and their properties.
3.  **`load-rules.js`**: A client-side script to read the rules from `alert-rules.yaml` and submit them as transactions to the blockchain via the smart contract.

---
