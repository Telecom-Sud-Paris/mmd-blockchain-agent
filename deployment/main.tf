terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2.1"
    }
  }
}

provider "null" {}

resource "null_resource" "install_minikube" {
  connection {
    type        = "ssh"
    host        = "157.159.68.112"
    user        = "box"
    private_key = file("C:\\Users\\Amine\\.ssh\\id_rsa") 
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
    host        = "157.159.68.112"
    user        = "box"
    private_key = file("C:\\Users\\Amine\\.ssh\\id_rsa") 
  }

  provisioner "remote-exec" {
    inline = [
      "kubectl create namespace fabric || true",
      "kubectl apply -f ~/fabric-deployment.yaml",
      "kubectl get pods -n fabric"
    ]
  }
}
