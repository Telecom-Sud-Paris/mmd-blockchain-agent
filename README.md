## Building
Required: JDK 11, Fabric 2.2 binaries installed

Edit test-network/network.sh line 15 and set it to your binaries path

You might need to execute `docker pull --platform amd64 hyperledger/fabric-javaenv:2.2` if on Mac

## Running

Start network by `./startFabric.sh`