
# 📘 Hyperledger Fabric Deployment using Helm Charts on Minikube

## 🧾 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cluster Setup (Minikube)](#cluster-setup-minikube)
3. [Directory Structure](#directory-structure)
4. [Helm Dependencies](#helm-dependencies)
5. [Step-by-Step Deployment](#step-by-step-deployment)
   - [1. Deploy Certificate Authority (CA)](#1-deploy-certificate-authority-ca)
   - [2. Deploy Orderer Node](#2-deploy-orderer-node)
   - [3. Deploy Peers](#3-deploy-peers)
   - [4. Generate Genesis Block](#4-generate-genesis-block)
   - [5. Create Channels](#5-create-channels)
   - [6. Join Peers to Channels](#6-join-peers-to-channels)
6. [Validation Steps](#validation-steps)

7. [Conclusion](#conclusion)

---

## 📍 Prerequisites

- Ubuntu 20.04 or later
- Docker (v28+)
- Helm (v3.11+)
- Minikube (latest)
- Git
- Sufficient hardware resources (see below)

## 💻 Cluster Setup (Minikube)

```bash
minikube delete
minikube start --cpus=6 --memory=12288 --disk-size=60g
```

## 📁 Directory Structure

```bash
mmd-blockchain-agent/
├── deployment/
│   ├── platforms/
│   │   ├── shared/
│   │   └── hyperledger-fabric/
│   │       ├── charts/
│   │       ├── values/
│   │       └── files/
```

## 🛠 Helm Dependencies

```bash
helm dependency build charts/fabric-ca-server
helm dependency build charts/fabric-orderernode
helm dependency build charts/fabric-peernode
helm dependency build charts/fabric-genesis
helm dependency build charts/fabric-osnadmin-channel-create
helm dependency build charts/fabric-channel-join
```

## 🚀 Step-by-Step Deployment

### 1. Deploy Certificate Authority (CA)

```bash
helm upgrade --install supplychain-ca charts/fabric-ca-server \
  --namespace supplychain-net \
  --create-namespace \
  --values charts/values/noproxy-and-novault/ca-orderer.yaml
```

### 2. Deploy Orderer Node

```bash
helm upgrade --install orderer1 charts/fabric-orderernode \
  --namespace supplychain-net \
  --values charts/values/noproxy-and-novault/orderer.yaml
```

### 3. Deploy Peers

```bash
helm upgrade --install peer0 charts/fabric-peernode \
  --namespace supplychain-net \
  --values charts/values/noproxy-and-novault/peer.yaml

helm upgrade --install peer1 charts/fabric-peernode \
  --namespace supplychain-net \
  --values charts/values/noproxy-and-novault/peer.yaml \
  --set peer.gossipPeerAddress=peer0.supplychain-net:7051 \
  --set peer.cliEnabled=true \
  --set certs.settings.createConfigMaps=false

helm upgrade --install peer2 charts/fabric-peernode \
  --namespace supplychain-net \
  --values charts/values/noproxy-and-novault/peer.yaml \
  --set peer.gossipPeerAddress=peer1.supplychain-net:7051 \
  --set peer.cliEnabled=true \
  --set certs.settings.createConfigMaps=false
```

### 4. Generate Genesis Block

```bash
kubectl -n supplychain-net get secret admin-msp -o json > charts/fabric-genesis/files/supplychain.json
# For peer0 in supplychain-net
kubectl --namespace supplychain-net get configmap peer0-msp-config -o json > supplychain-peer0-config-file.json

# For peer1 in supplychain-net
kubectl --namespace supplychain-net get configmap peer1-msp-config -o json > supplychain-peer1-config-file.json

# For peer2 in supplychain-net
kubectl --namespace supplychain-net get configmap peer2-msp-config -o json > supplychain-peer2-config-file.json

helm install genesis charts/fabric-genesis \
  --namespace supplychain-net \
  --values charts/values/noproxy-and-novault/genesis.yaml
```

### 5. Create Channels

```bash
helm install channel1 charts/fabric-osnadmin-channel-create \
  --namespace supplychain-net --set global.vault.type=disabled --set channel.name=channel1

helm install channel2 charts/fabric-osnadmin-channel-create \
  --namespace supplychain-net --set global.vault.type=disabled --set channel.name=channel2

helm install channel3 charts/fabric-osnadmin-channel-create \
  --namespace supplychain-net --set global.vault.type=disabled --set channel.name=channel3
```

### 6. Join Peers to Channels

```bash
helm install peer0-channel1 charts/fabric-channel-join --namespace supplychain-net \
  --set peer.name=peer0 --set peer.address=peer0.supplychain-net:7051 --set peer.channelName=channel1

helm install peer0-channel3 charts/fabric-channel-join --namespace supplychain-net \
  --set peer.name=peer0 --set peer.address=peer0.supplychain-net:7051 --set peer.channelName=channel3

helm install peer1-channel1 charts/fabric-channel-join --namespace supplychain-net \
  --set peer.name=peer1 --set peer.address=peer1.supplychain-net:7051 --set peer.channelName=channel1

helm install peer1-channel2 charts/fabric-channel-join --namespace supplychain-net \
  --set peer.name=peer1 --set peer.address=peer1.supplychain-net:7051 --set peer.channelName=channel2

helm install peer2-channel2 charts/fabric-channel-join --namespace supplychain-net \
  --set peer.name=peer2 --set peer.address=peer2.supplychain-net:7051 --set peer.channelName=channel2

helm install peer2-channel3 charts/fabric-channel-join --namespace supplychain-net \
  --set peer.name=peer2 --set peer.address=peer2.supplychain-net:7051 --set peer.channelName=channel3
```

## ✅ Validation Steps

```bash
kubectl get pods -n supplychain-net
kubectl exec -it -n supplychain-net deploy/peer1-cli -- bash
peer channel list
```



## ✅ Conclusion

This documentation outlines the complete setup of a Fabric network with 1 CA, 1 Orderer, and 3 Peers across 3 channels using Helm on Minikube. Perfect base for future chaincode and app integration.