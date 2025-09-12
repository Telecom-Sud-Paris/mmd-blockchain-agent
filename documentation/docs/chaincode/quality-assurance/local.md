---
sidebar_position: 2
---

# Running Locally
Make sure to be in the current folder: `mmd-blockchain-agent/test-network`

```bash
./network.sh deployCC -ccn qualityassurance \
  -ccp ../chaincode/tsp/javascript/quality-assurance-contract/chaincode \
  -ccv 1.0 \
  -ccl javascript \
  -ccs 1
```
Go to the application folder.

```bash
cd /mmd-blockchain-agent/chaincode/tsp/javascript/quality-assurance-contract/application
```

Run the auxiliar js file for honey QA.

```bash
node honey-qa.js
```

Run the auxiliar js file for olive oil QA.

```bash
node olive-oil-qa.js
```