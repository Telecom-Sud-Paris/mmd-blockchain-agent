package eu.tsp

import eu.tsp.mqtt.MqttBrokerListener
import eu.tsp.plugins.configureCors
import eu.tsp.plugins.configureSerialization
import eu.tsp.plugins.configureStatusPages
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.swagger.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

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
        route("$API_ROOT/health") {
            get {
                call.respond(HttpStatusCode.OK, "Status OK")
            }
        }
        val gatewayListener = MqttBrokerListener(environment!!.config)
        gatewayListener.initialize()
        swaggerUI(path = "$API_ROOT/swagger", swaggerFile = "openapi/documentation.yaml")
    }
}

