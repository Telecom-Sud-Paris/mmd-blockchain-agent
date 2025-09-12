---
sidebar_position: 4
---

# Application

Two Node.js scripts are provided to interact with the `ProductContract`.

## Initialization Script (`init-products.js`)

* **Purpose**: A simple utility script to prepare the ledger.
* **Workflow**:
    1.  Connects to the Fabric network as a client.
    2.  Submits a single transaction to execute the `initLedger` function on the `product` chaincode.
    3.  Performs a query to verify that the initial data has been written successfully.

## Real-Time Listener (`app-listener.js`)

This application work as an off-chain integration, listening for and processing real-time data. It emulates locally the work the blockchain agent will be doing.

* **Purpose**: To act as a service that listens for messages from an MQTT broker and submits them as transactions to the blockchain.
* **Workflow**:
    1.  **Dual Connection**: Establishes and maintains connections to both the Fabric network and an MQTT broker.
    2.  **Subscribe**: Subscribes to all MQTT topics (`#`) to capture all incoming messages.
    3.  **Queue & Process**: Incoming messages are placed in a queue to ensure they are processed sequentially and to prevent race conditions.
    4.  **Submit Transactions**: For each message, the script:
        * Parses the message payload to extract the product data.
        * Calls `upsertProductProperty` on the `product` contract to save the data.
        * Calls `checkAlertRule` on the `alertcontrol` contract to immediately check for quality violations.
