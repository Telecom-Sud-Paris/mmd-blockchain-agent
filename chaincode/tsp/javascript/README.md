# Running the contracts

### Package the smart contract
```
./network.sh deployCC -ccn <package_name> -ccp <path_to_chaincode> -ccv 1.0 -ccl javascript -ccs 1

Ex: ./network.sh deployCC -ccn product -ccp ../chaincode/tsp/javascript/product-contract/chaincode -ccv 1.0 -ccl javascript -ccs 1
```

In testing.js, we have 
```
const chaincodeName = 'product';
```
that needs to be equal to the <package_name> you defined.

If you change something on the chaincode, you need to do the process again. But changing the version.
```
Ex: ./network.sh deployCC -ccn product -ccp ../chaincode/tsp/javascript/product-contract/chaincode -ccv 2.0 -ccl javascript -ccs 2
```
### Testing
To test the contract you can run one of the codes in the application folder.

Just put here the function you want to invoke and the inputs required. (testing.js line 65)
```
const commit = await contract.submitTransaction(
            'queryAllProducts'
        )
```
In this case the function receives no parameters, so its only the function name.
