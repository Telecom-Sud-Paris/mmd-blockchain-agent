---
sidebar_position: 4
---

# Application

This Node.js script provides a simple way to initiate and review the quality assurance process from outside the blockchain network.

* **Purpose**: To trigger a full product compliance verification and display the results in a human-readable format.

## Honey QA
* **Workflow**:
    1.  **Connect**: Establishes a connection to the Fabric network.
    2.  **Invoke**: Submits a single transaction to the `verifyProductCompliance` function on the `QualityAssuranceContract`. It specifies the product to check (`honey-001`) and the standards contract to use (`standardhoney`).
    3.  **Display Report**: Receives the JSON report from the chaincode, parses it, and prints a detailed, phase-by-phase summary to the console. The report clearly indicates if a phase was `APPROVED` (and shows the credential) or `REJECTED` (and lists the violations).

---