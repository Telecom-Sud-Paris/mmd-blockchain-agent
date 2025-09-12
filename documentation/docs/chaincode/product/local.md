---
sidebar_position: 2
---

# Running Locally
Make sure to be in the current folder: `mmd-blockchain-agent/test-network`

```bash
./network.sh deployCC -ccn product \
  -ccp ../chaincode/tsp/javascript/product-contract/chaincode \
  -ccv 1.0 \
  -ccl javascript \
  -ccs 1
```
Go to the application folder.

```bash
cd /mmd-blockchain-agent/chaincode/tsp/javascript/product-contract/application
```

Init the ledger with some products.

```bash
node init-product.js
```

