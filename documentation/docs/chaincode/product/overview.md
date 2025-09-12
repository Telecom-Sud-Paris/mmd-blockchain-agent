---
sidebar_position: 1
---

# Overview

This project implements a Hyperledger Fabric smart contract (`ProductContract`) designed to track and manage individual properties of products throughout their lifecycle. It serves as a digital log for data points, such as sensor readings from IoT devices.

The system features an **inter-chaincode invocation** mechanism, where this contract calls the `AlertControlContract` to check for quality violations in real-time as new data is recorded.

The ecosystem includes three main components:
* **`ProductContract.js`**: The smart contract responsible for creating, updating, and querying product properties on the ledger.
* **`init-products.js`**: A one-time setup script to initialize the ledger with sample product data.
* **`app-listener.js`**: A persistent client application that acts as a bridge between an **MQTT message broker** and the Fabric network, processing real-time data streams. (emulates locally the work of the blockchain agent)

---