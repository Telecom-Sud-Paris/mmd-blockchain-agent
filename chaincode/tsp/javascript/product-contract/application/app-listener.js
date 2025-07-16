/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// =========== modules ===========
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const mqtt = require('mqtt');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../../../../test-application/javascript/CAUtil.js'); // Ajuste o caminho se necessário
const { buildCCPOrg1, buildWallet } = require('../../../../../test-application/javascript/AppUtil.js'); // Ajuste o caminho se necessário

// =========== config FABRIC ===========
const channelName = 'mychannel';
const chaincodeName = 'product';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUser';

// =========== config MQTT ===========
const brokerUrl = 'mqtt://172.17.0.1:1883';
const topic = 'temperature'; 

function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}

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

        await contract.submitTransaction('initLedger');


	} catch (error) {
		console.error(`******** FAILED to connect to Fabric network: ${error}`);
        process.exit(1); 
	}

    // MQTT Broker connection
    console.log(`\nConnecting to MQTT broker on ${brokerUrl}`);
    const mqttClient = mqtt.connect(brokerUrl);

    mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker!');
        mqttClient.subscribe(topic, (err) => {
            if (!err) {
                console.log(`👂 Subscribed and listening to topic: ${topic}`);
            } else {
                console.error('MQTT subscription error:', err);
            }
        });
    });

    // processing incoming MQTT messages
    mqttClient.on('message', async (receivedTopic, message) => {
    const messageString = message.toString();
    console.log(`\nReceived message from topic "${receivedTopic}"`);

    try {
        const data = JSON.parse(messageString);
        console.log('Parsed JSON data:', data);
        const propertyName = receivedTopic;

        if (!data.publisherId || !data.productId || !propertyName || data.value === undefined) {
            throw new Error('Invalid message format. Missing publisherId, productId, propertyName, or value.');
        }

        console.log('Submitting transaction to create or update property...');
        const commit = await contract.submitTransaction(
            'upsertProductProperty',
            data.publisherId,
            data.productId,
            propertyName,
            String(data.value)
        );
        console.log(`*** Transaction committed successfully!`);
        console.log(`*** Result: ${prettyJSONString(commit.toString())}`);

    } catch (error) {
        console.error('Failed to submit transaction:', error);
    }
    });

    mqttClient.on('error', (err) => {
        console.error('MQTT connection error:', err);
    });

    // --- disconnection ---
    const shutdown = async () => {
        console.log('\nShutting down...');
        mqttClient.end();
        if (gateway) {
            gateway.disconnect();
        }
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main();