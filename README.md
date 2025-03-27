MMD Blockchain Agent, Copyright Télécom SudParis and Institut Mines-Télécom, developed by Michal Kit, Montassar Bellah Nagjmouchi and Maryline LAURENT, 2025, licenced under CC BY 4.0. 

## Building
Required: JDK 11, Fabric 2.2 binaries installed

Edit test-network/network.sh line 15 and set it to your binaries path

You might need to execute `docker pull --platform amd64 hyperledger/fabric-javaenv:2.2` if on Mac

## Running

Start network by `./startFabric.sh`
