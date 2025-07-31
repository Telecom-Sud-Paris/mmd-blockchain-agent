package eu.tsp.wallet

import kotlinx.coroutines.DelicateCoroutinesApi
import org.hyperledger.ariesframework.agent.Agent
import org.hyperledger.ariesframework.agent.AgentConfig
import org.hyperledger.ariesframework.agent.MediatorPickupStrategy
import org.hyperledger.ariesframework.credentials.models.AutoAcceptCredential
import org.hyperledger.ariesframework.proofs.models.AutoAcceptProof
import org.hyperledger.ariesframework.wallet.WalletState
import org.slf4j.LoggerFactory
import java.io.File

const val genesisPath = "bcovrin-genesis.txn"

@OptIn(DelicateCoroutinesApi::class)
class Wallet {

    private val logger = LoggerFactory.getLogger(this::class.java)

    private lateinit var agent: Agent

    private suspend fun openWallet() {
        try {
            val key = Agent.generateWalletKey()

//            copyResourceFile(genesisPath)

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
            agent = Agent(WalletState(), config)
            agent.initialize()
//            agent.dispatcher.registerHandler(
//                CustomBasicMessageHandler(
//                    agent,
//                    ::basicMessageHandler
//                )
//            )
//            subscribeEvents()
//            this.invitation = createInvitation()
//            logger.info("WalletApp Invitation URL: $invitationUrl")
//            walletOpened = true
//            credDefId = prepareForIssuance(listOf("access_requester", "access_granter", "resource_owner"))
//            logger.info("WalletApp credDefId: $credDefId")
        } catch (e: Exception) {
            logger.error("WalletApp Error opening wallet", e)
        }
    }
}