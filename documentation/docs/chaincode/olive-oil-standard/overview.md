---
sidebar_position: 1
---

# Overview

This project provides a Hyperledger Fabric smart contract for managing and versioning quality control standards for honey throughout its supply chain. The system allows for the initialization, bulk setting, and granular updating of quality parameters across various phases like transportation, beekeeping, and processing.

The primary components are:
* **`StandardHoneyContract.js`**: The smart contract (chaincode) containing the business logic for managing honey standards on the ledger.
* **`honey-standards.yaml`**: A configuration file that defines the specific quality standards for honey, such as maximum temperature and minimum hive health scores.
* **`load-standards.js`**: A client-side script that reads the standards from the YAML file and submits them to the blockchain via the smart contract.