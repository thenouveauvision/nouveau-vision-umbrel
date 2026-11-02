FROM ubuntu:26.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        libatomic1 \
        libevent-dev \
        libminiupnpc-dev \
        libnatpmp-dev \
        libzmq5 \
        libssl3t64 \
        libboost-filesystem-dev \
        libgmp-dev \
        libdb5.3++-dev \
        zlib1g \
        libzstd1 \
        util-linux && \
    rm -rf /var/lib/apt/lists/*

COPY --chown=1000:1000 binaries/src/nvund /usr/local/bin/nvund
COPY --chown=1000:1000 binaries/src/nvu-cli /usr/local/bin/nvu-cli
COPY --chown=1000:1000 entrypoint.sh /usr/local/bin/nvu-entrypoint

RUN chmod 0755 \
        /usr/local/bin/nvund \
        /usr/local/bin/nvu-cli \
        /usr/local/bin/nvu-entrypoint && \
    mkdir -p \
        /home/nvu/.nvu \
        /home/nvu/credentials && \
    chown -R 1000:1000 /home/nvu


WORKDIR /home/nvu

VOLUME ["/home/nvu/.nvu"]

EXPOSE 9333/tcp

ENTRYPOINT ["/usr/local/bin/nvu-entrypoint"]
