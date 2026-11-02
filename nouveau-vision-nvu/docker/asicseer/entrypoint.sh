#!/bin/sh
set -eu

CREDENTIAL_DIR=/home/ubuntu/credentials
PASSWORD_FILE="$CREDENTIAL_DIR/rpcpassword"
CONFIG_FILE=/home/ubuntu/nvu-pool.conf

attempt=0

while [ ! -s "$PASSWORD_FILE" ]; do
    attempt=$((attempt + 1))

    if [ "$attempt" -ge 60 ]; then
        echo "ERROR: NVUN RPC credential was not created."
        exit 1
    fi

    echo "Waiting for NVUN RPC credential..."
    sleep 2
done

RPCPASSWORD=$(cat "$PASSWORD_FILE")

umask 077

cat > "$CONFIG_FILE" <<CONFIG
{
  "btcd": [
    {
      "url": "nvun:9332",
      "auth": "nvupool",
      "pass": "$RPCPASSWORD",
      "notify": true,
      "zmq": "tcp://nvun:29332"
    }
  ],
  "bchaddress": "nvu:qqez4ylvjjey6wwqkza4m5z95fn8u4slcqt3yflx39",
  "serverurl": [
    "0.0.0.0:3335"
  ],
  "mindiff": 1,
  "startdiff": 1000,
  "maxdiff": 1000000,
  "mindiffpreauth": 1,
  "logdir": "/var/log/asicseer",
  "maxclients": 1024,
  "coinbase_sig": "Nouveau-Vision Unit",
  "solo": true
}
CONFIG

chmod 600 "$CONFIG_FILE"

exec /usr/local/bin/asicseer-pool \
    -B \
    -c "$CONFIG_FILE"
