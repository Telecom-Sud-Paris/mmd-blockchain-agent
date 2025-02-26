terraform {
  required_providers {
    null = {
      source = "hashicorp/null"
      version = "~> 3.2.1"
    }
  }
}

provider "null" {}

resource "null_resource" "install_minikube" {
  provisioner "local-exec" {
    command = <<EOT
      echo "Updating system..."
      sudo apt update && sudo apt upgrade -y

      echo "Installing dependencies..."
      sudo apt install -y curl wget apt-transport-https

      echo "Installing Minikube..."
      curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
      sudo install minikube-linux-amd64 /usr/local/bin/minikube

      echo "Installing kubectl..."
      curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
      sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

      echo "Starting Minikube..."
      minikube start --driver=docker
    EOT
  }
}
