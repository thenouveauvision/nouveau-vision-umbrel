#!/bin/sh
set -eu

DATADIR=/home/nvu/.nvu
CREDENTIAL_DIR=/home/nvu/credentials
PASSWORD_FILE="$CREDENTIAL_DIR/rpcpassword"
CONFIG_FILE="$DATADIR/nvu.conf"

mkdir -p "$DATADIR" "$CREDENTIAL_DIR"

chown 1000:1000 "$DATADIR" "$CREDENTIAL_DIR"

if [ ! -s "$PASSWORD_FILE" ]; then
    umask 077
    od -An -N32 -tx1 /dev/urandom |
        tr -d ' \n' > "$PASSWORD_FILE"
fi

RPCPASSWORD=$(cat "$PASSWORD_FILE")

umask 077

cat > "$CONFIG_FILE" <<CONFIG
server=1
listen=1
dnsseed=0
upnp=0
natpmp=0

rpcuser=nvupool
rpcpassword=$RPCPASSWORD
rpcbind=0.0.0.0
rpcallowip=172.16.0.0/12
rpcport=9332

zmqpubhashblock=tcp://0.0.0.0:29332

port=9333
addnode=node.nvu.us:9333
CONFIG

chown 1000:1000 "$PASSWORD_FILE" "$CONFIG_FILE"
chmod 600 "$PASSWORD_FILE" "$CONFIG_FILE"

exec setpriv \
    --reuid=1000 \
    --regid=1000 \
    --init-groups \
    /usr/local/bin/nvund \
    -datadir="$DATADIR" \
    -printtoconsole=1
