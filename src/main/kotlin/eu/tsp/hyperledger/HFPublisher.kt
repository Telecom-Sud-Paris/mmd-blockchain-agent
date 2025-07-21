package eu.tsp.hyperledger

import org.hyperledger.fabric.gateway.*
import org.hyperledger.fabric.sdk.Enrollment
import org.hyperledger.fabric.sdk.User
import org.hyperledger.fabric.sdk.security.CryptoSuiteFactory
import org.hyperledger.fabric_ca.sdk.EnrollmentRequest
import org.hyperledger.fabric_ca.sdk.HFCAClient
import org.hyperledger.fabric_ca.sdk.RegistrationRequest
import org.slf4j.LoggerFactory
import java.nio.file.Paths
import java.security.PrivateKey
import java.util.*

class HFPublisher(private val clientConfig: HyperledgerClientConfig) {

    init {
        System.setProperty("org.hyperledger.fabric.sdk.service_discovery.as_localhost", "false")
    }

    private val logger = LoggerFactory.getLogger(this::class.java)

    fun enrolUsers() {
        enrolAdmin()
        enrolUser()
    }

    private val builder by lazy {
        Gateway.createBuilder().apply {
            val wallet = Wallets.newFileSystemWallet(Paths.get("wallet"))
            val networkConfigPath = Paths.get(
                "test-network",
                "organizations",
                "peerOrganizations",
                "org1.example.com",
                "connection-org1.yaml"
            )
            identity(wallet, clientConfig.walletUsername).networkConfig(networkConfigPath).discovery(true)
        }
    }

    fun publish(publisherId: String, productId: String, propertyName: String, value: String) {
        builder.connect().use { gateway ->

            // get the network and contract
            val network: Network = gateway.getNetwork("mychannel")
            val contract: Contract = network.getContract("PropertyContract")
            val timestamp = System.currentTimeMillis()

            contract.submitTransaction("createOrUpdateProductProperty", productId, propertyName, value, timestamp.toString())
            val result = contract.evaluateTransaction("queryProductProperties", productId)
            logger.info("Ledger: ${String(result)}")
        }
    }

    private fun enrolUser() {
        // Create a CA client for interacting with the CA.
        val props = Properties()
        props["pemFile"] =
            "test-network/organizations/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem/ca.org1.example.com-cert.pem"
        props["allowAllHostNames"] = "true"
        val caClient = HFCAClient.createNewInstance("https://${clientConfig.caAddress}", props)
        val cryptoSuite = CryptoSuiteFactory.getDefault().cryptoSuite
        caClient.cryptoSuite = cryptoSuite


        // Create a wallet for managing identities
        val wallet = Wallets.newFileSystemWallet(Paths.get("wallet"))


        // Check to see if we've already enrolled the user.
        if (wallet[clientConfig.walletUsername] != null) {
            println("An identity for the user ${clientConfig.walletUsername} already exists in the wallet")
            return
        }

        val adminIdentity = wallet["admin"] as X509Identity
        val admin: User = object : User {
            override fun getName(): String = "admin"
            override fun getRoles(): Set<String>? = null
            override fun getAccount(): String? = null
            override fun getAffiliation(): String =  "org1.department1"
            override fun getMspId(): String = "Org1MSP"
            override fun getEnrollment(): Enrollment {
                return object : Enrollment {
                    override fun getKey(): PrivateKey {
                        return adminIdentity.privateKey
                    }

                    override fun getCert(): String {
                        return Identities.toPemString(adminIdentity.certificate)
                    }
                }
            }
        }


        // Register the user, enroll the user, and import the new identity into the wallet.
        val registrationRequest = RegistrationRequest(clientConfig.walletUsername)
        registrationRequest.affiliation = "org1.department1"
        registrationRequest.enrollmentID = clientConfig.walletUsername
        val enrollmentSecret = caClient.register(registrationRequest, admin)
        val enrollment = caClient.enroll(clientConfig.walletUsername, enrollmentSecret)
        val user: Identity = Identities.newX509Identity("Org1MSP", enrollment)
        wallet.put(clientConfig.walletUsername, user)
        println("Successfully enrolled user ${clientConfig.walletUsername} and imported it into the wallet")
    }

    private fun enrolAdmin() {
        // Create a CA client for interacting with the CA.

        val props = Properties()
        props["pemFile"] =
            "test-network/organizations/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem/ca.org1.example.com-cert.pem"
        props["allowAllHostNames"] = "true"
        val caClient = HFCAClient.createNewInstance("https://${clientConfig.walletUsername}", props)
        val cryptoSuite = CryptoSuiteFactory.getDefault().cryptoSuite
        caClient.cryptoSuite = cryptoSuite

        // Create a wallet for managing identities
        val wallet = Wallets.newFileSystemWallet(Paths.get("wallet"))

        // Check to see if we've already enrolled the admin user.
        if (wallet["admin"] != null) {
            println("An identity for the admin user \"admin\" already exists in the wallet")
            return
        }

        // Enroll the admin user, and import the new identity into the wallet.
        val enrollmentRequestTLS = EnrollmentRequest()
        enrollmentRequestTLS.addHost(clientConfig.caAddress)
        enrollmentRequestTLS.profile = "tls"
        val enrollment = caClient.enroll("admin", "adminpw", enrollmentRequestTLS)
        val user: Identity = Identities.newX509Identity("Org1MSP", enrollment)
        wallet.put("admin", user)
        println("Successfully enrolled user \"admin\" and imported it into the wallet")
    }
}