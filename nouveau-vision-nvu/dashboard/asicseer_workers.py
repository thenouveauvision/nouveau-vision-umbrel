import json
import os
import re
import time
from pathlib import Path


class ASICseerWorkers:
    def __init__(self):
        self.log_dir = Path(
            os.getenv(
                "ASICSEER_LOG_DIR",
                "/var/log/asicseer",
            )
        )

        self.users_dir = (
            self.log_dir / "users"
        )

    @staticmethod
    def _hashrate_is_positive(value):
        if value is None:
            return False

        text = str(value).strip()

        if not text:
            return False

        match = re.match(
            r"^([+-]?(?:\d+(?:\.\d*)?|\.\d+))",
            text,
        )

        if not match:
            return False

        try:
            return float(
                match.group(1)
            ) > 0

        except (TypeError, ValueError):
            return False

    @staticmethod
    def _split_worker_name(
        worker_name,
        default_account,
    ):
        worker_name = str(
            worker_name or ""
        ).strip()

        if not worker_name:
            return (
                default_account,
                "",
            )

        if "." not in worker_name:
            return (
                default_account,
                worker_name,
            )

        account, worker = (
            worker_name.rsplit(
                ".",
                1,
            )
        )

        return (
            account or default_account,
            worker or worker_name,
        )

    def _user_files(self):
        if not self.users_dir.is_dir():
            return []

        try:
            return sorted(
                path
                for path in self.users_dir.iterdir()
                if path.is_file()
            )

        except OSError:
            return []

    @staticmethod
    def _load_user(path):
        try:
            text = path.read_text(
                encoding="utf-8"
            )

            data = json.loads(text)

        except (
            OSError,
            UnicodeError,
            json.JSONDecodeError,
            TypeError,
        ):
            return None

        if not isinstance(data, dict):
            return None

        return data

    def status(
        self,
        active_window=300,
    ):
        try:
            active_window = int(
                active_window
            )

        except (TypeError, ValueError):
            active_window = 300

        active_window = max(
            30,
            min(
                active_window,
                3600,
            ),
        )

        now = int(time.time())

        workers = []
        user_count = 0

        for path in self._user_files():
            data = self._load_user(
                path
            )

            if data is None:
                continue

            user_count += 1

            default_account = (
                path.name
            )

            worker_records = data.get(
                "worker",
                [],
            )

            if not isinstance(
                worker_records,
                list,
            ):
                continue

            for record in worker_records:
                if not isinstance(
                    record,
                    dict,
                ):
                    continue

                worker_name = str(
                    record.get(
                        "workername",
                        "",
                    )
                ).strip()

                if not worker_name:
                    continue

                account, worker = (
                    self._split_worker_name(
                        worker_name,
                        default_account,
                    )
                )

                last_share = record.get(
                    "lastshare"
                )

                try:
                    last_share = int(
                        last_share
                    )

                except (
                    TypeError,
                    ValueError,
                ):
                    last_share = None

                share_age = None

                if last_share is not None:
                    share_age = max(
                        0,
                        now - last_share,
                    )

                hashrate_1m = record.get(
                    "hashrate1m"
                )

                active = (
                    share_age is not None
                    and
                    share_age <= active_window
                    and
                    self._hashrate_is_positive(
                        hashrate_1m
                    )
                )

                workers.append({
                    "account":
                        account,

                    "worker":
                        worker,

                    "workerName":
                        worker_name,

                    "active":
                        active,

                    "lastShare":
                        last_share,

                    "shareAgeSeconds":
                        share_age,

                    "hashrate": {
                        "1m":
                            hashrate_1m,

                        "5m":
                            record.get(
                                "hashrate5m"
                            ),

                        "1h":
                            record.get(
                                "hashrate1hr"
                            ),

                        "1d":
                            record.get(
                                "hashrate1d"
                            ),

                        "7d":
                            record.get(
                                "hashrate7d"
                            ),
                    },

                    "shares":
                        record.get(
                            "shares"
                        ),

                    "bestShare":
                        record.get(
                            "bestshare"
                        ),

                    "bestShareAllTime":
                        record.get(
                            "bestshare_alltime"
                        ),
                })

        # Active workers first, then newest share.
        workers.sort(
            key=lambda item: (
                not item["active"],
                -(
                    item["lastShare"]
                    if item["lastShare"]
                    is not None
                    else 0
                ),
                item["account"].lower(),
                item["worker"].lower(),
            )
        )

        active_count = sum(
            1
            for worker in workers
            if worker["active"]
        )

        return {
            "count":
                len(workers),

            "activeCount":
                active_count,

            "users":
                user_count,

            "activeWindowSeconds":
                active_window,

            "workers":
                workers,
        }
