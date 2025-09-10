/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// =========== modules ===========
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../../../../test-application/javascript/CAUtil.js'); 
const { buildCCPOrg1, buildWallet } = require('../../../../../test-application/javascript/AppUtil.js'); 

// =========== config FABRIC ===========
const channelName = 'mychannel';
const chaincodeName = 'product';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'testUser1';


function prettyJSONString(inputString) {
    const obj = typeof inputString === 'string' ? JSON.parse(inputString) : inputString;
    return JSON.stringify(obj, null, 2);
}

async function main() {
    let gateway;

    try {
        // Fabric network connection
        console.log('Initializing Fabric connection...');

        const ccp = buildCCPOrg1();
        const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');
        const wallet = await buildWallet(Wallets, walletPath);

        await enrollAdmin(caClient, wallet, mspOrg1);
        await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: org1UserId,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);
        console.log('Fabric connection successful. Contract object is ready.');
        
        console.log('\n--> Submitting transaction: initLedger');
        await contract.submitTransaction('initLedger');
        console.log('--> Transaction "initLedger" has been submitted');
        
        console.log('\n--> Evaluating transaction: queryProductProperties');
        let response = await contract.evaluateTransaction('queryProductProperties', 'honey', 'honey-001');
        console.log('--> Transaction "queryProductProperties" has been evaluated');
        
        console.log(`\nResponse: ${prettyJSONString(response.toString())}`);
        
    } catch (error) {
        console.error(`\n******** FAILED to run application: ${error}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1); 
    } finally {
        // --- disconnection ---
        console.log('\nShutting down...');
        if (gateway) {
            gateway.disconnect();
        }
    }
}

main();