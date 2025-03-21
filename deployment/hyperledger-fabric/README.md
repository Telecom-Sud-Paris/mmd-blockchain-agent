# 🚀 Deploying Hyperledger Fabric Using Helm Charts (Single Shared Orderer)

This guide explains how to deploy a multi-organization **Hyperledger Fabric network** using **Helm charts** with a **single shared orderer**, across namespaces, using a remote Kubernetes cluster accessed via SSH port forwarding.

---

## 📌 Prerequisites

- `kubectl` installed on your **local laptop**
- Helm installed on your **server** and/or locally
- A Kubernetes cluster (e.g., Minikube or K3s) set up on the **remote server**
- Git clone of [Hyperledger Bevel](https://github.com/hyperledger/bevel)

---

## 📡 Step 0: Access Remote Cluster from Local Laptop

Forward the Kubernetes API server locally using SSH:

```bash
ssh -L 9443:192.168.49.2:8443 box@<server-ip> -N -f
```

Then configure `kubectl` to use the forwarded port:

```bash
kubectl config set-cluster remote --server=https://localhost:9443 --insecure-skip-tls-verify=true
kubectl config set-context remote --cluster=remote --user=default
kubectl config use-context remote
```

---

## 🧭 Step 1: Define the Network Topology

We'll deploy 3 organizations:

- `food-processor` (Orderer + Peers)
- `food-producer` (Peers only)
- `transporter` (Peers only)

### ✅ One orderer only:
- `orderer1` is shared across all channels

### ✅ Three private channels:
- `food-processor-channel`
- `food-producer-channel`
- `transporter-channel`

---

## 📁 Step 2: Update `genesis.yaml`

Location: `charts/values/noproxy-and-novault/genesis.yaml`

```yaml
global:
  version: 2.5.4
  serviceAccountName: vault-auth
  cluster:
    provider: minikube
    cloudNativeServices: false
  vault:
    type: disabled
  proxy:
    provider: none
    externalUrlSuffix: food-processor

organizations:
  - name: food-processor
    orderers:
      - name: orderer1
        ordererAddress: orderer1.food-processor:7050
    peers:
      - name: peer1
        peerAddress: peer1.food-processor:7051
      - name: peer2
        peerAddress: peer2.food-processor:7051

  - name: food-producer
    peers:
      - name: peer0
        peerAddress: peer0.food-producer:7051

  - name: transporter
    peers:
      - name: peer3
        peerAddress: peer3.transporter:7051

consensus: raft
channels:
  - name: food-processor-channel
    consortium: FoodProcessorConsortium
    orderers:
      - orderer1
    participants:
      - food-processor

  - name: food-producer-channel
    consortium: FoodProducerConsortium
    orderers:
      - orderer1
    participants:
      - food-producer

  - name: transporter-channel
    consortium: TransporterConsortium
    orderers:
      - orderer1
    participants:
      - transporter

settings:
  removeConfigMapOnDelete: true
```

---

## 🛠 Step 3: Deploy CA Servers

### 📂 CA Helm Values for `food-processor` (`ca-food-processor.yaml`):
```yaml
global:
  serviceAccountName: vault-auth
  cluster:
    provider: minikube
    cloudNativeServices: false
  vault:
    type: disabled
  proxy:
    provider: none
    externalUrlSuffix: food-processor

storage:
  storageClass: "standard"
  size: 512Mi

server:
  removeCertsOnDelete: true
  tlsStatus: true
  adminUsername: food-processor-admin
  adminPassword: food-processor-adminpw
  subject: "/C=GB/ST=London/L=London/O=Food Processor"
```

Deploy it:
```bash
helm install food-processor-ca charts/fabric-ca-server \
  --namespace food-processor --create-namespace \
  --values charts/values/noproxy-and-novault/ca-food-processor.yaml
```

Repeat this step for `food-producer` and `transporter` with corresponding values.

---

## 🏗 Step 4: Deploy the Single Orderer

Use the same `orderer.yaml` values for all channels (only one orderer is needed):
```bash
helm install orderer1 charts/fabric-orderernode \
  --namespace food-processor \
  --values charts/values/noproxy-and-novault/orderer.yaml
```

---

## 🔄 Step 5: Deploy Peers for Each Org

Example for peer1 in `food-processor`:
```bash
helm install peer1 charts/fabric-peernode \
  --namespace food-processor \
  --values charts/values/noproxy-and-novault/peer.yaml
```

Repeat for `peer2`, `peer0` (in `food-producer`), and `peer3` (in `transporter`).

---

## ⚙ Step 6: Generate Genesis Block

```bash
helm install genesis charts/fabric-genesis \
  --namespace food-processor \
  --values charts/values/noproxy-and-novault/genesis.yaml
```

---

## 📡 Step 7: Create Channels

```bash
helm install food-processor-channel charts/fabric-osnadmin-channel-create \
  --namespace food-processor \
  --set global.vault.type=disabled \
  --set channel.name=food-processor-channel

helm install food-producer-channel charts/fabric-osnadmin-channel-create \
  --namespace food-processor \
  --set global.vault.type=disabled \
  --set channel.name=food-producer-channel

helm install transporter-channel charts/fabric-osnadmin-channel-create \
  --namespace food-processor \
  --set global.vault.type=disabled \
  --set channel.name=transporter-channel
```

---

## ✅ DONE!
You now have:
- One shared orderer (`orderer1`)
- Three orgs with their own peers and CAs
- Three channels (one per org), ready for peers to join

📌 Later, you can use `fabric-channel-join` to join additional peers to channels.

---

For help, visit: https://github.com/hyperledger-bevel

