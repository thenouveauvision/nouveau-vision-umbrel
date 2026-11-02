FROM ubuntu:26.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        libzmq5 && \
    rm -rf /var/lib/apt/lists/*

COPY --chown=1000:1000 binaries/src/asicseer-pool /usr/local/bin/asicseer-pool
COPY --chown=1000:1000 entrypoint.sh /usr/local/bin/asicseer-entrypoint

RUN chmod 0755 \
        /usr/local/bin/asicseer-pool \
        /usr/local/bin/asicseer-entrypoint && \
    mkdir -p \
        /var/log/asicseer \
        /home/ubuntu/credentials && \
    chown -R 1000:1000 \
        /var/log/asicseer \
        /home/ubuntu

USER 1000:1000

WORKDIR /home/ubuntu

EXPOSE 3335/tcp

ENTRYPOINT ["/usr/local/bin/asicseer-entrypoint"]
