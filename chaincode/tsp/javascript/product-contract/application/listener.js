
const mqtt = require('mqtt'); 

const brokerUrl = 'mqtt://172.17.0.1:1883';

const topic = '#'; 

console.log(`Connecting to MQTT broker on ${brokerUrl}`);

const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log('connected to MQTT broker!');

  client.subscribe(topic, (err) => {
    if (!err) {
      console.log(`Subscribed to topic: ${topic}`);
    } else {
      console.error('error on subscribing to topic:', err);
    }
  });
});

client.on('message', (receivedTopic, message) => {
  const messageString = message.toString();
  console.log(`\nReceived message from topic "${receivedTopic}":`); //${messageString}`);

  try {
    const jsonData = JSON.parse(messageString);
    console.log('JSON Object:');
    console.log(jsonData);

  } catch (e) {
    console.error('couldnt convert message to JSON:', e);
  }
});

client.on('error', (err) => {
  console.error('connexion error:', err);
  client.end();
});

client.on('close', () => {
  console.log('Connexion closed.');
});