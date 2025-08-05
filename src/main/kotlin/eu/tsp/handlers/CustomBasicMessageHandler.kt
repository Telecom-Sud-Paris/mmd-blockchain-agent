package eu.tsp.wallet.aries.handlers

import org.hyperledger.ariesframework.InboundMessageContext
import org.hyperledger.ariesframework.OutboundMessage
import org.hyperledger.ariesframework.agent.Agent
import org.hyperledger.ariesframework.agent.AgentEvents
import org.hyperledger.ariesframework.agent.MessageHandler
import org.hyperledger.ariesframework.basicmessage.messages.BasicMessage
import org.hyperledger.ariesframework.connection.repository.ConnectionRecord

class CustomBasicMessageHandler(val agent: Agent, private val callback: (ConnectionRecord?, String) -> Unit): MessageHandler {
    override val messageType = BasicMessage.type

    override suspend fun handle(messageContext: InboundMessageContext): OutboundMessage? {
        val message = messageContext.message as BasicMessage
        agent.eventBus.publish(AgentEvents.BasicMessageEvent(message.content))
        callback(messageContext.connection, message.content)
        return null
    }
}