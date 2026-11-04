"use strict";


/* ---------------------------------------------------------
   CONFIGURATION AND STATE
--------------------------------------------------------- */

const CONFIG = {
  refreshMilliseconds: 15000,
  overviewBlockLimit: 8,
  explorerBlockLimit: 20,
};

const state = {
  activeView: "overview",
  refreshTimer: null,
  refreshing: false,
  status: null,
  blocks: [],
  peers: [],
};


/* ---------------------------------------------------------
   DOM HELPERS
--------------------------------------------------------- */

function element(id) {
  return document.getElementById(id);
}

function setText(id, value, fallback = "--") {
  const target = element(id);

  if (!target) {
    return;
  }

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    target.textContent = fallback;
    return;
  }

  target.textContent = String(value);
}

function setClass(id, className, enabled) {
  const target = element(id);

  if (!target) {
    return;
  }

  target.classList.toggle(className, Boolean(enabled));
}

function clearStatusClasses(target) {
  if (!target) {
    return;
  }

  target.classList.remove(
    "online",
    "offline",
    "warning",
    "online-text",
    "offline-text",
    "warning-text"
  );
}

function setStatusText(id, online, texts = {}) {
  const target = element(id);

  if (!target) {
    return;
  }

  clearStatusClasses(target);

  target.textContent = online
    ? texts.online || "Online"
    : texts.offline || "Offline";

  target.classList.add(
    online ? "online-text" : "offline-text"
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* ---------------------------------------------------------
   DATA FORMATTING
--------------------------------------------------------- */

function formatInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(number);
}

function formatCompactNumber(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "--";
  }

  const absolute = Math.abs(number);

  const units = [
    { value: 1e12, suffix: "T" },
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" },
  ];

  for (const unit of units) {
    if (absolute >= unit.value) {
      return `${(number / unit.value).toFixed(digits)}${unit.suffix}`;
    }
  }

  if (Number.isInteger(number)) {
    return new Intl.NumberFormat("en-US").format(number);
  }

  return number.toFixed(digits);
}


function formatCompactDifficulty(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "--";
  }

  const absolute = Math.abs(number);

  const units = [
    { value: 1e12, suffix: "T" },
    { value: 1e9, suffix: "G" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" },
  ];

  for (const unit of units) {
    if (absolute >= unit.value) {
      return `${(number / unit.value).toFixed(digits)}${unit.suffix}`;
    }
  }

  if (Number.isInteger(number)) {
    return new Intl.NumberFormat("en-US").format(number);
  }

  return number.toFixed(digits);
}


function formatHashrateValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "--";
  }

  if (typeof value === "string") {
    const match = value.trim().match(
      /^([0-9]+(?:[.][0-9]+)?)([KMGTPE]?)$/
    );

    if (match) {
      const suffixes = {
        "": "H/s",
        K: "KH/s",
        M: "MH/s",
        G: "GH/s",
        T: "TH/s",
        P: "PH/s",
        E: "EH/s",
      };

      return `${match[1]} ${suffixes[match[2]]}`;
    }
  }

  let rate = Number(value);

  if (!Number.isFinite(rate)) {
    return "--";
  }

  const units = [
    "H/s",
    "KH/s",
    "MH/s",
    "GH/s",
    "TH/s",
    "PH/s",
    "EH/s",
  ];

  let index = 0;

  while (
    Math.abs(rate) >= 1000 &&
    index < units.length - 1
  ) {
    rate /= 1000;
    index += 1;
  }

  return `${rate.toFixed(2)} ${units[index]}`;
}


function formatNVU(value, digits = 8) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "--";
  }

  const formatted = number
    .toFixed(digits)
    .replace(/([.]0+|0+)$/, "")
    .replace(/[.]$/, "");

  return `${formatted} NVU`;
}


function formatDecimal(value, maximumDigits = 8) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maximumDigits,
  }).format(number);
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "--";
  }

  return `${(number * 100).toFixed(2)}%`;
}

function formatBytes(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return "--";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  let result = number;
  let unitIndex = 0;

  while (
    result >= 1024 &&
    unitIndex < units.length - 1
  ) {
    result /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : 1;

  return `${result.toFixed(digits)} ${units[unitIndex]}`;
}

function formatDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "--";
  }

  let date;

  if (typeof value === "number") {
    date = new Date(value * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function formatAge(value) {
  let date;

  if (typeof value === "number") {
    date = new Date(value * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  const seconds = Math.max(
    0,
    Math.floor(
      (Date.now() - date.getTime()) / 1000
    )
  );

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
}

function formatRuntime(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}


function formatDurationFromTimestamp(timestamp) {
  const number = Number(timestamp);

  if (!Number.isFinite(number)) {
    return "--";
  }

  const elapsed = Math.max(
    0,
    Math.floor(Date.now() / 1000) - number
  );

  const days = Math.floor(elapsed / 86400);
  const hours = Math.floor(
    (elapsed % 86400) / 3600
  );
  const minutes = Math.floor(
    (elapsed % 3600) / 60
  );

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function shortenHash(value, start = 12, end = 10) {
  const text = String(value ?? "");

  if (text.length <= start + end + 3) {
    return text || "--";
  }

  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function formatBooleanStatus(value) {
  return value ? "Ready" : "Not ready";
}


/* ---------------------------------------------------------
   API
--------------------------------------------------------- */

async function api(path) {
  const response = await fetch(path, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Invalid response from ${path}`
    );
  }

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.error ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
}


/* ---------------------------------------------------------
   NAVIGATION
--------------------------------------------------------- */

function showView(viewName) {
  state.activeView = viewName;

  document.querySelectorAll(".view").forEach(
    (view) => {
      view.classList.toggle(
        "active",
        view.id === `view-${viewName}`
      );
    }
  );

  document.querySelectorAll(".nav-button").forEach(
    (button) => {
      button.classList.toggle(
        "active",
        button.dataset.view === viewName
      );
    }
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });

  if (viewName === "network") {
    loadPeers();
  }

  if (viewName === "explorer") {
    loadLatestBlocks(
      CONFIG.explorerBlockLimit
    );
  }
}

function initializeNavigation() {
  document.querySelectorAll(".nav-button").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => showView(button.dataset.view)
      );
    }
  );

  document.querySelectorAll("[data-go-view]").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => showView(button.dataset.goView)
      );
    }
  );
}


/* ---------------------------------------------------------
   HEADER AND OVERVIEW
--------------------------------------------------------- */

function renderHeader(nvun, asicseer) {
  const nodeOnline = Boolean(nvun?.online);
  const poolOnline = Boolean(asicseer?.online);

  const dot = element("network-dot");

  if (dot) {
    clearStatusClasses(dot);
    dot.classList.add(
      nodeOnline ? "online" : "offline"
    );
  }

  setText(
    "network-status",
    nodeOnline ? "Online" : "Offline"
  );

  setText(
    "header-height",
    formatInteger(nvun?.height)
  );

  setText(
    "header-peers",
    formatInteger(nvun?.peerCount)
  );

  setText(
    "header-mining",
    poolOnline ? "SOLO" : "Offline"
  );
}

function renderOverview(nvun, asicseer) {
  setStatusText(
    "overview-node-status",
    Boolean(nvun?.online)
  );

  setText(
    "overview-version",
    nvun?.version || "NVUN"
  );

  setText(
    "overview-height",
    formatInteger(nvun?.height)
  );

  setText(
    "overview-peers",
    formatInteger(nvun?.peerCount)
  );

  setText(
    "overview-peer-detail",
    `${formatInteger(nvun?.inboundPeers)} inbound / ` +
    `${formatInteger(nvun?.outboundPeers)} outbound`
  );

  setStatusText(
    "overview-pool-status",
    Boolean(asicseer?.online)
  );

  setText(
    "overview-solo-status",
    asicseer?.soloMode
      ? "Solo mode active"
      : "Solo mode unavailable"
  );

  setText(
    "overview-best-block",
    nvun?.bestBlockHash
  );

  setText(
    "overview-difficulty",
    formatCompactDifficulty(nvun?.difficulty)
  );

  setText(
    "overview-network-hashrate",
    formatHashrateValue(
      nvun?.networkHashrate
    )
  );

  setText(
    "overview-difficulty-card",
    formatCompactDifficulty(
      nvun?.difficulty
    )
  );

  setText(
    "overview-network-hashrate-card",
    formatHashrateValue(
      nvun?.networkHashrate
    )
  );

  setText(
    "overview-verification",
    formatPercent(
      nvun?.verificationProgress
    )
  );

  setText(
    "overview-chainwork",
    nvun?.chainwork
  );

  renderPoolStatus(asicseer);
  renderNetworkMetrics(nvun);
  renderMiningMetrics(asicseer);
}

function renderPoolStatus(pool) {
  const online = Boolean(pool?.online);

  const pill = element("pool-status-pill");

  if (pill) {
    clearStatusClasses(pill);
    pill.classList.add(
      online ? "online" : "offline"
    );
    pill.textContent = online
      ? "Online"
      : "Offline";
  }

  setText(
    "pool-rpc-status",
    pool?.rpcConnected
      ? "Connected"
      : "Disconnected"
  );

  setText(
    "pool-generator-status",
    formatBooleanStatus(
      pool?.generatorReady
    )
  );

  setText(
    "pool-stratifier-status",
    formatBooleanStatus(
      pool?.stratifierReady
    )
  );

  setText(
    "pool-workers",
    formatInteger(pool?.workers)
  );

  setText(
    "pool-stratum",
    `Port ${pool?.stratumPort || 3336}`
  );
}

function renderNetworkMetrics(nvun) {
  setText(
    "network-peer-count",
    formatInteger(nvun?.peerCount)
  );

  setText(
    "network-inbound",
    formatInteger(nvun?.inboundPeers)
  );

  setText(
    "network-outbound",
    formatInteger(nvun?.outboundPeers)
  );
}

function renderMiningMetrics(pool) {
  setStatusText(
    "mining-pool-status",
    Boolean(pool?.online)
  );

  setText(
    "mining-users",
    formatInteger(pool?.users)
  );

  setText(
    "mining-workers",
    formatInteger(pool?.workers)
  );

  setText(
    "mining-hashrate-1m",
    formatHashrateValue(
      pool?.hashrate?.["1m"] ?? "0"
    )
  );

  setText(
    "mining-hashrate-5m",
    formatHashrateValue(
      pool?.hashrate?.["5m"] ?? "0"
    )
  );

  setText(
    "mining-hashrate-1h",
    formatHashrateValue(
      pool?.hashrate?.["1h"] ?? "0"
    )
  );

  setText(
    "mining-hashrate-6h",
    formatHashrateValue(
      pool?.hashrate?.["6h"] ?? "0"
    )
  );

  setText(
    "mining-active-workers",
    formatInteger(pool?.workers)
  );

  setText(
    "mining-configured-workers",
    `${formatInteger(pool?.configuredWorkers)} configured`
  );

  setText(
    "mining-pool-difficulty",
    formatCompactDifficulty(
      pool?.poolDifficulty
    )
  );

  setText(
    "mining-accepted",
    formatCompactNumber(
      pool?.acceptedShares
    )
  );

  setText(
    "mining-rejected",
    formatCompactNumber(
      pool?.rejectedShares
    )
  );

  setText(
    "mining-best-share",
    formatCompactDifficulty(
      pool?.bestShare
    )
  );

  setText(
    "mining-best-alltime",
    formatCompactDifficulty(
      pool?.bestShareAllTime
    )
  );

  setText(
    "mining-runtime",
    formatRuntime(
      pool?.runtimeSeconds
    )
  );

  setText(
    "mining-reward",
    formatNVU(
      pool?.reward
    )
  );

  setText(
    "mining-rpc-endpoint",
    pool?.rpcEndpoint || "nvun:9332"
  );

  setText(
    "mining-connector",
    formatBooleanStatus(
      pool?.connectorReady
    )
  );

  setText(
    "mining-generator",
    formatBooleanStatus(
      pool?.generatorReady
    )
  );

  setText(
    "mining-stratifier",
    formatBooleanStatus(
      pool?.stratifierReady
    )
  );

  const log = element("mining-log");

  if (!log) {
    return;
  }

  const lines = Array.isArray(
    pool?.recentActivity
  )
    ? pool.recentActivity
    : [];

  log.textContent = lines.length
    ? lines.join("\n")
    : "No recent ASICseer activity is available.";
}


/* ---------------------------------------------------------
   STATUS LOAD
--------------------------------------------------------- */

async function loadStatus() {
  try {
    const data = await api("/api/status");

    state.status = data;

    renderHeader(
      data.nvun,
      data.asicseer
    );

    renderOverview(
      data.nvun,
      data.asicseer
    );

    setText(
      "last-updated",
      `Updated ${new Date().toLocaleTimeString()}`
    );

    return data;
  } catch (error) {
    renderOfflineState(error);
    throw error;
  }
}

function renderOfflineState(error) {
  const dot = element("network-dot");

  if (dot) {
    clearStatusClasses(dot);
    dot.classList.add("offline");
  }

  setText("network-status", "Offline");
  setText("overview-node-status", "Offline");
  setText("overview-pool-status", "Unknown");
  setText("mining-pool-status", "Unknown");

  setText(
    "last-updated",
    `Connection error: ${error.message}`
  );
}


/* ---------------------------------------------------------
   BLOCKS
--------------------------------------------------------- */

async function loadLatestBlocks(limit) {
  try {
    const data = await api(
      `/api/blocks/latest?limit=${encodeURIComponent(limit)}`
    );

    state.blocks = Array.isArray(data.blocks)
      ? data.blocks
      : [];

    renderOverviewBlocks(
      state.blocks.slice(
        0,
        CONFIG.overviewBlockLimit
      )
    );

    renderExplorerBlocks(state.blocks);

    return data;
  } catch (error) {
    renderBlockTableError(
      "overview-blocks",
      error.message,
      5
    );

    renderBlockTableError(
      "explorer-blocks",
      error.message,
      5
    );

    throw error;
  }
}

function renderOverviewBlocks(blocks) {
  const target = element("overview-blocks");

  if (!target) {
    return;
  }

  if (!blocks.length) {
    target.innerHTML = `
      <tr>
        <td colspan="5">No blocks found.</td>
      </tr>
    `;
    return;
  }

  target.innerHTML = blocks.map(
    (block) => `
      <tr>
        <td>
          <button
            class="text-button block-link"
            type="button"
            data-block="${escapeHtml(block.height)}"
          >
            ${escapeHtml(formatInteger(block.height))}
          </button>
        </td>

        <td>
          <span
            class="hash-short"
            title="${escapeHtml(block.hash)}"
          >
            ${escapeHtml(shortenHash(block.hash))}
          </span>
        </td>

        <td title="${escapeHtml(formatDate(block.time))}">
          ${escapeHtml(formatAge(block.time))}
        </td>

        <td>
          ${escapeHtml(formatInteger(block.txCount))}
        </td>

        <td>
          ${escapeHtml(formatDecimal(block.difficulty, 6))}
        </td>
      </tr>
    `
  ).join("");

  bindBlockLinks(target);
}

function renderExplorerBlocks(blocks) {
  const target = element("explorer-blocks");

  if (!target) {
    return;
  }

  if (!blocks.length) {
    target.innerHTML = `
      <tr>
        <td colspan="5">No blocks found.</td>
      </tr>
    `;
    return;
  }

  target.innerHTML = blocks.map(
    (block) => `
      <tr>
        <td>
          <button
            class="text-button block-link"
            type="button"
            data-block="${escapeHtml(block.height)}"
          >
            ${escapeHtml(formatInteger(block.height))}
          </button>
        </td>

        <td>
          <span
            class="hash-short"
            title="${escapeHtml(block.hash)}"
          >
            ${escapeHtml(shortenHash(block.hash))}
          </span>
        </td>

        <td title="${escapeHtml(formatDate(block.time))}">
          ${escapeHtml(formatAge(block.time))}
        </td>

        <td>
          ${escapeHtml(formatInteger(block.txCount))}
        </td>

        <td>
          ${escapeHtml(formatBytes(block.size))}
        </td>
      </tr>
    `
  ).join("");

  bindBlockLinks(target);
}

function renderBlockTableError(
  id,
  message,
  columns
) {
  const target = element(id);

  if (!target) {
    return;
  }

  target.innerHTML = `
    <tr>
      <td colspan="${columns}">
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
}

function bindBlockLinks(container) {
  container.querySelectorAll("[data-block]").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => openBlock(button.dataset.block)
      );
    }
  );
}


/* ---------------------------------------------------------
   PEERS
--------------------------------------------------------- */

async function loadPeers() {
  try {
    const data = await api("/api/peers");

    state.peers = Array.isArray(data.peers)
      ? data.peers
      : [];

    renderPeers(state.peers);

    return data;
  } catch (error) {
    const target = element("peer-table");

    if (target) {
      target.innerHTML = `
        <tr>
          <td colspan="6">
            ${escapeHtml(error.message)}
          </td>
        </tr>
      `;
    }

    throw error;
  }
}

function renderPeers(peers) {
  const target = element("peer-table");

  if (!target) {
    return;
  }

  if (!peers.length) {
    target.innerHTML = `
      <tr>
        <td colspan="6">
          No connected peers.
        </td>
      </tr>
    `;
    return;
  }

  target.innerHTML = peers.map(
    (peer) => `
      <tr>
        <td>
          <span title="${escapeHtml(peer.addr)}">
            ${escapeHtml(peer.addr || "--")}
          </span>
        </td>

        <td>
          ${peer.inbound ? "Inbound" : "Outbound"}
        </td>

        <td>
          ${escapeHtml(peer.subver || peer.version || "--")}
        </td>

        <td>
          ${escapeHtml(
            formatInteger(
              peer.syncedBlocks ??
              peer.startingHeight
            )
          )}
        </td>

        <td>
          ${escapeHtml(formatBytes(peer.bytesReceived))}
        </td>

        <td>
          ${escapeHtml(formatBytes(peer.bytesSent))}
        </td>
      </tr>
    `
  ).join("");
}


/* ---------------------------------------------------------
   EXPLORER
--------------------------------------------------------- */

function initializeExplorer() {
  const form = element("explorer-search");

  if (!form) {
    return;
  }

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const input = element("explorer-query");
      const query = input?.value.trim();

      if (!query) {
        showExplorerError(
          "Enter a block height, block hash, or transaction ID."
        );
        return;
      }

      await searchExplorer(query);
    }
  );
}

async function searchExplorer(query) {
  showExplorerLoading(
    `Searching for ${query}...`
  );

  try {
    const result = await api(
      `/api/search?q=${encodeURIComponent(query)}`
    );

    if (result.type === "block") {
      await openBlock(
        result.height ?? result.hash
      );
      return;
    }

    if (result.type === "transaction") {
      await openTransaction(result.txid);
      return;
    }

    showExplorerError(
      "The search result type was not recognized."
    );
  } catch (error) {
    showExplorerError(error.message);
  }
}

async function openBlock(identifier) {
  showView("explorer");
  showExplorerLoading(
    `Loading block ${identifier}...`
  );

  try {
    const data = await api(
      `/api/block/${encodeURIComponent(identifier)}`
    );

    renderBlockDetail(data.block);
  } catch (error) {
    showExplorerError(error.message);
  }
}

async function openTransaction(txid) {
  showView("explorer");
  showExplorerLoading(
    `Loading transaction ${txid}...`
  );

  try {
    const data = await api(
      `/api/transaction/${encodeURIComponent(txid)}`
    );

    renderTransactionDetail(data.transaction);
  } catch (error) {
    showExplorerError(error.message);
  }
}

function showExplorerLoading(message) {
  const target = element("explorer-result");

  if (!target) {
    return;
  }

  target.classList.remove("error");
  target.classList.add("visible");
  target.textContent = message;
}

function showExplorerError(message) {
  const target = element("explorer-result");

  if (!target) {
    return;
  }

  target.classList.add(
    "visible",
    "error"
  );

  target.innerHTML = `
    <p>
      <strong>Explorer error</strong>
    </p>
    <p>${escapeHtml(message)}</p>
  `;
}

function renderBlockDetail(block) {
  const target = element("explorer-result");

  if (!target) {
    return;
  }

  const transactions = Array.isArray(block?.tx)
    ? block.tx
    : [];

  const transactionRows = transactions
    .slice(0, 100)
    .map((transaction) => {
      const txid = typeof transaction === "string"
        ? transaction
        : transaction.txid;

      return `
        <li>
          <button
            class="text-button transaction-link"
            type="button"
            data-transaction="${escapeHtml(txid)}"
          >
            ${escapeHtml(txid)}
          </button>
        </li>
      `;
    })
    .join("");

  target.classList.remove("error");
  target.classList.add("visible");

  target.innerHTML = `
    <div class="panel-heading">
      <div>
        <p class="eyebrow">BLOCK DETAIL</p>
        <h3>Block ${escapeHtml(formatInteger(block?.height))}</h3>
      </div>
    </div>

    <dl class="detail-list">
      <div>
        <dt>Hash</dt>
        <dd class="hash">${escapeHtml(block?.hash)}</dd>
      </div>

      <div>
        <dt>Confirmations</dt>
        <dd>${escapeHtml(formatInteger(block?.confirmations))}</dd>
      </div>

      <div>
        <dt>Timestamp</dt>
        <dd>${escapeHtml(formatDate(block?.time))}</dd>
      </div>

      <div>
        <dt>Difficulty</dt>
        <dd>${escapeHtml(formatDecimal(block?.difficulty, 8))}</dd>
      </div>

      <div>
        <dt>Size</dt>
        <dd>${escapeHtml(formatBytes(block?.size))}</dd>
      </div>

      <div>
        <dt>Transactions</dt>
        <dd>${escapeHtml(formatInteger(transactions.length))}</dd>
      </div>

      <div>
        <dt>Previous Block</dt>
        <dd class="hash">
          ${escapeHtml(block?.previousblockhash || "Genesis")}
        </dd>
      </div>

      <div>
        <dt>Next Block</dt>
        <dd class="hash">
          ${escapeHtml(block?.nextblockhash || "Chain tip")}
        </dd>
      </div>
    </dl>

    ${
      transactionRows
        ? `
          <div class="panel-heading">
            <div>
              <p class="eyebrow">TRANSACTIONS</p>
              <h3>Block Transactions</h3>
            </div>
          </div>

          <ol class="transaction-list">
            ${transactionRows}
          </ol>
        `
        : ""
    }
  `;

  target
    .querySelectorAll("[data-transaction]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => openTransaction(
          button.dataset.transaction
        )
      );
    });
}

function renderTransactionDetail(transaction) {
  const target = element("explorer-result");

  if (!target) {
    return;
  }

  const inputs = Array.isArray(transaction?.vin)
    ? transaction.vin
    : [];

  const outputs = Array.isArray(transaction?.vout)
    ? transaction.vout
    : [];

  const totalOutput = outputs.reduce(
    (total, output) => {
      const value = Number(output.value);
      return total + (
        Number.isFinite(value) ? value : 0
      );
    },
    0
  );

  target.classList.remove("error");
  target.classList.add("visible");

  target.innerHTML = `
    <div class="panel-heading">
      <div>
        <p class="eyebrow">TRANSACTION DETAIL</p>
        <h3>NVU Transaction</h3>
      </div>
    </div>

    <dl class="detail-list">
      <div>
        <dt>Transaction ID</dt>
        <dd class="hash">
          ${escapeHtml(transaction?.txid)}
        </dd>
      </div>

      <div>
        <dt>Block Hash</dt>
        <dd class="hash">
          ${escapeHtml(transaction?.blockhash || "--")}
        </dd>
      </div>

      <div>
        <dt>Confirmations</dt>
        <dd>
          ${escapeHtml(formatInteger(transaction?.confirmations))}
        </dd>
      </div>

      <div>
        <dt>Timestamp</dt>
        <dd>
          ${escapeHtml(formatDate(transaction?.time))}
        </dd>
      </div>

      <div>
        <dt>Inputs</dt>
        <dd>
          ${escapeHtml(formatInteger(inputs.length))}
        </dd>
      </div>

      <div>
        <dt>Outputs</dt>
        <dd>
          ${escapeHtml(formatInteger(outputs.length))}
        </dd>
      </div>

      <div>
        <dt>Total Output</dt>
        <dd>
          ${escapeHtml(formatDecimal(totalOutput, 8))} NVU
        </dd>
      </div>

      <div>
        <dt>Size</dt>
        <dd>
          ${escapeHtml(formatBytes(transaction?.size))}
        </dd>
      </div>
    </dl>
  `;
}


/* ---------------------------------------------------------
   BLOCKS FOUND
--------------------------------------------------------- */

async function loadBlocksFound() {
  const target = element("blocks-found-table");

  try {
    const data = await api(
      "/api/mining/blocks?limit=25"
    );

    const blocks = Array.isArray(data.blocks)
      ? data.blocks
      : [];

    setText(
      "blocks-found-count",
      `${formatInteger(data.count)} found`
    );

    if (!target) {
      return data;
    }

    if (!blocks.length) {
      target.innerHTML = `
        <tr>
          <td colspan="7">
            No NVU blocks have been found by this pool yet.
          </td>
        </tr>
      `;

      return data;
    }

    target.innerHTML = blocks.map(
      (block) => {
        const effort = Number.isFinite(
          Number(block.effortPercent)
        )
          ? `${Number(
              block.effortPercent
            ).toFixed(1)}%`
          : "--";

        const shares =
          block.shares === null ||
          block.shares === undefined
            ? "--"
            : formatCompactNumber(
                block.shares
              );

        return `
          <tr>
            <td>
              <button
                class="text-button block-link"
                type="button"
                data-block="${escapeHtml(block.height)}"
              >
                ${escapeHtml(formatInteger(block.height))}
              </button>
            </td>

            <td>
              ${escapeHtml(block.worker || "--")}
            </td>

            <td title="${escapeHtml(
              formatDate(block.timestampIso)
            )}">
              ${escapeHtml(
                formatAge(block.timestampIso)
              )}
            </td>

            <td>${escapeHtml(effort)}</td>

            <td>${escapeHtml(shares)}</td>

            <td>
              ${escapeHtml(
                formatCompactDifficulty(
                  block.solveDifficulty
                )
              )}
            </td>

            <td>
              <span class="status-pill online">
                ${escapeHtml(block.status || "Accepted")}
              </span>
            </td>
          </tr>
        `;
      }
    ).join("");

    bindBlockLinks(target);

    return data;

  } catch (error) {
    if (target) {
      target.innerHTML = `
        <tr>
          <td colspan="7">
            ${escapeHtml(error.message)}
          </td>
        </tr>
      `;
    }

    setText(
      "blocks-found-count",
      "Unavailable"
    );

    throw error;
  }
}


/* ---------------------------------------------------------
   VERSION
--------------------------------------------------------- */

async function loadVersion() {
  try {
    const data = await api("/api/version");

    setText(
      "dashboard-version",
      data.dashboardVersion
    );
  } catch {
    setText(
      "dashboard-version",
      "0.2.0"
    );
  }
}


/* ---------------------------------------------------------
   REFRESH
--------------------------------------------------------- */

async function refreshDashboard() {
  if (state.refreshing) {
    return;
  }

  state.refreshing = true;

  try {
    await Promise.all([
      loadStatus(),
      loadBlocksFound(),
      loadLatestBlocks(
        state.activeView === "explorer"
          ? CONFIG.explorerBlockLimit
          : CONFIG.overviewBlockLimit
      ),
    ]);

    if (state.activeView === "network") {
      await loadPeers();
    }
  } catch (error) {
    console.error(
      "NVU dashboard refresh failed:",
      error
    );
  } finally {
    state.refreshing = false;
  }
}

function startAutomaticRefresh() {
  if (state.refreshTimer) {
    window.clearInterval(
      state.refreshTimer
    );
  }

  state.refreshTimer = window.setInterval(
    refreshDashboard,
    CONFIG.refreshMilliseconds
  );
}


/* ---------------------------------------------------------
   STARTUP
--------------------------------------------------------- */

async function initialize() {
  initializeNavigation();
  initializeExplorer();

  await loadVersion();
  await refreshDashboard();

  startAutomaticRefresh();
}

document.addEventListener(
  "DOMContentLoaded",
  initialize
);
