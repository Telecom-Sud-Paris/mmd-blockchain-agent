package org.hyperledger.ariesframework

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import org.apache.commons.codec.binary.Base64
import org.hyperledger.ariesframework.agent.AgentMessage
import org.hyperledger.ariesframework.connection.repository.ConnectionRecord

typealias Tags = Map<String, String>
fun Tags.toJsonString(): String {
    return Json.encodeToString(MapSerializer(String.serializer(), String.serializer()), this)
}

fun List<String>.toJsonString(): String {
    return Json.encodeToString(ListSerializer(String.serializer()), this)
}

fun ByteArray.encodeBase64url(): String {
    return Base64.encodeBase64URLSafeString(this)
}

fun ByteArray.encodeBase64(): String {
    return Base64.encodeBase64String(this)
}

fun String.decodeBase64url(): ByteArray {
    return Base64.decodeBase64(this)
}

fun String.decodeBase64(): ByteArray {
    return Base64.decodeBase64(this)
}

@Serializable
data class OutboundPackage(
    val payload: EncryptedMessage,
    val responseRequested: Boolean,
    val endpoint: String,
    val connectionId: String? = null,
)

data class OutboundMessage(
    val payload: AgentMessage,
    val connection: ConnectionRecord,
)

@Serializable
data class EncryptedMessage(
    val protected: String,
    val iv: String,
    val ciphertext: String,
    val tag: String,
)

data class EnvelopeKeys(
    val recipientKeys: List<String>,
    val routingKeys: List<String>,
    val senderKey: String? = null,
)

@Serializable
data class DecryptedMessageContext(
    @SerialName("message")
    val plaintextMessage: String,
    @SerialName("sender_verkey")
    val senderKey: String? = null,
    @SerialName("recipient_verkey")
    val recipientKey: String? = null,
)

data class InboundMessageContext(
    val message: AgentMessage,
    val plaintextMessage: String,
    val connection: ConnectionRecord? = null,
    val senderVerkey: String? = null,
    val recipientVerkey: String? = null,
) {
    fun assertReadyConnection(): ConnectionRecord {
        if (connection == null) {
            throw Exception("No connection associated with incoming message ${message.type}")
        }
        connection.assertReady()
        return connection
    }
}

enum class AckStatus {
    OK,
    FAIL,
    PENDING,
}

@Serializable
data class JweRecipient(
    @SerialName("encrypted_key")
    val encryptedKey: String,
    val header: Map<String, String>?,
)

@Serializable
data class JweEnvelope(
    val protected: String,
    val unprotected: String?,
    val recipients: List<JweRecipient>?,
    val ciphertext: String,
    val iv: String,
    val tag: String,
    val aad: String?,
    val header: List<String>?,
    @SerialName("encrypted_key")
    val encryptedKey: String?,
)

@Serializable
data class ProtectedHeader(
    val enc: String,
    val typ: String,
    val alg: String,
    val recipients: List<JweRecipient>,
)
