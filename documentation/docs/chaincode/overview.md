---
sidebar_position: 1
---

# Chaincode Overview

## Introduction

This section provides comprehensive documentation for all chaincodes in the More Med Diet blockchain project. Each chaincode serves a specific purpose in the supply chain and quality assurance process.

`(...)/mmd-blockchain-agent/chaincode/tsp/javascript`

## Chaincode Installation and Packaging

To deploy and run our smart contracts locally, use the following commands for each contract.

### General Command Syntax
```bash
./network.sh deployCC -ccn <package_name> 
  -ccp <path_to_chaincode> 
  -ccv <version> 
  -ccl <language>
  -ccs <sequence>
```

## Available Chaincodes

- Alert Conctract
Manages alert notifications and rules.

```bash
./network.sh deployCC -ccn alertcontrol \
  -ccp ../chaincode/tsp/javascript/alert-control-contract/chaincode \
  -ccv 1.0 \
  -ccl javascript \
  -ccs 1
```

- Product Contract
Handles product information.


```bash
./network.sh deployCC -ccn product \
  -ccp ../chaincode/tsp/javascript/product-contract/chaincode \
  -ccv 1.0 \
  -ccl javascript \
  -ccs 1
```

- Standard Honey Contract
Manages honey standardization and certification processes.


```bash
./network.sh deployCC -ccn standardhoney \
  -ccp ../chaincode/tsp/javascript/standard-honey-contract/chaincode \
  -ccv 1.0 \
  -ccl javascript \
  -ccs 1
```

- Quality Assurance Contract
Handles quality checks and compliance verification.

```bash
./network.sh deployCC -ccn qualityassurance \
  -ccp ../chaincode/tsp/javascript/quality-assurance-contract/chaincode \
  -ccv 1.0 \
  -ccl javascript \
  -ccs 1
```

## Chaincode Update Procedure

### When to Update
- After making changes to the chaincode source code
- When encountering deployment errors
- When adding new functionality

### Update Command Example
```bash
./network.sh deployCC -ccn qualityassurance \
  -ccp ../chaincode/tsp/javascript/quality-assurance-contract/chaincode \
  -ccv 1.1 \
  -ccl javascript \
  -ccs 2
```
### Versioning Guidelines
- Increment the version number (-ccv) for each update
- Increment the sequence number (-ccs) for each deployment attempt
- Follow semantic versioning (MAJOR.MINOR.PATCH) for significant changes

## Troubleshooting Common Issues
### Deployment Failures
1. Error: Chaincode already exists
Solution: Increase version and sequence numbers
2. Error: Path not found
Solution: Verify the chaincode path exists
3. Error: Syntax errors
Solution: Test chaincode locally before deployment

### Best Practices
- Always test chaincode changes in a development environment first
- Maintain consistent versioning across all chaincodes
- Document all changes in the respective chaincode documentation
- Keep deployment scripts in version control