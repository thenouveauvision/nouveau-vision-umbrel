#!/bin/sh
set -eu

CREDENTIAL_DIR=/home/nvu/credentials
PASSWORD_FILE="$CREDENTIAL_DIR/rpcpassword"
PAYOUT_FILE="$CREDENTIAL_DIR/mining-payout-address"

RPC_HOST=nvun
RPC_PORT=9332
RPC_USER=nvupool

WALLET_LABEL="Umbrel Mining"

CLI=/usr/local/bin/nvu-cli

fail()
{
    echo "ERROR: $*" >&2
    exit 1
}

rpc()
{
    "$CLI" \
        -rpcconnect="$RPC_HOST" \
        -rpcport="$RPC_PORT" \
        -rpcuser="$RPC_USER" \
        -rpcpassword="$RPCPASSWORD" \
        -rpcwallet= \
        "$@"
}

mkdir -p "$CREDENTIAL_DIR"

echo "=== NVU mining wallet initialization ==="

if [ ! -x "$CLI" ]; then
    fail "nvu-cli was not found at $CLI"
fi

if [ ! -s "$PASSWORD_FILE" ]; then
    fail "NVUN RPC credential is missing."
fi

RPCPASSWORD=$(cat "$PASSWORD_FILE")

if [ -z "$RPCPASSWORD" ]; then
    fail "NVUN RPC credential is empty."
fi

#
# If payout initialization has already completed,
# reuse the persistent address.
#

if [ -s "$PAYOUT_FILE" ]; then
    PAYOUT_ADDRESS=$(tr -d '\r\n' < "$PAYOUT_FILE")

    if [ -z "$PAYOUT_ADDRESS" ]; then
        fail "Persistent mining payout address is empty."
    fi

    case "$PAYOUT_ADDRESS" in
        nvu:*)
            ;;
        *)
            fail "Persistent mining payout address does not have the expected NVU prefix."
            ;;
    esac

    echo "Existing mining payout address found."
    echo "Mining payout address: $PAYOUT_ADDRESS"
    exit 0
fi

#
# Confirm the default wallet is loaded.
#
# listwallets returns JSON. The default wallet is
# represented by an empty wallet name.
#

WALLETS=$(rpc listwallets) ||
    fail "Unable to query loaded NVUN wallets."

if ! printf '%s\n' "$WALLETS" |
    grep -Eq '"[[:space:]]*"'
then
    fail "NVUN default wallet is not loaded."
fi

echo "NVUN default wallet is loaded."

#
# First try to reuse an address already carrying
# the Umbrel Mining label.
#

LABELED=$(
    rpc getaddressesbylabel "$WALLET_LABEL" 2>/dev/null ||
    true
)

PAYOUT_ADDRESS=$(
    printf '%s\n' "$LABELED" |
        sed -n \
            's/^[[:space:]]*"\([^"]*\)"[[:space:]]*:[[:space:]]*{.*/\1/p' |
        head -1
)

#
# No existing labeled address was found.
# Create one in the local default wallet.
#

if [ -z "$PAYOUT_ADDRESS" ]; then
    echo "No existing Umbrel Mining address found."
    echo "Creating local mining payout address..."

    PAYOUT_ADDRESS=$(
        rpc getnewaddress "$WALLET_LABEL"
    ) || fail "Unable to create mining payout address."

    PAYOUT_ADDRESS=$(
        printf '%s' "$PAYOUT_ADDRESS" |
            tr -d '\r\n"'
    )
else
    echo "Existing Umbrel Mining address found."
fi

if [ -z "$PAYOUT_ADDRESS" ]; then
    fail "Mining payout address is empty."
fi

case "$PAYOUT_ADDRESS" in
    nvu:*)
        ;;
    *)
        fail "Mining payout address does not have the expected NVU prefix."
        ;;
esac

#
# Persist atomically so ASICseer never sees a
# partially written address.
#

TEMP_FILE="$PAYOUT_FILE.tmp"

umask 077

printf '%s\n' "$PAYOUT_ADDRESS" > "$TEMP_FILE"

chmod 600 "$TEMP_FILE"

mv -f \
    "$TEMP_FILE" \
    "$PAYOUT_FILE"

echo "Mining payout initialization complete."
echo "Wallet: default"
echo "Label: $WALLET_LABEL"
echo "Mining payout address: $PAYOUT_ADDRESS"

exit 0
