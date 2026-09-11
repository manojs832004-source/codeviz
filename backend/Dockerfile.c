FROM ubuntu:22.04

# Install gcc, gdb, and libc-dev
RUN apt-get update && apt-get install -y \
    gcc \
    gdb \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for added security
RUN useradd -m -s /bin/bash cuser
USER cuser
WORKDIR /app
