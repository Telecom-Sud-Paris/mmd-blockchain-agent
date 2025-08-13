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
const org1UserId = 'appUserHoneyQAAllPhases';

function prettyJSONString(inputString) {
    return JSON.stringify(JSON.parse(inputString), null, 2);
}

async function main() {
    let gateway;
    let productContract;
    let honeyStandardContract;
    let qualityAssuranceContract;

    try {
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

        const productContract = network.getContract('product');
        const honeyStandardContract = network.getContract('standardhoney');
        const qualityAssuranceContract = network.getContract('qualityassurance');

        console.log('Fabric connection successful. Contracts are ready.');

        console.log('\n--> Getting phases from the standards...');
        const standardsBuffer = await honeyStandardContract.evaluateTransaction('getStandards');
        const standards = JSON.parse(standardsBuffer.toString());
        const phases = Object.keys(standards.phases);
        console.log('Phases:', phases);
        console.log(`Phases found for verification: ${phases.join(', ')}`);

        console.log('\n--> Getting all registered products...');
        const productsBuffer = await productContract.evaluateTransaction('queryAllProducts');
        const products = JSON.parse(productsBuffer.toString());

        if (products.length === 0) {
            console.log('No products found in the ledger.');
            return;
        }
        console.log(`${products.length} product(s) found.`);

        for (const product of products) {
            const productId = product.productId;
            console.log(`\n======================================================`);
            console.log(`STARTING VERIFICATION FOR PRODUCT: ${productId}`);
            console.log(`======================================================`);
            console.log(`Product properties: ${prettyJSONString(JSON.stringify(product.properties))}`);

            for (const phase of phases) {
                console.log(`\n----- Verifying phase: '${phase}' -----`);
                try {
                    const resultBuffer = await qualityAssuranceContract.submitTransaction(
                        'verifyCompliance',
                        productId,
                        phase
                    );
                    
                    const result = JSON.parse(resultBuffer.toString());

                    console.log(`Verification result: ${result.status.toUpperCase()}`);
                    if (result.status === 'approved') {
                        console.log('Credential issued successfully:');
                        console.log(prettyJSONString(JSON.stringify(result.credential)));
                    } else {
                        console.log('Violations found:');
                        console.log(result.violations);
                    }

                } catch (error) {
                    console.error(`Failed to verify phase '${phase}' for product ${productId}: ${error.message}`);
                }
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