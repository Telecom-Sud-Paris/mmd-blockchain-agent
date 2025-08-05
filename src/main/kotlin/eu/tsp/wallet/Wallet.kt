package eu.tsp.wallet

import eu.tsp.wallet.aries.handlers.CustomBasicMessageHandler
import eu.tsp.wallet.aries.messages.MessageRecord
import eu.tsp.wallet.aries.messages.MessageType
import kotlinx.coroutines.*
import org.hyperledger.ariesframework.agent.Agent
import org.hyperledger.ariesframework.agent.AgentConfig
import org.hyperledger.ariesframework.agent.AgentEvents
import org.hyperledger.ariesframework.agent.MediatorPickupStrategy
import org.hyperledger.ariesframework.connection.repository.ConnectionRecord
import org.hyperledger.ariesframework.credentials.models.AcceptOfferOptions
import org.hyperledger.ariesframework.credentials.models.AutoAcceptCredential
import org.hyperledger.ariesframework.credentials.models.CredentialState
import org.hyperledger.ariesframework.ledger.CredentialDefinitionTemplate
import org.hyperledger.ariesframework.ledger.SchemaTemplate
import org.hyperledger.ariesframework.proofs.models.AutoAcceptProof
import org.hyperledger.ariesframework.proofs.models.ProofState
import org.hyperledger.ariesframework.wallet.WalletState
import org.slf4j.LoggerFactory
import java.io.File
import java.util.*
import kotlin.time.Duration.Companion.seconds

@OptIn(DelicateCoroutinesApi::class)
class Wallet(private val walletState: WalletState, private val genesisPath: String) {

    private val logger = LoggerFactory.getLogger(this::class.java)

    private lateinit var agent: Agent
    private val receivedMessages = mutableListOf<MessageRecord>()
    private lateinit var credDefId: String
    var invitation: Invitation? = null


    private suspend fun openWallet() {
        try {
            val key = Agent.generateWalletKey()

            val invitationUrl =
                "https://public.mediator.indiciotech.io?c_i=eyJAdHlwZSI6ICJkaWQ6c292OkJ6Q2JzTlloTXJqSGlxWkRUVUFTSGc7c3BlYy9jb25uZWN0aW9ucy8xLjAvaW52aXRhdGlvbiIsICJAaWQiOiAiMDVlYzM5NDItYTEyOS00YWE3LWEzZDQtYTJmNDgwYzNjZThhIiwgInNlcnZpY2VFbmRwb2ludCI6ICJodHRwczovL3B1YmxpYy5tZWRpYXRvci5pbmRpY2lvdGVjaC5pbyIsICJyZWNpcGllbnRLZXlzIjogWyJDc2dIQVpxSktuWlRmc3h0MmRIR3JjN3U2M3ljeFlEZ25RdEZMeFhpeDIzYiJdLCAibGFiZWwiOiAiSW5kaWNpbyBQdWJsaWMgTWVkaWF0b3IifQ==" // ktlint-disable max-line-length
            // val invitationUrl = URL("http://10.0.2.2:3001/invitation").readText() // This uses local AFJ mediator and needs MediatorPickupStrategy.PickUpV1
            val config = AgentConfig(
                walletKey = key,
                genesisPath = File(genesisPath).absolutePath,
                mediatorConnectionsInvite = invitationUrl,
                mediatorPickupStrategy = MediatorPickupStrategy.Implicit,
                label = "MMD Blockchain Agent",
                autoAcceptCredential = AutoAcceptCredential.Never,
                autoAcceptProof = AutoAcceptProof.Never,
                publicDidSeed = "00000000000000000000000AFKIssuer" //endorser DID
            )
            agent = Agent(walletState, config)
            agent.initialize()
            agent.dispatcher.registerHandler(
                CustomBasicMessageHandler(
                    agent,
                    ::basicMessageHandler
                )
            )
            subscribeEvents()
            this.invitation = createInvitation()
            logger.info("WalletApp Invitation URL: $invitationUrl")
            credDefId = prepareForIssuance(listOf("access_requester", "access_granter", "resource_owner"))
            logger.info("WalletApp credDefId: $credDefId")
        } catch (e: Exception) {
            logger.error("WalletApp Error opening wallet", e)
        }
    }

    private suspend fun prepareForIssuance(attributes: List<String>): String {
        logger.info("WalletApp Preparing for credential issuance with attributes: $attributes")
        val didInfo = agent.wallet.publicDid ?: throw Exception("Agent has no public DID.")
        val schemaId = agent.ledgerService.registerSchema(
            didInfo,
            SchemaTemplate("schema-${UUID.randomUUID()}", "1.0", attributes),
        )
        logger.info("WalletApp Schema registered with ID: $schemaId")
        delay(0.1.seconds)
        val (schema, seqNo) = agent.ledgerService.getSchema(schemaId)
        logger.info("WalletApp Schema retrieved: $schema with seqNo: $seqNo")
        return agent.ledgerService.registerCredentialDefinition(
            didInfo,
            CredentialDefinitionTemplate(schema, "default", false, seqNo),
        )
    }


    suspend fun createInvitation(): Invitation? {
        logger.info("WalletApp Creating invitation")
        return try {
            // Create a connection invitation
            val routing = agent.mediationRecipient.getRouting()
            val invitation = agent.connectionService.createInvitation(
                routing = routing,
                autoAcceptConnection = true,
                label = "MMD Blockchain Agent",
                multiUseInvitation = true,
            )
            invitation.connection.invitation?.toUrl("public.mediator.indiciotech.io") ?: ""
            Invitation(
                "https://${invitation.connection.invitation?.toUrl("public.mediator.indiciotech.io") ?: ""}",
                invitation.connection.invitation?.imageUrl ?: ""
            )
        } catch (e: Exception) {
            logger.error("WalletApp Error creating invitation", e)
            null
        }
    }

    private fun basicMessageHandler(connectionRecord: ConnectionRecord?, message: String) {
        if (connectionRecord != null) {
            val messageRecord = MessageRecord(
                senderConnectionId = connectionRecord.theirLabel ?: "Unknown",
                senderLabel = connectionRecord.theirLabel ?: "Unknown",
                content = message,
                type = MessageType.BasicMessage
            )
            receivedMessages.add(messageRecord)
            logger.info(
                "WalletApp Received basic message: $message from ${connectionRecord.theirLabel}"
            )
        }
    }

    @OptIn(DelicateCoroutinesApi::class)
    private fun subscribeEvents() {
        agent.didExchangeService.
        agent.eventBus.subscribe<AgentEvents.CredentialEvent> {
            GlobalScope.launch(Dispatchers.IO) {
                val theirLabel =
                    agent.connectionRepository.getById(it.record.connectionId).theirLabel
                        ?: "Unknown"
                if (it.record.state == CredentialState.OfferReceived) {
                    receivedMessages.add(
                        MessageRecord(
                            senderConnectionId = theirLabel,
                            senderLabel = theirLabel,
                            type = MessageType.CredentialOffer,
                            content = "Credential offer received. Attributes: ${it.record.getCredentialInfo()}"
                        )
                    )
                    getCredential(it.record.id)
                } else if (it.record.state == CredentialState.Done) {
                    receivedMessages.add(
                        MessageRecord(
                            senderConnectionId = theirLabel,
                            senderLabel = theirLabel,
                            type = MessageType.CredentialApproved,
                            content = "Credentials: ${it.record.credentialAttributes}"
                        )
                    )
                    logger.info("WalletApp Credential offer completed: ${it.record.id}")
                }
            }
        }
        agent.eventBus.subscribe<AgentEvents.ProofEvent> {
            GlobalScope.launch(Dispatchers.IO) {
                if (it.record.state == ProofState.RequestReceived) {
                    sendProof(it.record.id)
                } else if (it.record.state == ProofState.Done) {
                    logger.info("WalletApp Proof request completed: ${it.record.id}")
                }
            }
        }
    }

    @OptIn(DelicateCoroutinesApi::class)
    private fun getCredential(id: String) {
        GlobalScope.launch(Dispatchers.IO) {
            try {
                agent.credentials.acceptOffer(
                    AcceptOfferOptions(
                        credentialRecordId = id,
                        autoAcceptCredential = AutoAcceptCredential.Always
                    ),
                )
            } catch (e: Exception) {
                logger.error("WalletApp Error accepting credential offer", e)
            }
        }
    }

    private suspend fun sendProof(id: String) {
        try {
            val retrievedCredentials = agent.proofs.getRequestedCredentialsForProofRequest(id)
            val requestedCredentials =
                agent.proofService.autoSelectCredentialsForProofRequest(retrievedCredentials)
            agent.proofs.acceptRequest(id, requestedCredentials)
        } catch (e: Exception) {
            logger.error("WalletApp Error sending proof request", e)
        }
    }
}

data class Invitation(val url: String, val imageUrl: String)