#!/bin/sh
set -eu

CREDENTIAL_DIR=/home/ubuntu/credentials
PASSWORD_FILE="$CREDENTIAL_DIR/rpcpassword"
PAYOUT_FILE="$CREDENTIAL_DIR/mining-payout-address"
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

if [ -z "$RPCPASSWORD" ]; then
    echo "ERROR: NVUN RPC credential is empty."
    exit 1
fi

if [ ! -s "$PAYOUT_FILE" ]; then
    echo "ERROR: Mining payout address was not initialized."
    exit 1
fi

MINING_PAYOUT_ADDRESS=$(
    tr -d '\r\n' < "$PAYOUT_FILE"
)

if [ -z "$MINING_PAYOUT_ADDRESS" ]; then
    echo "ERROR: Mining payout address is empty."
    exit 1
fi

case "$MINING_PAYOUT_ADDRESS" in
    nvu:*)
        ;;
    *)
        echo "ERROR: Mining payout address has an invalid NVU prefix."
        exit 1
        ;;
esac

echo "Mining payout address: $MINING_PAYOUT_ADDRESS"

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
  "bchaddress": "$MINING_PAYOUT_ADDRESS",
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
