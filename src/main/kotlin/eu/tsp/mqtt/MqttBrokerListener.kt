package eu.tsp.mqtt

import com.google.gson.Gson
import eu.tsp.hyperledger.HFPublisher
import eu.tsp.hyperledger.toHyperledgerClientConfig
import io.ktor.server.config.*
import mqtt.packets.mqtt.MQTTPublish
import org.slf4j.LoggerFactory
import java.util.concurrent.Executors

class MqttBrokerListener(config: ApplicationConfig) {

    private val clients = config.configList("gateways").map {
        val configs = it.toClientWithTopics()
        configs.createClientAndSubscribe(::publishMessageReceived)
    }

    private val logger = LoggerFactory.getLogger(MqttBrokerListener::class.java)
    private val executor = Executors.newFixedThreadPool(clients.size)

    //Publisher ID to MessageConsumer
    private val messageConsumers = mutableMapOf<String, MessageConsumer>()
    private val hfPublisher = HFPublisher(config.config("hyperledger").toHyperledgerClientConfig()).apply { enrolUsers() }
    private val gson = Gson()

    fun initialize() {
        logger.info("Starting MQTT clients...")
        clients.forEach {
            executor.submit {
                it.run()
            }
        }
        logger.info("MQTT clients started")
    }

    data class Message(val publisherId: String, val productId: String, val value: String)

    @OptIn(ExperimentalUnsignedTypes::class)
    private fun publishMessageReceived(gatewayId: String, message: MQTTPublish) {
        val jsonString = message.payload?.toByteArray()?.decodeToString()
        val payload = gson.fromJson(jsonString, Message::class.java)
        val consumer = messageConsumers.computeIfAbsent(payload.publisherId) { MessageConsumer(payload.publisherId, hfPublisher) }
        consumer.consume(payload.productId, message.topicName, payload.value)
    }
}