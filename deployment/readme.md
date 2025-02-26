# Terraform Minikube Setup

## Overview
This documentation provides instructions on how to use Terraform to install Minikube on an Ubuntu server ("the Box"). This setup automates the installation of Minikube, Kubernetes tools, and their dependencies.

## Prerequisites

### On Your Local Machine (Laptop)
Ensure you have the following installed before running Terraform:

1. **SSH access to the Ubuntu server**
   - Test the SSH connection:
     ```bash
     ssh your-username@your-server-ip
     ```

2. **Terraform installed**
   - Download from [Terraform official site](https://developer.hashicorp.com/terraform/downloads)
   - Or install via CLI:
     ```bash
     sudo apt update && sudo apt install -y terraform
     ```
   - Verify installation:
     ```bash
     terraform -version
     ```

### On the Ubuntu Server (Box)
Ensure the following are installed:

1. **Ubuntu 20.04+ or 22.04+**
2. **Docker installed** (required for Minikube):
   ```bash
   sudo apt install -y docker.io
   ```

## How to Run the Terraform Script

### 1️⃣ Clone the Repository
On your **local laptop**, run:
```bash
git clone https://github.com/Telecom-Sud-Paris/blockchain-agent.git
cd your-repo
```

### 2️⃣ Switch to the Correct Branch
```bash
git checkout minikube-terraform-setup
```

### 3️⃣ Initialize Terraform
Before applying the configuration, initialize Terraform:
```bash
terraform init
```

### 4️⃣ Apply the Terraform Configuration
Run the following command to install Minikube:
```bash
terraform apply -auto-approve
```
Terraform will:
- Update the system
- Install required dependencies
- Install Minikube and `kubectl`
- Start Minikube using the Docker driver

### 5️⃣ Verify Minikube Installation
Once Terraform finishes, verify that Minikube is running:
```bash
kubectl get nodes
```
You should see the Minikube node in "Ready" status.

## Cleanup
To remove Minikube and revert changes, run:
```bash
terraform destroy -auto-approve
```

## Troubleshooting

- **Terraform command not found?** Ensure Terraform is installed:
  ```bash
  terraform -version
  ```
- **Minikube not starting?** Check logs:
  ```bash
  minikube logs
  ```
- **Docker not running?** Restart Docker:
  ```bash
  sudo systemctl restart docker
  ```


