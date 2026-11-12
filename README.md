# NouveauVision Community App Store

The official Umbrel Community App Store for **Nouveau-Vision Unit (NVU)**.

Nouveau-Vision is a SHA-256 proof-of-work network built around direct participation.

Run your own node. Operate your own solo mining pool. Connect your own SHA-256 mining hardware. Monitor your infrastructure through the NVU Dashboard.

**Your hardware. Your infrastructure. Your participation.**

---

## Nouveau-Vision NVU

The Nouveau-Vision NVU Umbrel app brings the core Nouveau-Vision infrastructure together on your Umbrel.

The app includes:

- **NVUN Full Node**
- **ASICseer-NVU Solo Mining Pool**
- **NVU Dashboard**
- **Local NVU Wallet Monitoring**
- **Peer and Network Monitoring**
- **Connected Miner Monitoring**
- **Mining Telemetry**
- **Recent Block Solve Information**

### Current Components

| Component | Version |
|---|---:|
| Nouveau-Vision Umbrel App | 1.2.1 |
| NVUN | 1.0.0 |
| NVU Dashboard | 1.2.1 |
| ASICseer-NVU | 1.0.0 |

---

## Add the Community App Store to Umbrel

In Umbrel, add the **NouveauVision Community App Store** using this repository.

**Community Store:** `github.com/thenouveauvision/nouveau-vision-umbrel`

Once the store has been added, install **Nouveau-Vision NVU** from the NouveauVision Community App Store.

---

## What Runs on Your Umbrel

### NVUN Full Node

NVUN is the Nouveau-Vision full-node software.

Your NVUN node synchronizes and validates the Nouveau-Vision blockchain and communicates directly with other NVUN peers across the network.

### ASICseer-NVU Solo Mining Pool

ASICseer-NVU provides a local Stratum interface for compatible SHA-256 mining hardware.

This allows your miners to connect directly to mining infrastructure running alongside your own NVUN node.

**Stratum V1 Port:** `3336`

### NVU Dashboard

The NVU Dashboard provides a unified view of your Nouveau-Vision infrastructure.

It includes monitoring for:

- NVUN node status
- Node uptime
- Blockchain synchronization
- Blockchain storage
- Network block height
- Network difficulty
- Estimated network hashrate
- Peer connections
- ASICseer-NVU pool status
- Connected miners
- Mining telemetry
- Recent block solves
- Local wallet status
- Wallet balances
- Recent wallet transactions
- Wallet addresses

The wallet interface provides **read-only monitoring** through the dashboard.

---

## Mining NVU

Nouveau-Vision uses **SHA-256 proof of work**.

The basic infrastructure path is:

```text
SHA-256 Miner
      |
      v
ASICseer-NVU Solo Pool
      |
      v
Your NVUN Node
      |
      v
Nouveau-Vision Network
```

The Umbrel app lets you operate the node and solo mining infrastructure under your own control.

### Mining

- **Algorithm:** SHA-256
- **Protocol:** Stratum V1
- **Umbrel Stratum Port:** 3336
- **Block Reward:** 50 NVU

---

## NVU Network

Nouveau-Vision operates as a peer-to-peer network of NVUN nodes.

### Public NVU Nodes

```text
node1.nvu.us:9333
node2.nvu.us:9333
node3.nvu.us:9333
```

**P2P Port:** `9333`

These public peers help NVUN nodes connect and participate in the Nouveau-Vision network.

---

## Public Network Dashboard

Detailed public node and network information:

**node1.nvu.us**

Primary Nouveau-Vision Unit website and live network overview:

**nvu.us**

---

## Nouveau-Vision Unit

| Property | Value |
|---|---|
| Currency | Nouveau-Vision Unit |
| Ticker | NVU |
| Proof of Work | SHA-256 |
| Full Node | NVUN |
| Block Reward | 50 NVU |
| P2P Port | 9333 |
| Solo Mining | ASICseer-NVU |
| Mining Protocol | Stratum V1 |
| Umbrel Stratum Port | 3336 |

---

## Direct Participation

Nouveau-Vision is built around a simple idea:

**Participation should mean more than pointing your hardware at someone else's infrastructure.**

With NVU, you can run the node, operate your own solo mining pool, connect compatible SHA-256 mining hardware, validate the blockchain, and participate directly in the network.

```text
Your Node.
Your Pool.
Your Miners.
```

---

## Project Links

- **Nouveau-Vision Unit:** nvu.us
- **Detailed Network Dashboard:** node1.nvu.us
- **Nouveau-Vision:** nouveau-vision.com
- **NouveauVision Community App Store:** github.com/thenouveauvision/nouveau-vision-umbrel

---

## Community App Store Repository

This repository contains the NouveauVision Umbrel Community App Store and the files required to distribute the Nouveau-Vision NVU app through Umbrel.

```text
NVUN
  +
ASICseer-NVU
  +
NVU Dashboard
  =
Your Nouveau-Vision Infrastructure
```

---

## Build the Network

**Run a node.**

**Mine a block.**

**Build the network.**

### Nouveau-Vision Unit · NVU
