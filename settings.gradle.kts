plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
}
rootProject.name = "mmd-blockchain-agent"
//include("chaincode")

val personalUser: String by settings
val personalPassword: String by settings

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("https://maven.pkg.github.com/LF-Decentralized-Trust-labs/aries-uniffi-wrappers")
            credentials {
                username = personalUser
                password = personalPassword
            }
        }
        maven { url = uri("https://jitpack.io") }
    }
}
