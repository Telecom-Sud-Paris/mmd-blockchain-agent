FROM openjdk:21-jdk
VOLUME /tmp
COPY build/libs/mmd-server-all.jar app.jar
CMD ["sh","-c","java -jar app.jar"]