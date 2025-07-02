FROM openjdk:21-jdk
VOLUME /tmp
COPY build/libs/mmd-blockchain-agent-all.jar app.jar
CMD ["sh","-c","java -jar app.jar"]