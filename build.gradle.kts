val kotlin_version: String by project
val logback_version: String by project

plugins {
    kotlin("jvm") version "2.0.0"
    id("io.ktor.plugin") version "2.3.12"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.23"
    id("com.diffplug.spotless") version "6.25.0"
    id("maven-publish")

    jacoco
}

group = "eu.tsp"
version = "1.0-SNAPSHOT"

application {
    mainClass.set("io.ktor.server.netty.EngineMain")

    val isDevelopment: Boolean = project.ext.has("development")
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=$isDevelopment")
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("io.ktor:ktor-server-core-jvm")
    implementation("io.ktor:ktor-server-content-negotiation-jvm")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm")
    implementation("io.ktor:ktor-server-swagger")
    implementation("io.ktor:ktor-server-cors")
    implementation("io.ktor:ktor-server-netty-jvm")
    implementation("io.ktor:ktor-client-cio")
    implementation("io.ktor:ktor-client-okhttp")
    implementation("io.ktor:ktor-client-auth")
    implementation("io.ktor:ktor-client-encoding")
    implementation("io.ktor:ktor-client-content-negotiation")
    implementation("io.ktor:ktor-server-status-pages")
    implementation("io.github.davidepianca98:kmqtt-common-jvm:0.4.8")
    implementation("io.github.davidepianca98:kmqtt-client-jvm:0.4.8")
    implementation("ch.qos.logback:logback-classic:$logback_version")
    implementation("com.google.code.gson:gson:2.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.0")
    implementation("org.hyperledger.fabric:fabric-gateway-java:2.2.9")

    testImplementation(kotlin("test"))
    testImplementation("io.ktor:ktor-server-tests-jvm")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:$kotlin_version")
    testImplementation("io.ktor:ktor-server-test-host-jvm:$kotlin_version")
    testImplementation("io.mockk:mockk:1.13.12")
    testImplementation("org.testcontainers:junit-jupiter:1.20.1")
    testImplementation("io.kotest:kotest-runner-junit5:5.9.1")
    testImplementation("org.junit.jupiter:junit-jupiter-params:5.11.0")
    testImplementation("io.kotest:kotest-property-jvm:5.9.1")
}

tasks.test {
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)

    reports {
        xml.required.set(true)
        csv.required.set(false)
        html.required.set(false)
    }
}

tasks.withType<Test> {
    useJUnitPlatform()

    jvmArgs =
        listOf(
            "-Duser.timezone=UTC",
            "-Dfile.encoding=UTF8",
            "-Xmx800m"
        )
}

ktor {
    docker {
        jreVersion.set(JavaVersion.VERSION_21)
    }
}