import os
from pathlib import Path

import requests


class NVURPCError(RuntimeError):
    pass


class NVURPC:
    def __init__(self):
        self.host = os.getenv("NVUN_RPC_HOST", "nvun")
        self.port = int(os.getenv("NVUN_RPC_PORT", "9332"))
        self.username = os.getenv("NVUN_RPC_USER", "nvupool")

        credentials_dir = Path(
            os.getenv("NVUN_CREDENTIALS_DIR", "/run/nvu-credentials")
        )

        password_file = credentials_dir / "rpcpassword"

        if not password_file.is_file():
            raise NVURPCError(
                f"RPC password file not found: {password_file}"
            )

        self.password = password_file.read_text(
            encoding="utf-8"
        ).strip()

        if not self.password:
            raise NVURPCError("RPC password file is empty")

        self.url = f"http://{self.host}:{self.port}/"

        self.session = requests.Session()
        self.session.auth = (
            self.username,
            self.password,
        )

    def call(self, method, params=None):
        payload = {
            "jsonrpc": "1.0",
            "id": "nvu-dashboard",
            "method": method,
            "params": params or [],
        }

        try:
            response = self.session.post(
                self.url,
                json=payload,
                timeout=10,
            )
            response.raise_for_status()

        except requests.RequestException as exc:
            raise NVURPCError(
                f"Unable to contact NVUN RPC: {exc}"
            ) from exc

        try:
            data = response.json()

        except ValueError as exc:
            raise NVURPCError(
                "NVUN returned an invalid JSON response"
            ) from exc

        if data.get("error"):
            raise NVURPCError(
                f"NVUN RPC error: {data['error']}"
            )

        return data.get("result")

    def blockchain_info(self):
        return self.call("getblockchaininfo")

    def network_info(self):
        return self.call("getnetworkinfo")

    def peer_info(self):
        return self.call("getpeerinfo")

    def best_block_hash(self):
        return self.call("getbestblockhash")

    def block_count(self):
        return self.call("getblockcount")

    def uptime(self):
        return self.call("uptime")

    def list_wallets(self):
        return self.call(
            "listwallets"
        )

    def wallet_info(self):
        return self.call(
            "getwalletinfo"
        )

    def wallet_transactions(
        self,
        count=10,
        skip=0,
        include_watchonly=True,
    ):
        return self.call(
            "listtransactions",
            [
                "*",
                int(count),
                int(skip),
                bool(include_watchonly),
            ],
        )

    def received_addresses(
        self,
        min_confirmations=0,
        include_empty=True,
        include_watchonly=True,
    ):
        return self.call(
            "listreceivedbyaddress",
            [
                int(min_confirmations),
                bool(include_empty),
                bool(include_watchonly),
            ],
        )

    def difficulty(self):
        return self.call("getdifficulty")

    def network_hashrate(self):
        return self.call("getnetworkhashps")

    def block_hash(self, height):
        return self.call(
            "getblockhash",
            [int(height)],
        )

    def block(self, block_hash, verbosity=2):
        return self.call(
            "getblock",
            [block_hash, verbosity],
        )

    def raw_transaction(self, txid, verbose=True):
        return self.call(
            "getrawtransaction",
            [txid, verbose],
        )
