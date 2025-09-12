---
sidebar_position: 1
---

# Overview

This project introduces an **auditor** smart contract (`QualityAssuranceContract`) designed to run on a Hyperledger Fabric network. Its primary function is to automatically verify if a product's tracked properties, stored by the `ProductContract`, comply with the rules defined in a corresponding standards contract (e.g., `StandardHoneyContract`, `StandardOliveOilContract`).

Upon successful verification of a product's supply chain phase, the contract issues a **Verifiable Credential (VC)**, creating an immutable, on-chain proof of compliance. This system relies heavily on **inter-chaincode invocation**, acting as a central verification hub that communicates with other contracts to gather the necessary data for its analysis. A VC is created for each phase that meets the standards criteria, therefore the phase have independecy.

The system is composed of two main components:
* **`QualityAssuranceContract.js`**: The smart contract that contains the logic for auditing product data, comparing it against standards, and issuing credentials.
* **`honey-qa.js`** and  **`olive-oil-qa.js`**: A client application script used to trigger the end-to-end compliance verification for a specific product and display a detailed report.

---

