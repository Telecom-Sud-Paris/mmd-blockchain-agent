---
sidebar_position: 3
---

# Chaincode 

This contract is the core of the automated quality assurance system. It does not store product data itself; instead, it reads from other contracts to perform its verification logic.

## Architectural Pattern: The Auditor

The `QualityAssuranceContract` acts as a decentralized auditor. Its key responsibilities are:
* **Data Aggregation**: It invokes the `ProductContract` to fetch all recorded properties for a specific product.
* **Standards Retrieval**: It invokes a designated standards contract (e.g., `standardhoney`) to get the quality rules for each phase.
* **Compliance Logic**: It compares the aggregated product data against the retrieved standards.
* **Credential Issuance**: It generates and stores a verifiable credential on the ledger for each phase that successfully passes verification.

## Contract Functions

### Write Functions

**`async verifyProductCompliance(ctx, productType, productId, chaincodeName)`**
* **Purpose**: The main entry point for running a full compliance check on a product.
* **Workflow**:
    1.  Invokes `productContract` to get all properties for the given `productId`.
    2.  Identifies all unique supply chain phases from the product's history (e.g., 'beekeeping', 'transportation').
    3.  Iterates through each phase, calling `verifyPhaseCompliance` to perform a detailed check for each one.
    4.  Aggregates the results from all phases into a comprehensive report and returns it to the client.

**`async verifyPhaseCompliance(ctx, productType, productId, phase, chaincodeName)`**
* **Purpose**: Performs a compliance check for a single, specific phase of a product's lifecycle.
* **Logic**:
    1.  Fetches the product's property data for the specified `phase` from the `product` contract.
    2.  Fetches the quality standards for that same `phase` from the standards contract (`chaincodeName`).
    3.  Runs the `_checkCompliance` logic, which compares the actual values against the standard's `min`, `max`, and `required` rules.
    4.  If compliant, it calls `_issueCredential` to generate and save a VC.
    5.  If not compliant, it compiles a list of all violations.

### Query Functions

**`async queryPhaseCredential(ctx, productType, productId, phase)`**
* **Purpose**: Allows a client to retrieve a previously issued Verifiable Credential for a specific product and phase.

## Verifiable Credentials (VCs)

A key feature of this contract is the issuance of W3C Verifiable Credential-like JSON objects.

* **Issuance**: When a product phase is verified as compliant, the `_issueCredential` function is triggered.
* **Content**: The VC contains crucial information, including the issuer (the chaincode identity), issuance date, the product ID, the compliant phase, and a proof value linked to the blockchain transaction ID.
* **Immutability**: Storing this credential on the ledger provides an immutable, tamper-proof record of quality assurance that can be trusted by all participants in the supply chain.

---