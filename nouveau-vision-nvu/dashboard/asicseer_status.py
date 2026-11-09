import json
import os
import re
import time
from collections import deque
from pathlib import Path


class ASICseerStatus:
    def __init__(self):
        self.log_dir = Path(
            os.getenv(
                "ASICSEER_LOG_DIR",
                "/var/log/asicseer",
            )
        )

    def _log_files(self):
        if not self.log_dir.exists():
            return []

        try:
            files = [
                path
                for path in self.log_dir.iterdir()
                if path.is_file()
            ]
        except OSError:
            return []

        try:
            return sorted(
                files,
                key=lambda path: path.stat().st_mtime,
                reverse=True,
            )
        except OSError:
            return files

    def _primary_log(self):
        files = self._log_files()

        if not files:
            return None

        return files[0]

    def _read_log_tail(self, byte_limit=4 * 1024 * 1024):
        path = self._primary_log()

        if path is None:
            return ""

        try:
            size = path.stat().st_size

            with path.open("rb") as handle:
                if size > byte_limit:
                    handle.seek(-byte_limit, 2)

                data = handle.read()

            return data.decode(
                "utf-8",
                errors="replace",
            )

        except OSError:
            return ""

    def recent_lines(self, limit=250):
        try:
            limit = int(limit)
        except (TypeError, ValueError):
            limit = 250

        limit = max(1, min(limit, 1000))
        lines = deque(maxlen=limit)

        text = self._read_log_tail()

        for line in text.splitlines():
            line = line.rstrip()

            if line:
                lines.append(line)

        return list(lines)

    @staticmethod
    def _contains(text, phrase):
        return phrase in text

    @staticmethod
    def _configured_counts(text):
        pattern = re.compile(
            r"Loaded\s+(\d+)\s+users?\s+and\s+"
            r"(\d+)\s+workers?"
        )

        matches = list(pattern.finditer(text))

        if not matches:
            return None, None

        match = matches[-1]

        return (
            int(match.group(1)),
            int(match.group(2)),
        )

    @staticmethod
    def _rpc_endpoint(text):
        pattern = re.compile(
            r"Connected to bitcoind:\s*(\S+)"
        )

        matches = list(pattern.finditer(text))

        if not matches:
            return None

        return matches[-1].group(1)

    @staticmethod
    def _pool_statistics(text):
        combined = {}

        for line in text.splitlines():
            marker = "Pool:{"

            position = line.find(marker)

            if position < 0:
                continue

            payload = line[position + len("Pool:"):].strip()

            try:
                record = json.loads(payload)
            except (json.JSONDecodeError, TypeError):
                continue

            if isinstance(record, dict):
                combined.update(record)

        return combined

    def _log_contains(self, phrase):
        path = self._primary_log()

        if path is None:
            return False

        try:
            with path.open(
                "r",
                encoding="utf-8",
                errors="replace",
            ) as handle:
                for line in handle:
                    if phrase in line:
                        return True

        except OSError:
            return False

        return False

    def _current_rpc_connected(self, text):
        success_markers = (
            "Connected to bitcoind",
            "BLOCK ACCEPTED!",
            "confirms block was CONFIRMED",
            "Stored local workbase",
        )

        failure_markers = (
            "Unable to connect socket",
            "Failed to connect socket",
            "Failed to get valid json response",
            "Failed to get block template",
            "No bitcoinds active",
            "Generator failed in update_base",
        )

        latest_success = -1
        latest_failure = -1

        for marker in success_markers:
            latest_success = max(
                latest_success,
                text.rfind(marker),
            )

        for marker in failure_markers:
            latest_failure = max(
                latest_failure,
                text.rfind(marker),
            )

        if (
            latest_success >= 0
            or latest_failure >= 0
        ):
            return (
                latest_success
                > latest_failure
            )

        return self._log_contains(
            "Connected to bitcoind"
        )

    @staticmethod
    def _latest_timestamp(text):
        pattern = re.compile(
            r"\[(\d{4}-\d{2}-\d{2} "
            r"\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]"
        )

        matches = list(pattern.finditer(text))

        if not matches:
            return None

        return matches[-1].group(1)

    def _log_age_seconds(self):
        path = self._primary_log()

        if path is None:
            return None

        try:
            return max(
                0,
                int(time.time() - path.stat().st_mtime),
            )
        except OSError:
            return None

    def status(self):
        text = self._read_log_tail()
        lines = self.recent_lines(250)

        statistics = self._pool_statistics(text)

        solo_mode = self._log_contains(
            "Solo mode activated"
        )

        generator_ready = (
            self._log_contains(
                "generator ready"
            )
        )

        stratifier_ready = (
            self._log_contains(
                "stratifier ready"
            )
        )

        connector_ready = (
            self._log_contains(
                "connector ready"
            )
        )

        rpc_connected = (
            self._current_rpc_connected(
                text
            )
        )

        recent_workbase = self._contains(
            "\n".join(lines),
            "Stored local workbase",
        )

        log_age = self._log_age_seconds()

        recent_log_activity = (
            log_age is not None
            and log_age <= 180
        )

        structured_stats_available = bool(statistics)

        online = (
            recent_log_activity
            and (
                structured_stats_available
                or recent_workbase
            )
        )

        configured_users, configured_workers = (
            self._configured_counts(text)
        )

        active_users = statistics.get("Users")
        active_workers = statistics.get("Workers")

        rpc_endpoint = self._rpc_endpoint(text)

        zmq_warning = self._contains(
            "\n".join(lines),
            "ZMQ: failure threshold hit",
        )

        return {
            "online": online,
            "soloMode": solo_mode,
            "rpcConnected": rpc_connected,
            "rpcEndpoint": rpc_endpoint,

            "generatorReady": generator_ready,
            "connectorReady": connector_ready,
            "stratifierReady": stratifier_ready,

            "users": active_users,
            "workers": active_workers,
            "configuredUsers": configured_users,
            "configuredWorkers": configured_workers,
            "idleWorkers": statistics.get("Idle"),
            "disconnectedWorkers": statistics.get(
                "Disconnected"
            ),

            "runtimeSeconds": statistics.get("runtime"),
            "lastUpdate": statistics.get("lastupdate"),
            "latestLogTimestamp": self._latest_timestamp(
                text
            ),
            "logAgeSeconds": log_age,

            "hashrate": {
                "1m": statistics.get("hashrate1m"),
                "5m": statistics.get("hashrate5m"),
                "15m": statistics.get("hashrate15m"),
                "1h": statistics.get("hashrate1hr"),
                "6h": statistics.get("hashrate6hr"),
                "1d": statistics.get("hashrate1d"),
                "7d": statistics.get("hashrate7d"),
            },

            "sharesPerSecond": {
                "1m": statistics.get("SPS1m"),
                "5m": statistics.get("SPS5m"),
                "15m": statistics.get("SPS15m"),
                "1h": statistics.get("SPS1h"),
            },

            "poolDifficulty": statistics.get("diff"),
            "acceptedShares": statistics.get("accepted"),
            "rejectedShares": statistics.get("rejected"),
            "bestShare": statistics.get("bestshare"),
            "bestShareAllTime": statistics.get(
                "bestshare_alltime"
            ),
            "lns": statistics.get("lns"),
            "herp": statistics.get("herp"),
            "reward": statistics.get("reward"),

            "recentWorkbase": recent_workbase,
            "zmqWarning": zmq_warning,
            "recentActivity": lines[-25:],
        }
