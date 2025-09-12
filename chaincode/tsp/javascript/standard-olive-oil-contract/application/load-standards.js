/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../../../../test-application/javascript/CAUtil.js'); 
const { buildCCPOrg1, buildWallet } = require('../../../../../test-application/javascript/AppUtil.js'); 

const channelName = 'mychannel';
const chaincodeName = 'standardoliveoil';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUserOliveOilStandard';

function prettyJSONString(inputString) {
    const obj = typeof inputString === 'string' ? JSON.parse(inputString) : inputString;
    return JSON.stringify(obj, null, 2);
}

async function main() {
    let gateway;
    try {
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

        console.log('\n--> Submitting transaction: initLedger');
        await contract.submitTransaction('initLedger');
        console.log('--> "initLedger" transaction has been submitted successfully.');

        console.log('\nLoading standards from olive-oil-standards.yaml...');
        const fileContents = fs.readFileSync(path.join(__dirname, 'olive-oil-standards.yaml'), 'utf8');
        const standards = yaml.load(fileContents);
        
        console.log('\n--> Submitting transaction: setStandards');
        const responseBuffer = await contract.submitTransaction(
            'setStandards', 
            JSON.stringify(standards)
        );
        
        console.log('\nStandards successfully loaded. Response:');
        console.log(prettyJSONString(responseBuffer.toString()));

    } catch (error) {
        console.error('\nFailed to load standards:', error);
        process.exit(1);
    } finally {
        if (gateway) {
            gateway.disconnect();
        }
    }
}

main();