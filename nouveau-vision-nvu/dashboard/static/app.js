"use strict";

(() => {
    const NODE_NAME = "Umbrel";
    const NODE_HOSTNAME = "umbrel.local";
    const P2P_PORT = 9333;

    const STATUS_API =
        "/api/status";

    const PEERS_API =
        "/api/peers";

    const BLOCKS_API =
        "/api/blocks/latest?limit=25";

    const MINING_API =
        "/api/mining";

    const MINING_BLOCKS_API =
        "/api/mining/blocks?limit=25";

    const MINING_WORKERS_API =
        "/api/mining/workers";

    const WALLET_STATUS_API =
        "/api/wallet/status";

    const WALLET_TRANSACTIONS_API =
        "/api/wallet/transactions?limit=25";

    const WALLET_ADDRESSES_API =
        "/api/wallet/addresses";

    const REFRESH_INTERVAL = 10000;

    let refreshTimer = null;

    const LATEST_BLOCKS_PAGE_SIZE = 5;
    const LATEST_BLOCKS_LIMIT = 25;

    let latestBlocks = [];
    let latestBlocksPage = 1;

    const MINING_BLOCKS_PAGE_SIZE = 5;

    let miningBlocks = [];
    let miningBlocksPage = 1;

    const WALLET_TRANSACTIONS_PAGE_SIZE = 5;
    const WALLET_TRANSACTIONS_LIMIT = 25;

    let walletTransactions = [];
    let walletTransactionsPage = 1;


    /* =====================================================
       FORMATTERS
       ===================================================== */

function updateLastUpdated(timestamp) {
    const element =
        document.getElementById(
            "last-updated-time"
        );

    const value = Number(timestamp);

    if (
        !element ||
        !Number.isFinite(value)
    ) {
        return;
    }

    element.textContent =
        new Intl.DateTimeFormat(
            "en-US",
            {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit"
            }
        ).format(
            new Date(value * 1000)
        );
}


    function setText(element, value) {
        if (
            element &&
            value !== null &&
            value !== undefined
        ) {
            element.textContent = String(value);
        }
    }


    function formatInteger(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        return new Intl.NumberFormat(
            "en-US",
            {
                maximumFractionDigits: 0
            }
        ).format(number);
    }


    function formatDifficulty(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        if (number >= 1e12) {
            return `${(number / 1e12).toFixed(2)}T`;
        }

        if (number >= 1e9) {
            return `${(number / 1e9).toFixed(2)}G`;
        }

        if (number >= 1e6) {
            return `${(number / 1e6).toFixed(2)}M`;
        }

        if (number >= 1e3) {
            return `${(number / 1e3).toFixed(2)}K`;
        }

        return number.toFixed(2);
    }


    function formatHashrate(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        const units = [
            ["EH/s", 1e18],
            ["PH/s", 1e15],
            ["TH/s", 1e12],
            ["GH/s", 1e9],
            ["MH/s", 1e6],
            ["kH/s", 1e3],
            ["H/s", 1]
        ];

        for (const [label, divisor] of units) {
            if (number >= divisor) {
                const result = number / divisor;

                const decimals =
                    result >= 100
                        ? 0
                        : result >= 10
                            ? 1
                            : 2;

                return (
                    result.toFixed(decimals) +
                    " " +
                    label
                );
            }
        }

        return "0 H/s";
    }


    function formatBytes(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB",
            "TB"
        ];

        let current = number;
        let index = 0;

        while (
            current >= 1024 &&
            index < units.length - 1
        ) {
            current /= 1024;
            index += 1;
        }

        const decimals =
            index === 0
                ? 0
                : current >= 100
                    ? 0
                    : current >= 10
                        ? 1
                        : 2;

        return (
            current.toFixed(decimals) +
            " " +
            units[index]
        );
    }


    function formatUptime(seconds) {
        const value = Number(seconds);

        if (!Number.isFinite(value)) {
            return "—";
        }

        const days = Math.floor(
            value / 86400
        );

        const hours = Math.floor(
            (value % 86400) / 3600
        );

        const minutes = Math.floor(
            (value % 3600) / 60
        );

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        }

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }

        return `${minutes}m`;
    }


    function formatDate(unixTime) {
        const value = Number(unixTime);

        if (!Number.isFinite(value)) {
            return "—";
        }

        return new Intl.DateTimeFormat(
            "en-US",
            {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit"
            }
        ).format(
            new Date(value * 1000)
        );
    }


    function shortenHash(hash) {
        if (!hash) {
            return "—";
        }

        const value = String(hash);

        if (value.length <= 36) {
            return value;
        }

        return (
            value.slice(0, 20) +
            "…" +
            value.slice(-12)
        );
    }


    /* =====================================================
       METRIC CARDS
       ===================================================== */

    function findMetricCard(label) {
        const cards =
            document.querySelectorAll(
                ".card"
            );

        for (const card of cards) {
            const labelElement =
                card.querySelector(
                    ".card-label"
                );

            if (
                labelElement &&
                labelElement.textContent.trim() === label
            ) {
                return card;
            }
        }

        return null;
    }


    function setMetric(
        label,
        value,
        foot
    ) {
        const card =
            findMetricCard(label);

        if (!card) {
            return;
        }

        setText(
            card.querySelector(
                ".card-value"
            ),
            value
        );

        if (foot !== undefined) {
            setText(
                card.querySelector(
                    ".card-foot"
                ),
                foot
            );
        }
    }


    /* =====================================================
       NODE DETAILS
       ===================================================== */

    function findDetailRow(label) {
        const rows =
            document.querySelectorAll(
                ".detail-row"
            );

        for (const row of rows) {
            const key =
                row.querySelector(
                    ".detail-key"
                );

            if (
                key &&
                key.textContent.trim() === label
            ) {
                return row;
            }
        }

        return null;
    }


    function setDetail(
        label,
        value
    ) {
        const row =
            findDetailRow(label);

        if (!row) {
            return;
        }

        setText(
            row.querySelector(
                ".detail-value"
            ),
            value
        );
    }


    /* =====================================================
       PUBLIC NODE CARDS
       ===================================================== */

    function findNodeCard(hostname) {
        const cards =
            document.querySelectorAll(
                ".node-card"
            );

        for (const card of cards) {
            const hostnameElement =
                card.querySelector(
                    ".hostname"
                );

            if (
                hostnameElement &&
                hostnameElement.textContent.trim()
                    === hostname
            ) {
                return card;
            }
        }

        return null;
    }


    function configureLocalNodeCard() {
        const cards =
            document.querySelectorAll(
                ".node-card"
            );

        for (const card of cards) {
            card.classList.remove(
                "current"
            );

            const existingBadge =
                card.querySelector(
                    ".current-badge"
                );

            if (existingBadge) {
                existingBadge.remove();
            }
        }

        const localCard =
            findNodeCard(
                NODE_HOSTNAME
            );

        if (!localCard) {
            return;
        }

        localCard.classList.add(
            "current"
        );

        const badge =
            document.createElement(
                "div"
            );

        badge.className =
            "current-badge";

        badge.textContent =
            "THIS NODE";

        localCard.prepend(
            badge
        );
    }


    function updateNodeCard(node) {
        const card =
            findNodeCard(
                node.hostname
            );

        if (!card) {
            return;
        }

        const status =
            card.querySelector(
                ".node-status"
            );

        const values =
            card.querySelectorAll(
                ".mini-value"
            );

        if (status) {
            status.textContent =
                node.online
                    ? "● ONLINE"
                    : "● NOT CONNECTED";

            status.style.color =
                node.online
                    ? "var(--green)"
                    : "var(--muted-dark)";
        }

        if (values.length >= 4) {

            setText(
                values[0],
                node.version
                    ? `NVUN ${node.version}`
                    : "Unknown"
            );

            setText(
                values[1],
                node.height !== null &&
                node.height !== undefined
                    ? formatInteger(
                        node.height
                    )
                    : "—"
            );

setText(
    values[2],
    String(P2P_PORT)
);

const isLocalNode =
    node.hostname === NODE_HOSTNAME;

setText(
    values[3],
    node.online
        ? (
            isLocalNode
                ? "Synced"
                : "Connected"
        )
        : "Not connected"
);
        }

        card.style.opacity =
            node.online
                ? "1"
                : ".66";
    }


    /* =====================================================
       LATEST BLOCKS
       ===================================================== */

    function renderLatestBlocks() {
        const container =
            document.querySelector(
                ".blocks"
            );

        if (!container) {
            return;
        }

        const totalBlocks =
            latestBlocks.length;

        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    totalBlocks /
                    LATEST_BLOCKS_PAGE_SIZE
                )
            );

        latestBlocksPage =
            Math.min(
                Math.max(
                    latestBlocksPage,
                    1
                ),
                totalPages
            );

        const start =
            (
                latestBlocksPage - 1
            ) * LATEST_BLOCKS_PAGE_SIZE;

        const visibleBlocks =
            latestBlocks.slice(
                start,
                start +
                LATEST_BLOCKS_PAGE_SIZE
            );

        container.replaceChildren();

        if (visibleBlocks.length === 0) {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "block-card placeholder";

            row.textContent =
                "No recent block data available.";

            container.appendChild(row);

        } else {
            for (const block of visibleBlocks) {
                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "block-card";

                const height =
                    document.createElement(
                        "div"
                    );

                height.className =
                    "block-height";

                height.textContent =
                    `#${formatInteger(
                        block.height
                    )}`;

                const hash =
                    document.createElement(
                        "div"
                    );

                hash.className =
                    "block-hash";

                hash.title =
                    block.hash || "";

                hash.textContent =
                    shortenHash(
                        block.hash
                    );

                const blockTime =
                    document.createElement(
                        "div"
                    );

                blockTime.className =
                    "block-time";

                blockTime.textContent =
                    formatDate(
                        block.time
                    );

                const transactions =
                    document.createElement(
                        "div"
                    );

                transactions.className =
                    "block-tx";

                transactions.textContent =
                    `${formatInteger(
                        block.tx_count
                    )} tx`;

                row.append(
                    height,
                    hash,
                    blockTime,
                    transactions
                );

                container.appendChild(row);
            }
        }

        const status =
            document.getElementById(
                "latest-blocks-page-status"
            );

        const previous =
            document.getElementById(
                "latest-blocks-prev"
            );

        const next =
            document.getElementById(
                "latest-blocks-next"
            );

        const pagination =
            document.getElementById(
                "latest-blocks-footer"
            );

        if (status) {
            if (totalBlocks === 0) {
                status.textContent =
                    "Showing 0 blocks";

            } else {
                const firstVisible =
                    start + 1;

                const lastVisible =
                    Math.min(
                        start +
                        LATEST_BLOCKS_PAGE_SIZE,
                        totalBlocks
                    );

                status.textContent =
                    (
                        `Showing ${firstVisible}–` +
                        `${lastVisible} of ` +
                        `${totalBlocks} blocks`
                    );
            }
        }

        if (previous) {
            previous.disabled =
                latestBlocksPage <= 1;
        }

        if (next) {
            next.disabled =
                latestBlocksPage >= totalPages;
        }

        if (pagination) {
            pagination.hidden =
                totalPages <= 1;
        }
    }


    function updateLatestBlocks(blocks) {
        if (!Array.isArray(blocks)) {
            return;
        }

        latestBlocks =
            blocks.slice(
                0,
                LATEST_BLOCKS_LIMIT
            );

        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    latestBlocks.length /
                    LATEST_BLOCKS_PAGE_SIZE
                )
            );

        latestBlocksPage =
            Math.min(
                latestBlocksPage,
                totalPages
            );

        renderLatestBlocks();
    }


    /* =====================================================
       OVERALL DASHBOARD HEALTH
       ===================================================== */

    function setOverallState(ok) {
        const headerStatus =
            document.querySelector(
                ".header-status"
            );

        const health =
            document.querySelector(
                ".context-health"
            );


        if (headerStatus) {
            headerStatus.innerHTML =
    ok
        ? (
            '<span class="dot"></span>' +
            `${NODE_NAME.toUpperCase()} ONLINE`
        )
        : (
            '<span class="dot"></span>' +
            `${NODE_NAME.toUpperCase()} UNAVAILABLE`
        );
            headerStatus.style.color =
                ok
                    ? "#bff5dc"
                    : "var(--red)";
        }


        if (health) {
            health.innerHTML =
                ok
                    ? (
                        '<span class="dot"></span>' +
                        "NETWORK HEALTHY"
                    )
                    : (
                        '<span class="dot"></span>' +
                        "STATUS UNAVAILABLE"
                    );

            health.style.color =
                ok
                    ? "#92c6ab"
                    : "var(--red)";
        }
    }


    /* =====================================================
       SUMMARY STRIP
       ===================================================== */

    function updateSummary(data) {
        const values =
            document.querySelectorAll(
                ".summary-item strong"
            );

        if (values.length < 5) {
            return;
        }

        setText(
            values[0],
            "HEALTHY"
        );

        setText(
            values[1],
            NODE_NAME.toUpperCase()
        );

        setText(
            values[2],
            `NVUN ${data.node.version}`
        );

        setText(
            values[3],
            data.node.protocol_version
        );

        setText(
            values[4],
            String(P2P_PORT)
        );
    }


    /* =====================================================
       PEER PANEL
       ===================================================== */

    function updatePeerPanel(data) {
        if (
            window.NVUPeers &&
            typeof window.NVUPeers.setData
                === "function"
        ) {
            window.NVUPeers.setData(
                Array.isArray(data.peers)
                    ? data.peers
                    : []
            );

            return;
        }


        /*
         * Fallback if the inline peer controller
         * has not initialized for some reason.
         */

        const peerCount =
            document.getElementById(
                "peer-count"
            );

        const inboundCount =
            document.getElementById(
                "peer-inbound-count"
            );

        const outboundCount =
            document.getElementById(
                "peer-outbound-count"
            );


        if (peerCount) {
            peerCount.textContent =
                `${data.network.connections} peers`;
        }

        if (inboundCount) {
            inboundCount.textContent =
                `${data.network.connections_in} inbound`;
        }

        if (outboundCount) {
            outboundCount.textContent =
                `${data.network.connections_out} outbound`;
        }
    }


    /* =====================================================
       FULL DASHBOARD UPDATE
       ===================================================== */

function updateDashboard(data) {
    const blockchain =
        data.blockchain;

    const network =
        data.network;

    const node =
        data.node;

setText(
    document.getElementById(
        "umbrel-node-version"
    ),
    node.version
        ? `NVUN ${node.version}`
        : "NVUN —"
);

setText(
    document.getElementById(
        "umbrel-node-height"
    ),
    formatInteger(
        blockchain.blocks
    )
);

setText(
    document.getElementById(
        "umbrel-node-protocol"
    ),
    String(
        node.protocol_version ?? "—"
    )
);

setText(
    document.getElementById(
        "umbrel-node-p2p"
    ),
    String(P2P_PORT)
);

setText(
    document.getElementById(
        "umbrel-node-online"
    ),
    network.active
        ? "● ONLINE"
        : "● OFFLINE"
);

setText(
    document.getElementById(
        "umbrel-node-sync"
    ),
    blockchain.initial_block_download
        ? "Syncing"
        : "Synced"
);

    updateLastUpdated(
        data.generated_at
    );

    document.title =
        `NVU Dashboard | ${NODE_NAME}`;

    setText(
        document.getElementById(
            "context-node-name"
        ),
        NODE_NAME
    );

    setText(
        document.getElementById(
            "context-node-hostname"
        ),
        NODE_HOSTNAME
    );

    setOverallState(true);

    updateSummary(data);


        /* ----------------------------------------------
           TOP METRICS
           ---------------------------------------------- */

        setMetric(
            "Block Height",
            formatInteger(
                blockchain.blocks
            ),
            (
                `${formatInteger(
                    blockchain.headers
                )} validated headers`
            )
        );


        setMetric(
            "Difficulty",
            formatDifficulty(
                blockchain.difficulty
            ),
            "Current mining difficulty"
        );


        setMetric(
            "Connected Peers",
            formatInteger(
                network.connections
            ),
            (
                `${formatInteger(
                    network.connections_in
                )} inbound · ` +
                `${formatInteger(
                    network.connections_out
                )} outbound`
            )
        );


        setMetric(
            "Network Hashrate",
            formatHashrate(
                network.hashrate
            ),
            "Estimated SHA-256 network rate"
        );


        setMetric(
            "Protocol",
            String(
                node.protocol_version
            ),
            `NVUN ${node.version}`
        );


        const verificationProgress =
            Number(
                blockchain.verification_progress
            );

        const verificationPercent =
            Number.isFinite(
                verificationProgress
            )
                ? (
                    verificationProgress *
                    100
                ).toFixed(2)
                : "—";


        setMetric(
            "Sync Status",
            blockchain.initial_block_download
                ? "SYNCING"
                : "SYNCED",
            `${verificationPercent}% verified`
        );


        /* ----------------------------------------------
           NODE DETAILS
           ---------------------------------------------- */

        setDetail(
            "Hostname",
            NODE_HOSTNAME
        );

        setDetail(
            "NVUN",
            node.version
        );

        setDetail(
            "Protocol",
            node.protocol_version
        );

        setDetail(
            "Chain",
            blockchain.chain
        );

        setDetail(
            "P2P Endpoint",
            `${NODE_HOSTNAME}:${P2P_PORT}`
        );

        setDetail(
            "RPC Interface",
            node.rpc_scope
        );

        setDetail(
            "Warnings",
            blockchain.warnings ||
            "None"
        );

        setDetail(
            "Best Block",
            blockchain.best_block_hash
        );

        setDetail(
            "Chainwork",
            blockchain.chainwork
        );

        setDetail(
            "Initial Block Download",
            blockchain.initial_block_download
                ? "True"
                : "False"
        );

        setDetail(
            "Network Active",
            network.active
                ? "True"
                : "False"
        );

        setDetail(
            "Sync Status",
            blockchain.initial_block_download
                ? "Syncing"
                : "Synced"
        );


        /* ----------------------------------------------
           NODE SECTION NOTE
           ---------------------------------------------- */

const nodeSectionTitle =
    document.querySelector(
        "#node .section-title"
    );

if (nodeSectionTitle) {
    nodeSectionTitle.textContent =
        `${NODE_NAME} Details`;
}

        const nodeSectionNote =
            document.querySelector(
                "#node .section-note"
            );

        if (nodeSectionNote) {
            nodeSectionNote.textContent =
                (
                    `${NODE_HOSTNAME} · ` +
                    `${formatUptime(
                        node.uptime_seconds
                    )} uptime · ` +
                    `${formatBytes(
                        blockchain.size_on_disk
                    )} chain data`
                );
        }


        /* ----------------------------------------------
           NODE1 / NODE2 / NODE3
           ---------------------------------------------- */

        if (
            Array.isArray(
                data.known_nodes
            )
        ) {
            data.known_nodes.forEach(
                updateNodeCard
            );
        }


        /* ----------------------------------------------
           PEERS
           ---------------------------------------------- */

        updatePeerPanel(data);


        /* ----------------------------------------------
           BLOCKS
           ---------------------------------------------- */

        updateLatestBlocks(
            data.latest_blocks
        );


        const blockchainNote =
            document.querySelector(
                "#blockchain .section-note"
            );

        if (blockchainNote) {
            blockchainNote.textContent =
                (
                    "Updated " +
                    new Date().toLocaleTimeString()
                );
        }
    }


    /* =====================================================
       FETCH / REFRESH
       ===================================================== */

    function cleanNVUNVersion(value) {
    return String(value || "")
        .replace(
            /^\/NVUN:/,
            ""
        )
        .replace(
            /\/$/,
            ""
        );
}


function buildKnownNodes(
    peers,
    nvun
) {
    const publicNodes = [
        {
            label: "Node1",
            hostname: "node1.nvu.us",
            aliases: [
                "node1.nvu.us",
                "node.nvu.us",
                "72.167.46.0"
            ],
            ip: "72.167.46.0"
        },
        {
            label: "Node2",
            hostname: "node2.nvu.us",
            aliases: [
                "node2.nvu.us",
                "50.62.183.2"
            ],
            ip: "50.62.183.2"
        },
        {
            label: "Node3",
            hostname: "node3.nvu.us",
            aliases: [
                "node3.nvu.us",
                "132.148.79.57"
            ],
            ip: "132.148.79.57"
        }
    ];

    const results =
        publicNodes.map(
            publicNode => {
                const peer =
                    peers.find(
                        candidate => {
                            const address =
                                String(
                                    candidate.address || ""
                                );

                            return (
                                publicNode.aliases.some(
                                    alias =>
                                        address === alias ||
                                        address.startsWith(
                                            `${alias}:`
                                        )
                                )
                            );
                        }
                    );

                return {
                    label:
                        publicNode.label,

                    hostname:
                        publicNode.hostname,

                    ip:
                        publicNode.ip,

                    online:
                        Boolean(peer),

                    version:
                        peer
                            ? cleanNVUNVersion(
                                peer.subversion
                            )
                            : null,

                    height:
                        peer
                            ? peer.height
                            : null,

                    inbound:
                        peer
                            ? Boolean(peer.inbound)
                            : null,

                    connection_type:
                        peer
                            ? peer.connection_type
                            : null,

                    this_node:
                        false
                };
            }
        );

    results.push({
        label:
            "Umbrel",

        hostname:
            NODE_HOSTNAME,

        ip:
            "",

        online:
            Boolean(
                nvun.online
            ),

        version:
            cleanNVUNVersion(
                nvun.version
            ),

        height:
            nvun.height,

        inbound:
            false,

        connection_type:
            "local",

        this_node:
            true
    });

    return results;
}


function formatMiningDifficulty(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    const units = [
        ["T", 1e12],
        ["G", 1e9],
        ["M", 1e6],
        ["K", 1e3]
    ];

    for (const [label, divisor] of units) {
        if (Math.abs(number) >= divisor) {
            const scaled =
                number / divisor;

            const formatted =
                scaled >= 100
                    ? scaled.toFixed(0)
                    : scaled >= 10
                        ? scaled.toFixed(1)
                        : scaled.toFixed(2);

            return `${formatted}${label}`;
        }
    }

    return new Intl.NumberFormat(
        "en-US",
        {
            maximumFractionDigits: 2
        }
    ).format(number);
}


function formatCompactCount(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    const absolute =
        Math.abs(number);

    const units = [
        ["T", 1e12],
        ["G", 1e9],
        ["M", 1e6],
        ["K", 1e3]
    ];

    for (const [suffix, divisor] of units) {
        if (absolute >= divisor) {
            const scaled =
                number / divisor;

            let decimals;

            if (Math.abs(scaled) >= 100) {
                decimals = 0;
            } else if (Math.abs(scaled) >= 10) {
                decimals = 1;
            } else {
                decimals = 2;
            }

            return (
                scaled.toFixed(decimals)
                    .replace(/\.0+$/, "")
                    .replace(
                        /(\.\d*[1-9])0+$/,
                        "$1"
                    )
                + suffix
            );
        }
    }

    return new Intl.NumberFormat(
        "en-US",
        {
            maximumFractionDigits: 0
        }
    ).format(number);
}


function formatMiningHashrate(value) {
    const text =
        String(value || "").trim();

    if (!text) {
        return "—";
    }

    return /H\/s$/i.test(text)
        ? text
        : `${text}H/s`;
}


function abbreviateMiningAccount(value) {
    const text =
        String(value || "").trim();

    if (!text) {
        return "";
    }

    if (text.length <= 20) {
        return text;
    }

    const beginning =
        text.slice(0, 11);

    const ending =
        text.slice(-6);

    return `${beginning}...${ending}`;
}


function formatRelativeTime(timestamp) {
    const value = Number(timestamp);

    if (!Number.isFinite(value) || value <= 0) {
        return "—";
    }

    const elapsed = Math.max(
        0,
        Math.floor(
            Date.now() / 1000 - value
        )
    );

    if (elapsed < 10) {
        return "Just now";
    }

    if (elapsed < 60) {
        return `${elapsed}s ago`;
    }

    if (elapsed < 3600) {
        return `${Math.floor(elapsed / 60)}m ago`;
    }

    if (elapsed < 86400) {
        return `${Math.floor(elapsed / 3600)}h ago`;
    }

    return `${Math.floor(elapsed / 86400)}d ago`;
}


function updateMiningMetrics(
    miningResult,
    miningBlocksResult,
    nvun
) {
    const pool =
        miningResult.asicseer || {};

    const networkDifficulty =
        Number(
            nvun.difficulty
        );

    const bestDifficulty =
        Number(
            pool.bestShare
        );

    setText(
        document.getElementById(
            "mining-pool-status"
        ),
        pool.online
            ? "ONLINE"
            : "OFFLINE"
    );

    setText(
        document.getElementById(
            "mining-pool-hashrate"
        ),
        formatMiningHashrate(
            pool.hashrate?.["1m"]
        )
    );

    setText(
        document.getElementById(
            "mining-worker-count"
        ),
        formatInteger(
            pool.workers
        )
    );

    setText(
        document.getElementById(
            "mining-best-diff"
        ),
        formatMiningDifficulty(
            bestDifficulty
        )
    );

    setText(
        document.getElementById(
            "mining-network-difficulty"
        ),
        formatMiningDifficulty(
            networkDifficulty
        )
    );

    let comparison =
        "Compared with network difficulty";

    if (
        Number.isFinite(bestDifficulty) &&
        Number.isFinite(networkDifficulty) &&
        networkDifficulty > 0
    ) {
        const percentage =
            (
                bestDifficulty /
                networkDifficulty
            ) * 100;

        comparison =
            `${percentage.toFixed(1)}% of network difficulty`;
    }

    setText(
        document.getElementById(
            "mining-best-percent"
        ),
        comparison
    );

    const miningBlocks =
        Array.isArray(
            miningBlocksResult.blocks
        )
            ? miningBlocksResult.blocks
            : [];

    const latestMiningBlock =
        miningBlocks.length
            ? miningBlocks[0]
            : null;

    let latestBlockTimestamp =
        null;

    if (latestMiningBlock) {
        if (
            Number.isFinite(
                Number(
                    latestMiningBlock.blockTime
                )
            )
        ) {
            latestBlockTimestamp =
                Number(
                    latestMiningBlock.blockTime
                );

        } else if (
            latestMiningBlock.timestampIso
        ) {
            const parsed =
                Date.parse(
                    latestMiningBlock.timestampIso
                );

            if (
                Number.isFinite(parsed)
            ) {
                latestBlockTimestamp =
                    Math.floor(
                        parsed / 1000
                    );
            }
        }
    }

    setText(
        document.getElementById(
            "mining-last-block-time"
        ),
        latestMiningBlock
            ? formatRelativeTime(
                latestBlockTimestamp
            )
            : "—"
    );

    setText(
        document.getElementById(
            "mining-last-block-height"
        ),
        latestMiningBlock
            ? `Height ${formatInteger(
                latestMiningBlock.height
            )}`
            : "No retained block solves"
    );

    setText(
        document.getElementById(
            "mining-best-all-time"
        ),
        formatMiningDifficulty(
            pool.bestShareAllTime
        )
    );

    setText(
        document.getElementById(
            "mining-accepted-shares"
        ),
        formatCompactCount(
            pool.acceptedShares
        )
    );

    setText(
        document.getElementById(
            "mining-rejected-shares"
        ),
        formatCompactCount(
            pool.rejectedShares
        )
    );

    const stratumPort =
        miningResult.stratumPort ?? 3336;

    setText(
        document.getElementById(
            "mining-stratum-port"
        ),
        String(stratumPort)
    );

    setText(
        document.getElementById(
            "mining-stratum-note"
        ),
        `TCP ${stratumPort}`
    );

    const payoutAddress =
        typeof miningResult.payoutAddress === "string"
            && miningResult.payoutAddress.startsWith("nvu:")
                ? miningResult.payoutAddress
                : "Not initialized";

    setText(
        document.getElementById(
            "mining-payout-address"
        ),
        payoutAddress
    );
}


function renderMiningBlocksTable() {
    const body =
        document.getElementById(
            "mining-block-table-body"
        );

    const summary =
        document.getElementById(
            "mining-block-summary"
        );

    const pageStatus =
        document.getElementById(
            "mining-block-page-status"
        );

    const previousButton =
        document.getElementById(
            "mining-block-prev"
        );

    const nextButton =
        document.getElementById(
            "mining-block-next"
        );

    if (
        !body ||
        !summary ||
        !pageStatus ||
        !previousButton ||
        !nextButton
    ) {
        return;
    }

    const totalPages = Math.max(
        1,
        Math.ceil(
            miningBlocks.length /
            MINING_BLOCKS_PAGE_SIZE
        )
    );

    miningBlocksPage = Math.max(
        1,
        Math.min(
            miningBlocksPage,
            totalPages
        )
    );

    const start =
        (
            miningBlocksPage - 1
        ) *
        MINING_BLOCKS_PAGE_SIZE;

    const visibleBlocks =
        miningBlocks.slice(
            start,
            start +
            MINING_BLOCKS_PAGE_SIZE
        );

    body.textContent = "";

    if (!visibleBlocks.length) {
        const row =
            document.createElement("tr");

        const cell =
            document.createElement("td");

        cell.colSpan = 6;
        cell.textContent =
            "No retained block solves were found.";

        row.appendChild(cell);
        body.appendChild(row);

    } else {
        for (const block of visibleBlocks) {
            const row =
                document.createElement("tr");

            const height =
                document.createElement("td");

            height.className =
                "mining-block-height";

            height.textContent =
                formatInteger(
                    block.height
                );

            const worker =
                document.createElement("td");

            worker.className =
                "mining-block-worker";

            const workerName =
                document.createElement("div");

            workerName.textContent =
                block.worker || "—";

            worker.appendChild(
                workerName
            );

            const abbreviatedAccount =
                abbreviateMiningAccount(
                    block.account
                );

            if (abbreviatedAccount) {
                const account =
                    document.createElement("span");

                account.className =
                    "mining-block-account";

                account.textContent =
                    abbreviatedAccount;

                account.title =
                    String(block.account);

                worker.appendChild(
                    account
                );
            }

            const solveDifficulty =
                document.createElement("td");

            solveDifficulty.textContent =
                formatMiningDifficulty(
                    block.solveDifficulty
                );

            const effort =
                document.createElement("td");

            const effortValue =
                Number(
                    block.effortPercent
                );

            effort.textContent =
                Number.isFinite(
                    effortValue
                )
                    ? `${effortValue.toFixed(1)}%`
                    : "—";

            const found =
                document.createElement("td");

            let foundTimestamp =
                null;

            if (
                Number.isFinite(
                    Number(
                        block.blockTime
                    )
                )
            ) {
                foundTimestamp =
                    Number(
                        block.blockTime
                    );

            } else if (
                block.timestampIso
            ) {
                const parsed =
                    Date.parse(
                        block.timestampIso
                    );

                if (
                    Number.isFinite(parsed)
                ) {
                    foundTimestamp =
                        Math.floor(
                            parsed / 1000
                        );
                }
            }

            found.className =
                "mining-block-found";

            found.textContent =
                formatRelativeTime(
                    foundTimestamp
                );

            const status =
                document.createElement("td");

            status.className =
                "mining-block-status";

            status.textContent =
                block.status || "—";

            row.appendChild(height);
            row.appendChild(worker);

            row.appendChild(
                solveDifficulty
            );

            row.appendChild(effort);
            row.appendChild(found);
            row.appendChild(status);

            body.appendChild(row);
        }
    }

    summary.textContent =
        `${miningBlocks.length} recent ` +
        `${miningBlocks.length === 1 ? "solve" : "solves"} retained`;

    pageStatus.textContent =
        `Page ${miningBlocksPage} of ${totalPages}`;

    previousButton.disabled =
        miningBlocksPage <= 1;

    nextButton.disabled =
        miningBlocksPage >= totalPages;
}


function setMiningBlocks(newBlocks) {
    miningBlocks =
        Array.isArray(newBlocks)
            ? newBlocks.slice()
            : [];

    const totalPages = Math.max(
        1,
        Math.ceil(
            miningBlocks.length /
            MINING_BLOCKS_PAGE_SIZE
        )
    );

    /*
     * Preserve the selected page during every
     * 10-second dashboard refresh.
     */
    miningBlocksPage = Math.max(
        1,
        Math.min(
            miningBlocksPage,
            totalPages
        )
    );

    renderMiningBlocksTable();
}


function initializeMiningBlocksTable() {
    const toggle =
        document.getElementById(
            "mining-block-toggle"
        );

    const content =
        document.getElementById(
            "mining-block-content"
        );

    const toggleLabel =
        document.getElementById(
            "mining-block-toggle-label"
        );

    const previousButton =
        document.getElementById(
            "mining-block-prev"
        );

    const nextButton =
        document.getElementById(
            "mining-block-next"
        );

    if (
        toggle &&
        content &&
        toggleLabel
    ) {
        toggle.addEventListener(
            "click",
            () => {
                const expanded =
                    toggle.getAttribute(
                        "aria-expanded"
                    ) === "true";

                const nextExpanded =
                    !expanded;

                toggle.setAttribute(
                    "aria-expanded",
                    String(nextExpanded)
                );

                content.hidden =
                    !nextExpanded;

                toggleLabel.textContent =
                    nextExpanded
                        ? "Hide Blocks"
                        : "View Blocks";
            }
        );
    }

    if (previousButton) {
        previousButton.addEventListener(
            "click",
            () => {
                if (miningBlocksPage > 1) {
                    miningBlocksPage -= 1;
                    renderMiningBlocksTable();
                }
            }
        );
    }

    if (nextButton) {
        nextButton.addEventListener(
            "click",
            () => {
                const totalPages =
                    Math.max(
                        1,
                        Math.ceil(
                            miningBlocks.length /
                            MINING_BLOCKS_PAGE_SIZE
                        )
                    );

                if (
                    miningBlocksPage <
                    totalPages
                ) {
                    miningBlocksPage += 1;
                    renderMiningBlocksTable();
                }
            }
        );
    }

    renderMiningBlocksTable();
}


function findWorkerLastBlock(
    worker,
    blocks
) {
    if (!worker || !Array.isArray(blocks)) {
        return null;
    }

    return (
        blocks.find(
            block =>
                String(block.worker || "") ===
                    String(worker.worker || "")
                &&
                String(block.account || "") ===
                    String(worker.account || "")
        )
        || null
    );
}


function renderConnectedMiners(
    workersResult,
    miningBlocksResult,
    miningResult
) {
    const summary =
        document.getElementById(
            "miners-summary"
        );

    const body =
        document.getElementById(
            "miners-table-body"
        );

    if (!summary || !body) {
        return;
    }

    const workers =
        Array.isArray(
            workersResult.workers
        )
            ? workersResult.workers
            : [];

    const activeWorkers =
        workers.filter(
            worker =>
                Boolean(worker.active)
        );

    const blocks =
        Array.isArray(
            miningBlocksResult.blocks
        )
            ? miningBlocksResult.blocks
            : [];

    const pool =
        miningResult.asicseer || {};

    const poolHashrate =
        formatMiningHashrate(
            pool.hashrate?.["1m"]
        );

    const activeCount =
        Number.isFinite(
            Number(
                workersResult.activeCount
            )
        )
            ? Number(
                workersResult.activeCount
            )
            : activeWorkers.length;

    summary.textContent =
        `${activeCount} active` +
        (
            poolHashrate !== "—"
                ? ` · ${poolHashrate}`
                : ""
        );

    body.textContent = "";

    if (!activeWorkers.length) {
        const row =
            document.createElement("tr");

        const cell =
            document.createElement("td");

        cell.colSpan = 5;
        cell.textContent =
            "No active miners were found.";

        row.appendChild(cell);
        body.appendChild(row);

        return;
    }

    for (const workerData of activeWorkers) {
        const row =
            document.createElement("tr");

        const workerCell =
            document.createElement("td");

        const workerName =
            document.createElement("div");

        workerName.className =
            "miner-worker-name";

        workerName.textContent =
            workerData.worker || "—";

        workerCell.appendChild(
            workerName
        );

        const abbreviatedAccount =
            abbreviateMiningAccount(
                workerData.account
            );

        if (abbreviatedAccount) {
            const account =
                document.createElement("span");

            account.className =
                "miner-account";

            account.textContent =
                abbreviatedAccount;

            account.title =
                String(workerData.account);

            workerCell.appendChild(
                account
            );
        }

        const hashrate =
            document.createElement("td");

        hashrate.className =
            "miner-hashrate";

        hashrate.textContent =
            formatMiningHashrate(
                workerData.hashrate?.["1m"]
            );

        const lastShare =
            document.createElement("td");

        lastShare.className =
            "miner-time";

        lastShare.textContent =
            formatRelativeTime(
                workerData.lastShare
            );

        const lastBlock =
            document.createElement("td");

        lastBlock.className =
            "miner-time";

        const matchingBlock =
            findWorkerLastBlock(
                workerData,
                blocks
            );

        let blockTimestamp =
            null;

        if (matchingBlock) {
            if (
                Number.isFinite(
                    Number(
                        matchingBlock.blockTime
                    )
                )
            ) {
                blockTimestamp =
                    Number(
                        matchingBlock.blockTime
                    );

            } else if (
                matchingBlock.blockTimeIso
            ) {
                const parsed =
                    Date.parse(
                        matchingBlock.blockTimeIso
                    );

                if (
                    Number.isFinite(parsed)
                ) {
                    blockTimestamp =
                        Math.floor(
                            parsed / 1000
                        );
                }
            }
        }

        lastBlock.textContent =
            matchingBlock
                ? formatRelativeTime(
                    blockTimestamp
                )
                : "—";

        if (matchingBlock) {
            lastBlock.title =
                `Height ${formatInteger(
                    matchingBlock.height
                )}`;
        }

        const bestDifficulty =
            document.createElement("td");

        bestDifficulty.className =
            "miner-best-diff";

        bestDifficulty.textContent =
            formatMiningDifficulty(
                workerData.bestShare
            );

        row.appendChild(workerCell);
        row.appendChild(hashrate);
        row.appendChild(lastShare);
        row.appendChild(lastBlock);
        row.appendChild(bestDifficulty);

        body.appendChild(row);
    }
}


function initializeNodeDetailsPanel() {
    const toggle =
        document.getElementById(
            "node-details-toggle"
        );

    const content =
        document.getElementById(
            "node-details-content"
        );

    const label =
        document.getElementById(
            "node-details-toggle-label"
        );

    if (!toggle || !content || !label) {
        return;
    }

    toggle.addEventListener(
        "click",
        () => {
            const expanded =
                toggle.getAttribute(
                    "aria-expanded"
                ) === "true";

            const nextExpanded =
                !expanded;

            toggle.setAttribute(
                "aria-expanded",
                String(nextExpanded)
            );

            content.hidden =
                !nextExpanded;

            label.textContent =
                nextExpanded
                    ? "Hide Details"
                    : "View Details";
        }
    );
}


function initializeLatestBlocksPanel() {
    const toggle =
        document.getElementById(
            "latest-blocks-toggle"
        );

    const content =
        document.getElementById(
            "latest-blocks-content"
        );

    const label =
        document.getElementById(
            "latest-blocks-toggle-label"
        );

    const previous =
        document.getElementById(
            "latest-blocks-prev"
        );

    const next =
        document.getElementById(
            "latest-blocks-next"
        );

    if (
        !toggle ||
        !content ||
        !label ||
        !previous ||
        !next
    ) {
        return;
    }

    toggle.addEventListener(
        "click",
        () => {
            const expanded =
                toggle.getAttribute(
                    "aria-expanded"
                ) === "true";

            const nextExpanded =
                !expanded;

            toggle.setAttribute(
                "aria-expanded",
                String(nextExpanded)
            );

            content.hidden =
                !nextExpanded;

            label.textContent =
                nextExpanded
                    ? "Hide Blocks"
                    : "View Blocks";
        }
    );

    previous.addEventListener(
        "click",
        () => {
            if (latestBlocksPage <= 1) {
                return;
            }

            latestBlocksPage -= 1;

            renderLatestBlocks();
        }
    );

    next.addEventListener(
        "click",
        () => {
            const totalPages =
                Math.max(
                    1,
                    Math.ceil(
                        latestBlocks.length /
                        LATEST_BLOCKS_PAGE_SIZE
                    )
                );

            if (
                latestBlocksPage >=
                totalPages
            ) {
                return;
            }

            latestBlocksPage += 1;

            renderLatestBlocks();
        }
    );

    renderLatestBlocks();
}


function initializeConnectedMinersPanel() {
    const toggle =
        document.getElementById(
            "miners-toggle"
        );

    const content =
        document.getElementById(
            "miners-content"
        );

    const label =
        document.getElementById(
            "miners-toggle-label"
        );

    if (!toggle || !content || !label) {
        return;
    }

    toggle.addEventListener(
        "click",
        () => {
            const expanded =
                toggle.getAttribute(
                    "aria-expanded"
                ) === "true";

            const nextExpanded =
                !expanded;

            toggle.setAttribute(
                "aria-expanded",
                String(nextExpanded)
            );

            content.hidden =
                !nextExpanded;

            label.textContent =
                nextExpanded
                    ? "Hide Miners"
                    : "View Miners";
        }
    );
}


function formatNVUAmount(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return (
        number.toLocaleString(
            "en-US",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 8
            }
        )
        + " NVU"
    );
}


function renderWalletTransactions() {
    const transactionBody =
        document.getElementById(
            "wallet-transaction-body"
        );

    const pageStatus =
        document.getElementById(
            "wallet-transaction-page-status"
        );

    const previousButton =
        document.getElementById(
            "wallet-transaction-prev"
        );

    const nextButton =
        document.getElementById(
            "wallet-transaction-next"
        );

    const footer =
        document.getElementById(
            "wallet-transaction-footer"
        );

    if (!transactionBody) {
        return;
    }

    const totalTransactions =
        walletTransactions.length;

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                totalTransactions /
                WALLET_TRANSACTIONS_PAGE_SIZE
            )
        );

    walletTransactionsPage =
        Math.max(
            1,
            Math.min(
                walletTransactionsPage,
                totalPages
            )
        );

    const start =
        (
            walletTransactionsPage - 1
        ) * WALLET_TRANSACTIONS_PAGE_SIZE;

    const visibleTransactions =
        walletTransactions.slice(
            start,
            start +
            WALLET_TRANSACTIONS_PAGE_SIZE
        );

    transactionBody.textContent = "";

    if (!visibleTransactions.length) {
        const row =
            document.createElement("tr");

        const cell =
            document.createElement("td");

        cell.colSpan = 4;
        cell.textContent =
            "No wallet transactions yet.";

        row.appendChild(cell);
        transactionBody.appendChild(row);

    } else {
        for (
            const transaction
            of visibleTransactions
        ) {
            const row =
                document.createElement("tr");

            const type =
                document.createElement("td");

            type.textContent =
                transaction.category
                || transaction.label
                || "Transaction";

            const amount =
                document.createElement("td");

            const amountNumber =
                Number(transaction.amount);

            amount.textContent =
                formatNVUAmount(
                    transaction.amount
                );

            if (
                Number.isFinite(amountNumber)
                && amountNumber > 0
            ) {
                amount.className =
                    "wallet-amount-positive";

            } else if (
                Number.isFinite(amountNumber)
                && amountNumber < 0
            ) {
                amount.className =
                    "wallet-amount-negative";
            }

            const confirmations =
                document.createElement("td");

            confirmations.textContent =
                formatInteger(
                    transaction.confirmations
                );

            const when =
                document.createElement("td");

            when.textContent =
                formatRelativeTime(
                    transaction.time
                    || transaction.timereceived
                );

            row.appendChild(type);
            row.appendChild(amount);
            row.appendChild(confirmations);
            row.appendChild(when);

            transactionBody.appendChild(row);
        }
    }

    if (pageStatus) {
        if (totalTransactions === 0) {
            pageStatus.textContent =
                "Showing 0 transactions";

        } else {
            const firstVisible =
                start + 1;

            const lastVisible =
                Math.min(
                    start +
                    WALLET_TRANSACTIONS_PAGE_SIZE,
                    totalTransactions
                );

            pageStatus.textContent =
                (
                    `Showing ${firstVisible}–` +
                    `${lastVisible} of ` +
                    `${totalTransactions} transactions`
                );
        }
    }

    if (previousButton) {
        previousButton.disabled =
            walletTransactionsPage <= 1;
    }

    if (nextButton) {
        nextButton.disabled =
            walletTransactionsPage >=
            totalPages;
    }

    if (footer) {
        footer.hidden =
            totalPages <= 1;
    }
}


function initializeWalletTransactions() {
    const toggle =
        document.getElementById(
            "wallet-transaction-toggle"
        );

    const content =
        document.getElementById(
            "wallet-transaction-content"
        );

    const toggleLabel =
        document.getElementById(
            "wallet-transaction-toggle-label"
        );

    const previousButton =
        document.getElementById(
            "wallet-transaction-prev"
        );

    const nextButton =
        document.getElementById(
            "wallet-transaction-next"
        );

    if (
        !toggle ||
        !content ||
        !toggleLabel ||
        !previousButton ||
        !nextButton
    ) {
        return;
    }

    toggle.addEventListener(
        "click",
        () => {
            const expanded =
                toggle.getAttribute(
                    "aria-expanded"
                ) === "true";

            const nextExpanded =
                !expanded;

            toggle.setAttribute(
                "aria-expanded",
                String(nextExpanded)
            );

            content.hidden =
                !nextExpanded;

            toggleLabel.textContent =
                nextExpanded
                    ? "Hide Transactions"
                    : "View Transactions";
        }
    );

    previousButton.addEventListener(
        "click",
        () => {
            if (walletTransactionsPage <= 1) {
                return;
            }

            walletTransactionsPage -= 1;
            renderWalletTransactions();
        }
    );

    nextButton.addEventListener(
        "click",
        () => {
            const totalPages =
                Math.max(
                    1,
                    Math.ceil(
                        walletTransactions.length /
                        WALLET_TRANSACTIONS_PAGE_SIZE
                    )
                );

            if (
                walletTransactionsPage >=
                totalPages
            ) {
                return;
            }

            walletTransactionsPage += 1;
            renderWalletTransactions();
        }
    );
}


function updateWalletDashboard(
    statusResult,
    transactionsResult,
    addressesResult
) {
    setText(
        document.getElementById(
            "wallet-display-name"
        ),
        statusResult.displayName
            || "Default Wallet"
    );

    setText(
        document.getElementById(
            "wallet-confirmed-balance"
        ),
        formatNVUAmount(
            statusResult.balance
        )
    );

    setText(
        document.getElementById(
            "wallet-unconfirmed-balance"
        ),
        formatNVUAmount(
            statusResult.unconfirmedBalance
        )
    );

    setText(
        document.getElementById(
            "wallet-immature-balance"
        ),
        formatNVUAmount(
            statusResult.immatureBalance
        )
    );

    setText(
        document.getElementById(
            "wallet-transaction-count"
        ),
        formatInteger(
            statusResult.transactionCount
        )
    );

    setText(
        document.getElementById(
            "wallet-status"
        ),
        statusResult.loaded
            ? "READY"
            : "UNAVAILABLE"
    );

    setText(
        document.getElementById(
            "wallet-private-keys"
        ),
        statusResult.privateKeysEnabled
            ? "ENABLED"
            : "DISABLED"
    );

    const addresses =
        Array.isArray(
            addressesResult.addresses
        )
            ? addressesResult.addresses
            : [];

    const addressEmpty =
        document.getElementById(
            "wallet-address-empty"
        );

    const addressList =
        document.getElementById(
            "wallet-address-list"
        );

    if (addressEmpty && addressList) {
        addressList.textContent = "";

        if (!addresses.length) {
            addressEmpty.hidden = false;
            addressList.hidden = true;

        } else {
            addressEmpty.hidden = true;
            addressList.hidden = false;

            for (
                const addressRecord
                of addresses.slice(0, 10)
            ) {
                const item =
                    document.createElement("div");

                item.className =
                    "wallet-address-item";

                const value =
                    document.createElement("div");

                value.className =
                    "wallet-address-value";

                value.textContent =
                    addressRecord.address || "—";

                const meta =
                    document.createElement("div");

                meta.className =
                    "wallet-address-meta";

                const amount =
                    formatNVUAmount(
                        addressRecord.amount
                    );

                const confirmations =
                    formatInteger(
                        addressRecord.confirmations
                    );

                meta.textContent =
                    `${amount} received`
                    + (
                        confirmations !== "—"
                            ? ` · ${confirmations} confirmations`
                            : ""
                    );

                item.appendChild(value);
                item.appendChild(meta);
                addressList.appendChild(item);
            }
        }
    }

    const transactions =
        Array.isArray(
            transactionsResult.transactions
        )
            ? transactionsResult.transactions
            : [];

    walletTransactions =
        transactions.slice(
            0,
            WALLET_TRANSACTIONS_LIMIT
        );

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                walletTransactions.length /
                WALLET_TRANSACTIONS_PAGE_SIZE
            )
        );

    /*
     * Preserve the selected page during each
     * 10-second Dashboard refresh.
     */
    walletTransactionsPage =
        Math.max(
            1,
            Math.min(
                walletTransactionsPage,
                totalPages
            )
        );

    setText(
        document.getElementById(
            "wallet-recent-count"
        ),
        String(walletTransactions.length)
    );

    renderWalletTransactions();
}


async function fetchJson(url) {
    const response =
        await fetch(
            `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`,
            {
                cache: "no-store",
                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );

    if (!response.ok) {
        throw new Error(
            `${url} returned ${response.status}`
        );
    }

    const data =
        await response.json();

    if (data.ok === false) {
        throw new Error(
            data.error ||
            `${url} returned an error`
        );
    }

    return data;
}


async function refreshDashboard() {
    try {
        const [
            statusResult,
            peersResult,
            blocksResult,
            miningResult,
            miningBlocksResult,
            miningWorkersResult,
            walletStatusResult,
            walletTransactionsResult,
            walletAddressesResult
        ] = await Promise.all([
            fetchJson(
                STATUS_API
            ),

            fetchJson(
                PEERS_API
            ),

            fetchJson(
                BLOCKS_API
            ),

            fetchJson(
                MINING_API
            ),

            fetchJson(
                MINING_BLOCKS_API
            ),

            fetchJson(
                MINING_WORKERS_API
            ),

            fetchJson(
                WALLET_STATUS_API
            ),

            fetchJson(
                WALLET_TRANSACTIONS_API
            ),

            fetchJson(
                WALLET_ADDRESSES_API
            )
        ]);

        const nvun =
            statusResult.nvun || {};

        const peerList =
            Array.isArray(
                peersResult.peers
            )
                ? peersResult.peers
                : [];

        const latestBlocks =
            Array.isArray(
                blocksResult.blocks
            )
                ? blocksResult.blocks
                : [];

        const normalizedPeers =
            peerList.map(
                peer => ({
                    address:
                        peer.addr,

                    inbound:
                        Boolean(
                            peer.inbound
                        ),

                    version:
                        String(
                            peer.subver || ""
                        )
                            .replace(
                                /^\/NVUN:/,
                                ""
                            )
                            .replace(
                                /\/$/,
                                ""
                            ),

                    subversion:
                        peer.subver,

                    protocol_version:
                        peer.version,

                    height:
                        peer.syncedBlocks,

                    synced_headers:
                        peer.syncedHeaders,

                    bytes_received:
                        peer.bytesReceived,

                    bytes_sent:
                        peer.bytesSent,

                    connection_type:
                        peer.inbound
                            ? "inbound"
                            : "outbound",

                    addnode:
                        false
                })
            );

        const normalizedBlocks =
            latestBlocks.map(
                block => ({
                    height:
                        block.height,

                    hash:
                        block.hash,

                    time:
                        block.time,

                    time_iso:
                        block.timeIso,

                    tx_count:
                        block.txCount,

                    confirmations:
                        block.confirmations,

                    difficulty:
                        block.difficulty
                })
            );

        const inbound =
            normalizedPeers.filter(
                peer => peer.inbound
            ).length;

        const outbound =
            normalizedPeers.length -
            inbound;

        const data = {
            ok: true,

            generated_at:
                Math.floor(
                    Date.now() / 1000
                ),

            node: {
                name:
                    NODE_NAME,

                hostname:
                    NODE_HOSTNAME,

                p2p_endpoint:
                    `${NODE_HOSTNAME}:${P2P_PORT}`,

                rpc_scope:
                    "Container network",

                version:
                    String(
                        nvun.version || ""
                    )
                        .replace(
                            /^\/NVUN:/,
                            ""
                        )
                        .replace(
                            /\/$/,
                            ""
                        ),

                subversion:
                    nvun.version,

                protocol_version:
                    nvun.protocolVersion,

                uptime_seconds:
                    nvun.uptimeSeconds
            },

            blockchain: {
                chain:
                    nvun.chain,

                blocks:
                    nvun.height,

                headers:
                    nvun.headers,

                best_block_hash:
                    nvun.bestBlockHash,

                difficulty:
                    nvun.difficulty,

                median_time:
                    null,

                verification_progress:
                    nvun.verificationProgress,

                initial_block_download:
                    nvun.initialBlockDownload,

                chainwork:
                    nvun.chainwork,

                size_on_disk:
                    nvun.sizeOnDisk,

                pruned:
                    false,

                warnings:
                    ""
            },

            network: {
                active:
                    Boolean(
                        nvun.online
                    ),

                connections:
                    nvun.connections,

                connections_in:
                    nvun.inboundPeers,

                connections_out:
                    nvun.outboundPeers,

                hashrate:
                    nvun.networkHashrate,

                local_addresses:
                    []
            },

            known_nodes: buildKnownNodes(
                normalizedPeers,
                nvun
            ),

            peers:
                normalizedPeers,

            latest_blocks:
                normalizedBlocks
        };

        updateDashboard(
            data
        );

        updateMiningMetrics(
            miningResult,
            miningBlocksResult,
            nvun
        );

        setMiningBlocks(
            miningBlocksResult.blocks
        );

        renderConnectedMiners(
            miningWorkersResult,
            miningBlocksResult,
            miningResult
        );

        updateWalletDashboard(
            walletStatusResult,
            walletTransactionsResult,
            walletAddressesResult
        );

    } catch (error) {

        console.error(
            "NVU Umbrel dashboard refresh failed:",
            error
        );

        setOverallState(
            false
        );

    } finally {

        window.clearTimeout(
            refreshTimer
        );

        refreshTimer =
            window.setTimeout(
                refreshDashboard,
                REFRESH_INTERVAL
            );
    }
}

    /* =====================================================
       STARTUP
       ===================================================== */

    document.addEventListener(
    "DOMContentLoaded",
    () => {
        initializeMiningBlocksTable();
        initializeNodeDetailsPanel();
        initializeLatestBlocksPanel();
        initializeConnectedMinersPanel();
        initializeWalletTransactions();
        refreshDashboard();
    }
);


    document.addEventListener(
        "visibilitychange",
        () => {
            if (!document.hidden) {
                refreshDashboard();
            }
        }
    );

})();
