---
sidebar_position: 1
---

# Overview

This project provides a Hyperledger Fabric smart contract for managing and versioning the quality control standards for olive oil. It allows administrators to define, update, and query specific quality parameters for each stage of the production process, from cultivation to the final product.

The system is composed of three main components:
* **`StandardOliveOilContract.js`**: The smart contract containing the business logic for managing the standards on the ledger.
* **`olive-oil-standards.yaml`**: A human-readable configuration file that defines the quality standards for olive oil.
* **`load-standards.js`**: A client-side script to read the standards from the YAML file and submit them to the blockchain.

---
