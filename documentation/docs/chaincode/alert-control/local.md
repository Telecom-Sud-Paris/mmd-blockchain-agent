---
sidebar_position: 2
---

# Running Locally

Go to the application folder.

```bash
cd /mmd-blockchain-agent/chaincode/tsp/javascript/alert-control-contract/application
```

Load the rules using the auxiliar js file.

```bash
node load-rules.js
```

## Testing

For testing the chaincode functions you can run the auxiliar js code, which is easier than calling it through bash.

```bash
node testing.js
```

### Example

```javascript
 const check = await contract.submitTransaction('checkAlertRule',
            'honey', 'temperature', 35);
console.log(`*** Result: ${check.toString()}`);

const allRules = await contract.evaluateTransaction("queryAllRules");
console.log(`*** All Rules: ${prettyJSONString(allRules.toString())}`);
```