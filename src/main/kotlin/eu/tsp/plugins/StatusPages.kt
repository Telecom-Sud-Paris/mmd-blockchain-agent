package eu.tsp.plugins

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import kotlinx.serialization.Serializable

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            when(cause) {
                is BadRequestException -> {
                    val message = cause.cause?.message.toString()
                    call.respond(HttpStatusCode.BadRequest, ErrorResponse(message))
                }
            }
        }
    }
}

@Serializable
data class ErrorResponse(val error: String)
