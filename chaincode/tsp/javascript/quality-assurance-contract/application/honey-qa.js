/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../../../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../../../../test-application/javascript/AppUtil.js');

const channelName = 'mychannel';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUserHoneyQAFullProduct';

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
    
        const productContract = network.getContract('product'); 
        const qualityAssuranceContract = network.getContract('qualityassurance');
        
        const productTypeToVerify = 'honey';
        const productIdToVerify = 'honey-001';

        console.log(`\n--> CONFIGURATION: Script will verify all phases for product: ${productTypeToVerify}:${productIdToVerify}`);

        console.log(`\n======================================================`);
        console.log(`STARTING FULL VERIFICATION FOR PRODUCT: ${productIdToVerify}`);
        console.log(`======================================================`);

        try {
            const resultBuffer = await qualityAssuranceContract.submitTransaction(
                'verifyProductCompliance',
                productTypeToVerify,
                productIdToVerify,
                'standardhoney'  // Name of the Standards chaincode to invoke
            );
            
            const results = JSON.parse(resultBuffer.toString());
            console.log('--> Full Verification Report:');

            for (const result of results) {
                console.log(`\n----- Phase: '${result.phase}' -----`);
                console.log(`Verification Status: ${result.status.toUpperCase()}`);
                
                if (result.status === 'approved') {
                    console.log('Credential Issued:');
                    console.log(prettyJSONString(result.credential));
                } else if (result.status === 'rejected') {
                    console.log('Violations Found:');
                    console.log(prettyJSONString(result.violations));
                } else {
                    console.error(`An error occurred during verification: ${result.message}`);
                }
            }

        } catch (error) {
            console.error(`\n******** FAILED to submit transaction: ${error}`);
            if (error.endorsements) {
                console.error('Endorsement failed: ', error.endorsements);
            }
        }

    } catch (error) {
        console.error(`******** FAILED to run application: ${error}`);
    } finally {
        if (gateway) {
            gateway.disconnect();
        }
    }
}

main();