package eu.tsp.hyperledger

import eu.tsp.mqtt.requiredProperty
import io.ktor.server.config.*

data class HyperledgerClientConfig(val caAddress: String, val walletUsername: String)

fun ApplicationConfig.toHyperledgerClientConfig() = HyperledgerClientConfig(
    caAddress = requiredProperty("caAddress"),
    walletUsername = requiredProperty("walletUsername")
)