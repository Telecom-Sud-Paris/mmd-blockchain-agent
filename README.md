MMD Blockchain Agent, Copyright Télécom SudParis and Institut Mines-Télécom, developed by Michal Kit, Montassar Bellah Nagjmouchi and Maryline LAURENT, 2025, licenced under CC BY 4.0. 

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