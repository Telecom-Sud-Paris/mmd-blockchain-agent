/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// =========== modules ===========
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../../../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../../../../test-application/javascript/AppUtil.js');


// =========== config FABRIC ===========
const channelName = 'mychannel';
const chaincodeName = 'alertcontrol';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUserAlertRules';

async function main() {
    let contract;
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
        contract = network.getContract(chaincodeName);
            
        console.log('Fabric connection successful. Contract object is ready.');

        console.log('Reading alert rules from alert-rules.yaml...');
        const fileContents = fs.readFileSync(path.join(__dirname, 'alert-rules.yaml'), 'utf8');
        const data = yaml.load(fileContents);

        for (const product of data) {
            const productId = product.productId;
            for (const rule of product.rules) {
                console.log(`\n--> Submitting transaction to set rule for product: ${productId}, property: ${rule.propertyName}`);
                await contract.submitTransaction(
                    'setRule',
                    productId,
                    rule.propertyName,
                    rule.condition,
                    String(rule.value), 
                    rule.alertMessage
                );
                console.log('*** Transaction has been submitted');
            }
        }

        gateway.disconnect();
        console.log('\nAll alert rules loaded successfully.');

    } catch (error) {
        console.error(`Failed to load alert rules: ${error}`);
        process.exit(1);
    }
}

main();