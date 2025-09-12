/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// =========== modules ===========
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const mqtt = require('mqtt');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../../../../test-application/javascript/CAUtil.js'); 
const { buildCCPOrg1, buildWallet } = require('../../../../../test-application/javascript/AppUtil.js'); 

// =========== config FABRIC ===========
const channelName = 'mychannel';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUserListener';

// =========== config MQTT ===========
//const brokerUrl = 'mqtt://172.17.0.1:1883'; //gateway 1
const brokerUrl = 'mqtt://172.17.0.1:1884'; //gateway 2
const topic = '#'; //listen to all topics

function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}

async function main() {
    let productContract;
    let alertControlContract;
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
		productContract = network.getContract('product');
        alertControlContract = network.getContract('alertcontrol');
	
        console.log('Fabric connection successful. Contract object is ready.');


	} catch (error) {
		console.error(`******** FAILED to connect to Fabric network: ${error}`);
        process.exit(1); 
	}

    // MQTT Broker connection
    console.log(`\nConnecting to MQTT broker on ${brokerUrl}`);
    const mqttClient = mqtt.connect(brokerUrl);

    mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker');
        mqttClient.subscribe(topic, (err) => {
            if (!err) {
                console.log(`Subscribed and listening to topic: ${topic}`);
            } else {
                console.error('MQTT subscription error:', err);
            }
        });
    });

    // ========== message queue ==========
    const messageQueue = [];
    let isProcessing = false;

    async function processQueue() {
        if (isProcessing || messageQueue.length === 0) {
            return;
        }
        isProcessing = true;

        const { receivedTopic, messageString } = messageQueue.shift();  //get next message from queue
        console.log(`\n>> Processing message from topic "${receivedTopic}"`);

        try {
            const data = JSON.parse(messageString);
            console.log('Parsed JSON data:', data);
            const propertyName = receivedTopic;

            if (!data.publisherId || !data.productId || !propertyName || data.value === undefined) {
                throw new Error('Invalid message format. Missing publisherId, productId, propertyName, or value.');
            }
            let randomId = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
            console.log('Submitting transaction to create or update property...');
            const commit = await productContract.submitTransaction(
                'upsertProductProperty',
                data.productId, //using productId as productType Since nodered isnt passing product types yet
                `${data.productId}-${randomId}`, //using productId as productId with random suffix
                'processing', // assuming 'processing' phase for this example since nodered isnt passing phases yet
                propertyName,
                data.publisherId,
                String(data.value)
            );
            console.log(`*** Transaction committed successfully!`);
            console.log(`*** Result: ${prettyJSONString(commit.toString())}`);


            console.log("\n Checking alert rules for product...");
            const rules = await alertControlContract.submitTransaction(
                'checkAlertRule',
                data.productId,
                propertyName,
                String(data.value)
            );
            console.log(`*** Alert check result: ${rules.toString()}`);

        } catch (error) {
            // do a retry logic here if needed
            console.error(`Failed to submit transaction for topic ${receivedTopic}:`, error);
        } finally {
            //release the processing flag
            isProcessing = false;
            //process next message in the queue
            setImmediate(processQueue);
        }
    }

    // processing incoming MQTT messages
    mqttClient.on('message', (receivedTopic, message) => {
    const messageString = message.toString();
    console.log(`\nReceived and queued message from topic "${receivedTopic}"`);
    messageQueue.push({ receivedTopic, messageString });
    processQueue();
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