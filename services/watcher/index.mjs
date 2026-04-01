/**
 * Root Relay Watcher
 *
 * Watches Flow EVM PrivacyBridge for NewRoot(uint256 root) events
 * and relays them to Starknet's add_known_root(root).
 *
 * Restart-safe: persists last processed block to watcher-state.json.
 *
 * Config (env vars):
 *   SOURCE_RPC_URL             - Flow EVM RPC endpoint
 *   STARKNET_RPC_URL         - Starknet RPC endpoint
 *   SOURCE_BRIDGE_ADDRESS      - PrivacyBridge contract on Flow EVM
 *   STARKNET_BRIDGE_ADDRESS  - PrivacyBridge contract on Starknet
 *   RELAY_PRIVATE_KEY        - ETH private key (for signing -- not used for watching, kept for future use)
 *   STARKNET_ACCOUNT_ADDRESS - Starknet account address that owns the bridge
 *   STARKNET_PRIVATE_KEY     - Starknet account private key
 *   POLL_INTERVAL_MS         - Polling interval in ms (default 15000)
 */

import { ethers } from 'ethers';
import { RpcProvider, Account, Contract, CallData, constants } from 'starknet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// SOURCE_CHAIN identifies which EVM source chain this watcher instance monitors.
// Run one watcher per source chain (e.g., SOURCE_CHAIN=flow-evm-testnet).
const SOURCE_CHAIN = process.env.SOURCE_CHAIN || 'flow-evm-testnet';
const SOURCE_RPC_URL = process.env.SOURCE_RPC_URL || 'https://testnet.evm.nodes.onflow.org';
const STARKNET_RPC_URL = process.env.STARKNET_RPC_URL || 'http://localhost:5050';
const SOURCE_BRIDGE_ADDRESS = process.env.SOURCE_BRIDGE_ADDRESS;
const STARKNET_BRIDGE_ADDRESS = process.env.STARKNET_BRIDGE_ADDRESS;
const STARKNET_ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS;
const STARKNET_PRIVATE_KEY = process.env.STARKNET_PRIVATE_KEY;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, `watcher-state-${SOURCE_CHAIN}.json`);

// ---------------------------------------------------------------------------
// ABI (only what we need)
// ---------------------------------------------------------------------------

const SOURCE_BRIDGE_ABI = [
  'event NewRoot(uint256 root)',
  'function getLatestRoot() view returns (uint256)',
];

const STARKNET_BRIDGE_ABI = [
  {
    name: 'add_known_root',
    type: 'function',
    inputs: [{ name: 'root', type: 'core::integer::u256' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'get_merkle_root',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
];

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastBlock: 0 };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(level, msg, data) {
  const ts = new Date().toISOString();
  const line = data
    ? `[${ts}] [${level}] ${msg} ${JSON.stringify(data)}`
    : `[${ts}] [${level}] ${msg}`;
  console.log(line);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateConfig() {
  const required = {
    SOURCE_BRIDGE_ADDRESS,
    STARKNET_BRIDGE_ADDRESS,
    STARKNET_ACCOUNT_ADDRESS,
    STARKNET_PRIVATE_KEY,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    log('ERROR', `Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Core relay logic
// ---------------------------------------------------------------------------

async function relayNewRoots(sourceContract, starknetContract, starknetAccount) {
  const state = loadState();
  const currentBlock = await sourceContract.runner.provider.getBlockNumber();

  if (currentBlock <= state.lastBlock) {
    return; // no new blocks
  }

  const fromBlock = state.lastBlock + 1;
  const toBlock = currentBlock;

  log('INFO', `Scanning blocks ${fromBlock} - ${toBlock}`);

  const filter = sourceContract.filters.NewRoot();
  let events;
  try {
    events = await sourceContract.queryFilter(filter, fromBlock, toBlock);
  } catch (err) {
    log('ERROR', 'Failed to query Flow events', { error: err.message });
    return;
  }

  if (events.length === 0) {
    saveState({ lastBlock: toBlock });
    return;
  }

  log('INFO', `Found ${events.length} NewRoot event(s)`);

  for (const event of events) {
    const root = event.args[0];
    const rootHex = '0x' + root.toString(16);

    log('INFO', 'Relaying root to Starknet', {
      root: rootHex,
      flowBlock: event.blockNumber,
      flowTx: event.transactionHash,
    });

    try {
      // Split u256 into low/high felt252 for Starknet
      const rootBigInt = BigInt(root);
      const low = (rootBigInt & ((1n << 128n) - 1n)).toString();
      const high = (rootBigInt >> 128n).toString();

      const tx = await starknetAccount.execute([
        {
          contractAddress: STARKNET_BRIDGE_ADDRESS,
          entrypoint: 'add_known_root',
          calldata: CallData.compile({ root: { low, high } }),
        },
      ]);

      log('INFO', 'Starknet tx submitted', { txHash: tx.transaction_hash });

      await starknetAccount.waitForTransaction(tx.transaction_hash);

      log('INFO', 'Root relayed successfully', {
        root: rootHex,
        starknetTx: tx.transaction_hash,
      });
    } catch (err) {
      log('ERROR', 'Failed to relay root', {
        root: rootHex,
        error: err.message,
      });
      // Don't update state -- retry on next poll
      return;
    }
  }

  saveState({ lastBlock: toBlock });
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

async function healthCheck(sourceContract, starknetContract) {
  try {
    const sourceRoot = await sourceContract.getLatestRoot();
    const starknetRoot = await starknetContract.get_merkle_root();

    const sourceHex = '0x' + BigInt(sourceRoot).toString(16);
    const starknetHex = '0x' + BigInt(starknetRoot).toString(16);
    const synced = sourceHex === starknetHex;

    log('HEALTH', `Root comparison [${SOURCE_CHAIN}]`, {
      source: sourceHex,
      starknet: starknetHex,
      synced,
    });
  } catch (err) {
    log('HEALTH', 'Health check failed', { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
  validateConfig();

  log('INFO', `Starting Root Relay Watcher [${SOURCE_CHAIN}]`, {
    sourceChain: SOURCE_CHAIN,
    sourceRpc: SOURCE_RPC_URL,
    starknetRpc: STARKNET_RPC_URL,
    sourceBridge: SOURCE_BRIDGE_ADDRESS,
    starknetBridge: STARKNET_BRIDGE_ADDRESS,
    pollInterval: POLL_INTERVAL_MS,
  });

  // Source EVM chain setup
  const sourceProvider = new ethers.JsonRpcProvider(SOURCE_RPC_URL);
  const sourceContract = new ethers.Contract(
    SOURCE_BRIDGE_ADDRESS,
    SOURCE_BRIDGE_ABI,
    sourceProvider,
  );

  // Starknet setup
  const starknetProvider = new RpcProvider({ nodeUrl: STARKNET_RPC_URL });
  const starknetAccount = new Account(
    starknetProvider,
    STARKNET_ACCOUNT_ADDRESS,
    STARKNET_PRIVATE_KEY,
    '1',
    constants.TRANSACTION_VERSION.V3,
  );
  const starknetContract = new Contract(
    STARKNET_BRIDGE_ABI,
    STARKNET_BRIDGE_ADDRESS,
    starknetProvider,
  );

  // Initial health check
  await healthCheck(sourceContract, starknetContract);

  // Poll loop
  let running = true;
  let healthTimer;

  const poll = async () => {
    while (running) {
      try {
        await relayNewRoots(sourceContract, starknetContract, starknetAccount);
      } catch (err) {
        log('ERROR', 'Poll cycle failed', { error: err.message });
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  };

  // Health check every 60s
  healthTimer = setInterval(
    () => healthCheck(sourceContract, starknetContract),
    60_000,
  );

  // Graceful shutdown
  const shutdown = (signal) => {
    log('INFO', `Received ${signal}, shutting down...`);
    running = false;
    clearInterval(healthTimer);

    // Give in-flight operations 5s to finish
    setTimeout(() => {
      log('INFO', 'Watcher stopped');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await poll();
}

main().catch((err) => {
  log('FATAL', 'Watcher crashed', { error: err.message, stack: err.stack });
  process.exit(1);
});
