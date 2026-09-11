FROM eclipse-temurin:17-jdk-jammy

# Compile the Tracer
COPY src/docker/Tracer.java /tracer_src/Tracer.java
RUN mkdir /tracer && javac -g -d /tracer /tracer_src/Tracer.java

# Create a non-root user for added security
RUN useradd -m -s /bin/bash javauser
RUN chown -R javauser:javauser /tracer
USER javauser
WORKDIR /app

# The container will just wait to be executed with javac and java commands
