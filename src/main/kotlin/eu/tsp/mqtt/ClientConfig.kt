package eu.tsp.mqtt

import MQTTClient
import io.ktor.server.config.*
import mqtt.MQTTVersion
import mqtt.Subscription
import mqtt.packets.Qos
import mqtt.packets.mqtt.MQTTPublish
import mqtt.packets.mqttv5.SubscriptionOptions

data class ClientConfig(
    val id: String,
    val subscriptionTopics: List<String>,
    val mqttVersion: MQTTVersion,
    val address: String,
    val port: Int,
    val username: String,
    val password: String
)

fun ApplicationConfig.toClientWithTopics() = ClientConfig(
    id = requiredProperty("id"),
    subscriptionTopics = requiredListProperty("subscriptionTopics"),
    mqttVersion = MQTTVersion.MQTT5,
    address = requiredProperty("host"),
    port = requiredProperty("port").toInt(),
    username = requiredProperty("username"),
    password = requiredProperty("password")
)

private fun ApplicationConfig.requiredProperty(name: String) = requireNotNull(propertyOrNull(name)) {
    "Configuration property '$name' is missing"
}.getString()

private fun ApplicationConfig.requiredListProperty(name: String) = requireNotNull(propertyOrNull(name)) {
    "Configuration property '$name' is missing"
}.getList()

@OptIn(ExperimentalUnsignedTypes::class)
fun ClientConfig.createClientAndSubscribe(publishCallback: (String, MQTTPublish) -> Unit) = MQTTClient(
    mqttVersion,
    address,
    port,
    null,
    publishReceived = { message -> publishCallback(id, message) }
).apply {
    subscribe(subscriptionTopics.map { Subscription(it, SubscriptionOptions(Qos.EXACTLY_ONCE)) })
}