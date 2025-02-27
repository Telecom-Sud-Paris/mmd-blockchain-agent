# Terraform Minikube & Hyperledger Fabric Deployment

## Overview
This documentation provides a step-by-step guide on how to use Terraform to:

1. Install **Minikube** on a remote **Ubuntu Box**.
2. Deploy **Hyperledger Fabric** inside the Minikube cluster.
3. Run Terraform from a **Windows laptop** while provisioning the infrastructure on a remote server.

## Prerequisites

### **On Windows Laptop (Control Machine)**
Ensure the following are installed:

1. **Terraform** - [Download Terraform](https://developer.hashicorp.com/terraform/downloads)
   ```powershell
   terraform -version
   ```

2. **OpenSSH (for SSH connectivity)**
   ```powershell
   Get-Service ssh-agent
   Start-Service ssh-agent
   ```

3. (Optional) **Minikube** for local testing - [Minikube Installation](https://minikube.sigs.k8s.io/docs/start/)

### **On Ubuntu Box (Deployment Server)**
Ensure the following are installed:

1. **Ubuntu Server 20.04+ or 22.04+**
2. **Docker installed** (required for Minikube):
   ```bash
   sudo apt update
   sudo apt install -y docker.io
   ```
3. **Enable SSH Access**
   ```bash
   sudo systemctl enable ssh
   sudo systemctl start ssh
   ```
4. **Kubernetes tools (kubectl & Minikube)**
   ```bash
   curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
   sudo install minikube-linux-amd64 /usr/local/bin/minikube
   
   curl -LO https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl
   sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
   ```

## SSH Access Configuration

### **1. Generate SSH Key (If Not Already Created)**
```powershell
ssh-keygen -t rsa -b 4096 -f C:\Users\your-username\.ssh\id_rsa
```

### **2. Copy SSH Key to Ubuntu Box**
```powershell
scp C:\Users\your-username\.ssh\id_rsa.pub your-username@your-box-ip:~/
```

### **3. Add SSH Key to Ubuntu Authorized Keys**
```bash
mkdir -p ~/.ssh
cat ~/id_rsa.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

✅ **Test SSH Connection from Windows:**
```powershell
ssh your-username@your-box-ip
```

## Setting Up Terraform

### **1. Clone the Repository**
```powershell
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### **2. `main.tf` for Remote Provisioning**
Ensure Terraform executes remotely on the Ubuntu Box.

```hcl
provider "null" {}

resource "null_resource" "install_minikube" {
  connection {
    type        = "ssh"
    host        = "your-box-ip"
    user        = "your-username"
    private_key = file("C:\\Users\\your-username\\.ssh\\id_rsa")
  }

  provisioner "remote-exec" {
    inline = [
      "sudo apt update && sudo apt upgrade -y",
      "sudo apt install -y curl wget apt-transport-https",
      "curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64",
      "sudo install minikube-linux-amd64 /usr/local/bin/minikube",
      "curl -LO https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl",
      "sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl",
      "minikube start --driver=docker"
    ]
  }
}

resource "null_resource" "deploy_hyperledger_fabric" {
  depends_on = [null_resource.install_minikube]

  connection {
    type        = "ssh"
    host        = "your-box-ip"
    user        = "your-username"
    private_key = file("C:\\Users\\your-username\\.ssh\\id_rsa")
  }

  provisioner "remote-exec" {
    inline = [
      "kubectl create namespace fabric || true",
      "kubectl apply -f ~/fabric-deployment.yaml",
      "kubectl get pods -n fabric"
    ]
  }
}
```

## Creating Hyperledger Fabric Deployment File
On the **Ubuntu Box**, we create the Fabric YAML file:

```bash
nano ~/fabric-deployment.yaml
```


```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fabric-peer
  namespace: fabric
spec:
  replicas: 1
  selector:
    matchLabels:
      app: fabric-peer
  template:
    metadata:
      labels:
        app: fabric-peer
    spec:
      containers:
        - name: peer
          image: hyperledger/fabric-peer:latest
          ports:
            - containerPort: 7051
```

## Running Terraform from Windows

### **1. Initialize Terraform**
```powershell
terraform init
```

### **2. Apply Terraform Configuration**
```powershell
terraform apply -auto-approve
```

✅ **Terraform will:**
- Install Minikube on the Ubuntu Box.
- Deploy Hyperledger Fabric inside Minikube.

### **3. Verify Deployment**
SSH into the **Ubuntu Box**:
```powershell
ssh your-username@your-box-ip
```
Check if Hyperledger Fabric is running:
```bash
kubectl get pods -n fabric
```
✅ **Expected Output:**
```
NAME          READY   STATUS    RESTARTS   AGE
fabric-peer   1/1     Running   0          30s
```

## Summary of Steps
| Step | Action |
|------|--------|
| **1️⃣** | Install Terraform & SSH on Windows |
| **2️⃣** | Configure SSH Access to Ubuntu Box |
| **3️⃣** | Modify Terraform Script (`main.tf`) |
| **4️⃣** | Create Hyperledger Fabric YAML (`fabric-deployment.yaml`) |
| **5️⃣** | Run `terraform apply` from Windows |
| **6️⃣** | Verify Minikube & Fabric deployment |

✅ **Now Terraform successfully provisions Minikube & Hyperledger Fabric from Windows! 🚀**

