import os
import re
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_from_directory

from asicseer_status import ASICseerStatus
from blocks_found import BlocksFoundParser
from nvu_rpc import NVURPC, NVURPCError


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(
    __name__,
    static_folder=STATIC_DIR,
    static_url_path="/static",
)

rpc = NVURPC()
asicseer = ASICseerStatus()
blocks_found = BlocksFoundParser()


def api_error(message, status=500):
    return jsonify({
        "ok": False,
        "error": str(message),
    }), status


def unix_time_to_iso(value):
    try:
        return datetime.fromtimestamp(
            int(value),
            tz=timezone.utc,
        ).isoformat()
    except (TypeError, ValueError, OSError):
        return None


@app.errorhandler(NVURPCError)
def handle_rpc_error(exc):
    return api_error(exc, 502)


@app.route("/")
def home():
    return send_from_directory(
        STATIC_DIR,
        "index.html",
    )


@app.route("/api/health")
def health():
    try:
        height = rpc.block_count()

        return jsonify({
            "ok": True,
            "nvun": True,
            "height": height,
        })

    except NVURPCError as exc:
        return jsonify({
            "ok": False,
            "nvun": False,
            "error": str(exc),
        }), 503


@app.route("/api/status")
def status():
    blockchain = rpc.blockchain_info()
    network = rpc.network_info()
    peers = rpc.peer_info()
    pool = asicseer.status()

    inbound = sum(
        1
        for peer in peers
        if bool(peer.get("inbound"))
    )

    outbound = len(peers) - inbound

    return jsonify({
        "ok": True,

        "nvun": {
            "online": True,
            "version": network.get("subversion"),
            "protocolVersion": network.get(
                "protocolversion"
            ),
            "connections": network.get(
                "connections",
                len(peers),
            ),
            "height": blockchain.get("blocks"),
            "headers": blockchain.get("headers"),
            "bestBlockHash": blockchain.get(
                "bestblockhash"
            ),
            "difficulty": blockchain.get(
                "difficulty"
            ),
            "networkHashrate": rpc.network_hashrate(),
            "verificationProgress": blockchain.get(
                "verificationprogress"
            ),
            "initialBlockDownload": blockchain.get(
                "initialblockdownload"
            ),
            "chainwork": blockchain.get(
                "chainwork"
            ),
            "chain": blockchain.get("chain"),
            "peerCount": len(peers),
            "inboundPeers": inbound,
            "outboundPeers": outbound,
            "p2pPort": int(
                os.getenv(
                    "NVUN_P2P_PORT",
                    "9333",
                )
            ),
        },

        "asicseer": {
            **pool,
            "stratumPort": int(
                os.getenv(
                    "ASICSEER_STRATUM_PORT",
                    "3336",
                )
            ),
        },
    })


@app.route("/api/network")
def network():
    blockchain = rpc.blockchain_info()
    network_info = rpc.network_info()

    return jsonify({
        "ok": True,
        "blockchain": blockchain,
        "network": network_info,
    })


@app.route("/api/peers")
def peers():
    raw_peers = rpc.peer_info()
    result = []

    for peer in raw_peers:
        result.append({
            "id": peer.get("id"),
            "addr": peer.get("addr"),
            "addrbind": peer.get("addrbind"),
            "inbound": peer.get("inbound"),
            "version": peer.get("version"),
            "subver": peer.get("subver"),
            "startingHeight": peer.get(
                "startingheight"
            ),
            "syncedHeaders": peer.get(
                "synced_headers"
            ),
            "syncedBlocks": peer.get(
                "synced_blocks"
            ),
            "connectionTime": peer.get(
                "conntime"
            ),
            "bytesSent": peer.get(
                "bytessent"
            ),
            "bytesReceived": peer.get(
                "bytesrecv"
            ),
        })

    return jsonify({
        "ok": True,
        "count": len(result),
        "peers": result,
    })


@app.route("/api/mining")
def mining():
    pool = asicseer.status()

    return jsonify({
        "ok": True,
        "asicseer": pool,
        "stratumPort": int(
            os.getenv(
                "ASICSEER_STRATUM_PORT",
                "3336",
            )
        ),
        "rpcHost": os.getenv(
            "NVUN_RPC_HOST",
            "nvun",
        ),
        "rpcPort": int(
            os.getenv(
                "NVUN_RPC_PORT",
                "9332",
            )
        ),
    })


@app.route("/api/mining/blocks")
def mining_blocks():
    requested = request.args.get(
        "limit",
        "25",
    )

    try:
        limit = int(requested)
    except (TypeError, ValueError):
        return api_error(
            "limit must be an integer",
            400,
        )

    limit = max(1, min(limit, 100))
    current_height = rpc.block_count()

    events = blocks_found.parse(
        limit=limit
    )

    results = []

    for event in events:
        item = dict(event)
        height = item["height"]

        try:
            block_hash = rpc.block_hash(height)
            block = rpc.block(
                block_hash,
                1,
            )

            item["hash"] = block_hash
            item["confirmations"] = block.get(
                "confirmations"
            )

            item["blockTime"] = block.get("time")
            item["blockTimeIso"] = (
                unix_time_to_iso(
                    block.get("time")
                )
            )

            item["status"] = (
                "Confirmed"
                if block.get("confirmations", 0) > 0
                else "Accepted"
            )

        except NVURPCError:
            item["hash"] = None
            item["confirmations"] = None
            item["blockTime"] = None
            item["blockTimeIso"] = None
            item["status"] = (
                "Accepted"
                if item.get("accepted")
                else "Unknown"
            )

        item["chainTip"] = current_height
        results.append(item)

    return jsonify({
        "ok": True,
        "count": len(results),
        "blocks": results,
    })


@app.route("/api/blocks/latest")
def latest_blocks():
    requested = request.args.get(
        "limit",
        os.getenv(
            "DASHBOARD_LATEST_BLOCKS",
            "20",
        ),
    )

    try:
        limit = int(requested)
    except (TypeError, ValueError):
        return api_error(
            "limit must be an integer",
            400,
        )

    limit = max(1, min(limit, 100))

    tip = rpc.block_count()
    start = max(0, tip - limit + 1)

    blocks = []

    for height in range(
        tip,
        start - 1,
        -1,
    ):
        block_hash = rpc.block_hash(height)
        block = rpc.block(
            block_hash,
            1,
        )

        transactions = block.get("tx", [])

        blocks.append({
            "height": block.get(
                "height",
                height,
            ),
            "hash": block.get(
                "hash",
                block_hash,
            ),
            "time": block.get("time"),
            "timeIso": unix_time_to_iso(
                block.get("time")
            ),
            "size": block.get("size"),
            "txCount": len(transactions),
            "difficulty": block.get(
                "difficulty"
            ),
            "confirmations": block.get(
                "confirmations"
            ),
        })

    return jsonify({
        "ok": True,
        "tip": tip,
        "blocks": blocks,
    })


@app.route("/api/block/<identifier>")
def block(identifier):
    identifier = identifier.strip()

    if identifier.isdigit():
        height = int(identifier)
        current_height = rpc.block_count()

        if (
            height < 0
            or height > current_height
        ):
            return api_error(
                "Block height is outside "
                "the current chain",
                404,
            )

        block_hash = rpc.block_hash(height)

    else:
        block_hash = identifier

        if not re.fullmatch(
            r"[0-9a-fA-F]{64}",
            block_hash,
        ):
            return api_error(
                "Invalid block height "
                "or block hash",
                400,
            )

    result = rpc.block(
        block_hash,
        2,
    )

    return jsonify({
        "ok": True,
        "block": result,
    })


@app.route("/api/transaction/<txid>")
def transaction(txid):
    txid = txid.strip()

    if not re.fullmatch(
        r"[0-9a-fA-F]{64}",
        txid,
    ):
        return api_error(
            "Invalid transaction ID",
            400,
        )

    try:
        result = rpc.raw_transaction(
            txid,
            True,
        )

    except NVURPCError as exc:
        return api_error(
            exc,
            404,
        )

    return jsonify({
        "ok": True,
        "transaction": result,
    })


@app.route("/api/search")
def search():
    query = request.args.get(
        "q",
        "",
    ).strip()

    if not query:
        return api_error(
            "Search query is required",
            400,
        )

    if query.isdigit():
        height = int(query)
        current_height = rpc.block_count()

        if 0 <= height <= current_height:
            block_hash = rpc.block_hash(
                height
            )

            return jsonify({
                "ok": True,
                "type": "block",
                "height": height,
                "hash": block_hash,
            })

        return api_error(
            "Block height was not found",
            404,
        )

    if re.fullmatch(
        r"[0-9a-fA-F]{64}",
        query,
    ):
        try:
            found_block = rpc.block(
                query,
                1,
            )

            return jsonify({
                "ok": True,
                "type": "block",
                "height": found_block.get(
                    "height"
                ),
                "hash": found_block.get(
                    "hash",
                    query,
                ),
            })

        except NVURPCError:
            pass

        try:
            tx = rpc.raw_transaction(
                query,
                True,
            )

            return jsonify({
                "ok": True,
                "type": "transaction",
                "txid": tx.get(
                    "txid",
                    query,
                ),
            })

        except NVURPCError:
            pass

        return api_error(
            "No block or transaction "
            "was found",
            404,
        )

    return api_error(
        "Search accepts a block height, "
        "block hash, or transaction ID",
        400,
    )


@app.route("/api/version")
def version():
    return jsonify({
        "ok": True,
        "dashboardVersion": "0.2.1",
        "project": "Nouveau-Vision Unit",
        "ticker": "NVU",
    })


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(
        STATIC_DIR,
        path,
    )


if __name__ == "__main__":
    host = os.getenv(
        "DASHBOARD_HOST",
        "0.0.0.0",
    )

    port = int(
        os.getenv(
            "DASHBOARD_PORT",
            "8080",
        )
    )

    app.run(
        host=host,
        port=port,
        debug=False,
    )
