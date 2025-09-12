---
sidebar_position: 2
---

# Running Locally

Make sure to be in the current folder: `mmd-blockchain-agent/test-network`

```bash
./network.sh deployCC -ccn standardoliveoil \
  -ccp ../chaincode/tsp/javascript/standard-olive-oil-contract/chaincode \
  -ccv 1.0 \
  -ccl javascript \
  -ccs 1
```

Go to the application folder.

```bash
cd /mmd-blockchain-agent/chaincode/tsp/javascript/standard-olive-oil-contract/application
```

Load the rules using the auxiliar js file.

```bash
node load-standards.js
```