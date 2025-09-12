---
sidebar_position: 1
---

# Local Setup

## Steps
- JDK 11:
    1. `java -version` (if different lower than 11, do the steps below)
    2. `sudo apt update`
    3. `sudo apt install openjdk-11-jdk`

- Fabric 2.2:
1. 
    ```
    curl -sSLO 
    https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh 
    && chmod +x install-fabric.sh
    ```
2. `./install-fabric.sh --fabric-version 2.2.13 binary`

## Building
Required: JDK 11, Fabric 2.2 binaries installed, nvm 18

You might need to execute `docker pull --platform amd64 hyperledger/fabric-javaenv:2.2` if on Mac

## Running

Start network by running `./startFabric.sh`

Bring network down by running `./networkDown.sh`

## Documentation
To run the documentation website locally, do the following.

1. `cd documentation`
2. `nvm use 18`
3. `npm start`

### Useful commands
`export PATH=${PWD}/../bin:$PATH`

`export FABRIC_CFG_PATH=$PWD/../config/`

```bash
# Environment variables for Org1
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C mychannel -n property --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" -c '{"function":"initLedger","Args":[]}'

```