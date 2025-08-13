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
const chaincodeName = 'standardhoney';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUserHoneyStandard';

function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
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

        console.log('Loading standards from honey-standards.yaml...');
        const fileContents = fs.readFileSync(path.join(__dirname, 'honey-standards.yaml'), 'utf8');
        const standards = yaml.load(fileContents);
        
        const network = await gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);
        
        const init = await contract.submitTransaction('initLedger');
		console.log(`Init Ledger Response: ${prettyJSONString(init.toString())}`);
        
        console.log('Submitting standards to blockchain...');
        const response = await contract.submitTransaction(
            'setStandards', 
            JSON.stringify(standards)
        );
        
        console.log('Standards successfully loaded:', response.toString());

    } catch (error) {
        console.error('Failed to load standards:', error);
        process.exit(1);
    } finally {
        if (gateway) {
            gateway.disconnect();
        }
    }
}

main();