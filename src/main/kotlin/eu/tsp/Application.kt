package eu.tsp

import eu.tsp.hyperledger.HFPublisher
import eu.tsp.hyperledger.toHyperledgerClientConfig
import eu.tsp.mqtt.MqttBrokerListener
import eu.tsp.plugins.configureCors
import eu.tsp.plugins.configureSerialization
import eu.tsp.plugins.configureStatusPages
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.swagger.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

fun main(args: Array<String>) {
    EngineMain.main(args)
}

const val API_ROOT = "/api/v1"

fun Application.module() {
    System.setProperty("org.slf4j.simpleLogger.defaultLogLevel", "INFO")
    configureSerialization()
    configureCors()
    configureStatusPages()
    routing {
        val config = environment.config
        val hfPublisher = HFPublisher(config.config("hyperledger").toHyperledgerClientConfig()).apply {
            enrolUsers()
        }
        val gatewayListener = MqttBrokerListener(hfPublisher, config)
        gatewayListener.initialize()
        route("$API_ROOT/publish") {
            post {
                log.info("Received publish request")
                val request = call.receive<DevicePayload>()

                hfPublisher.publish(request.publisherId, request.batchId, request.property, request.value,)
                call.respond(HttpStatusCode.OK, "Property published successfully")
            }
        }
        route("$API_ROOT/health") {
            get {
                log.info("Received health request")
                call.respond(HttpStatusCode.OK, "Status OK")
            }
        }
        swaggerUI(path = "$API_ROOT/swagger", swaggerFile = "openapi/documentation.yaml")
    }
}

@Serializable
data class DevicePayload(
    val deviceId: String,
    val ownerId: String,
    val batchId: String,
    val deviceType: String,
    val property: String,
    val value: String,
    val timestamp: Long
) {
    val publisherId: String
        get() = "$ownerId#$deviceId#$deviceType"
}