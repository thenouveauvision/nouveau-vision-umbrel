import os
import re
from datetime import datetime, timezone
from pathlib import Path


class BlocksFoundParser:
    SOLVED_PATTERN = re.compile(
        r"^\[(?P<timestamp>[^\]]+)\]\s+"
        r"Solved block\s+(?P<height>\d+)\s+by\s+"
        r"(?P<account>\S+?)\.(?P<worker>[^\s]+)\s*$"
    )

    EFFORT_PATTERN = re.compile(
        r"^\[(?P<timestamp>[^\]]+)\]\s+"
        r"Block solved after\s+(?P<shares>\d+)\s+shares\s+"
        r"at\s+(?P<effort>[0-9]+(?:[.][0-9]+)?)%\s+effort\s*$"
    )

    SOLVE_DIFFICULTY_PATTERN = re.compile(
        r"^\[(?P<timestamp>[^\]]+)\]\s+"
        r"Possible block solve diff\s+"
        r"(?P<solve_difficulty>[0-9]+(?:[.][0-9]+)?)\s+"
        r"\(network diff:\s*"
        r"(?P<network_difficulty>[0-9]+(?:[.][0-9]+)?)\)"
    )

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
            )
        except OSError:
            return files

    @staticmethod
    def _timestamp_to_iso(value):
        formats = (
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
        )

        for date_format in formats:
            try:
                parsed = datetime.strptime(
                    value,
                    date_format,
                )

                return parsed.replace(
                    tzinfo=timezone.utc
                ).isoformat()

            except ValueError:
                continue

        return None

    def _read_lines(self):
        lines = []

        for path in self._log_files():
            try:
                with path.open(
                    "r",
                    encoding="utf-8",
                    errors="replace",
                ) as handle:
                    lines.extend(
                        line.rstrip()
                        for line in handle
                        if line.strip()
                    )
            except OSError:
                continue

        return lines

    def parse(self, limit=100):
        try:
            limit = int(limit)
        except (TypeError, ValueError):
            limit = 100

        limit = max(1, min(limit, 500))

        lines = self._read_lines()
        events = []
        pending_difficulty = None

        for index, line in enumerate(lines):
            difficulty_match = (
                self.SOLVE_DIFFICULTY_PATTERN.match(line)
            )

            if difficulty_match:
                pending_difficulty = {
                    "solveDifficulty": float(
                        difficulty_match.group(
                            "solve_difficulty"
                        )
                    ),
                    "networkDifficulty": float(
                        difficulty_match.group(
                            "network_difficulty"
                        )
                    ),
                }
                continue

            solved_match = self.SOLVED_PATTERN.match(line)

            if not solved_match:
                continue

            timestamp = solved_match.group("timestamp")
            height = int(solved_match.group("height"))
            account = solved_match.group("account")
            worker = solved_match.group("worker")

            event = {
                "height": height,
                "timestamp": timestamp,
                "timestampIso": self._timestamp_to_iso(
                    timestamp
                ),
                "account": account,
                "worker": worker,
                "shares": None,
                "effortPercent": None,
                "solveDifficulty": None,
                "networkDifficulty": None,
                "accepted": False,
            }

            if pending_difficulty:
                event.update(pending_difficulty)

            search_start = max(0, index - 5)
            search_end = min(len(lines), index + 6)

            nearby_lines = lines[
                search_start:search_end
            ]

            event["accepted"] = any(
                "BLOCK ACCEPTED!" in nearby
                for nearby in nearby_lines
            )

            for nearby in nearby_lines:
                effort_match = (
                    self.EFFORT_PATTERN.match(nearby)
                )

                if not effort_match:
                    continue

                event["shares"] = int(
                    effort_match.group("shares")
                )

                event["effortPercent"] = float(
                    effort_match.group("effort")
                )

                break

            events.append(event)
            pending_difficulty = None

        deduplicated = {}

        for event in events:
            deduplicated[event["height"]] = event

        ordered = sorted(
            deduplicated.values(),
            key=lambda event: event["height"],
            reverse=True,
        )

        return ordered[:limit]
