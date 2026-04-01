/**
 * Relayer Service
 *
 * HTTP API for gasless withdrawals on Starknet.
 * Accepts ZK proof calldata, submits mint() to the bridge, earns a fee.
 *
 * Endpoints:
 *   POST /relay  - Submit a withdrawal relay request
 *   GET  /health - Service health check
 *   GET  /fee    - Current on-chain relayer fee
 *
 * Config (env vars):
 *   STARKNET_RPC_URL         - Starknet RPC endpoint
 *   STARKNET_BRIDGE_ADDRESS  - PrivacyBridge contract on Starknet
 *   RELAYER_PRIVATE_KEY      - Starknet account private key
 *   STARKNET_ACCOUNT_ADDRESS - Starknet account address
 *   PORT                     - HTTP port (default 3001)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RpcProvider, Account, Contract, CallData, constants } from 'starknet';
import { createReceipt, uploadReceipt } from '../../sdk/src/storacha.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STARKNET_RPC_URL = process.env.STARKNET_RPC_URL || 'http://localhost:5050';
const STARKNET_BRIDGE_ADDRESS = process.env.STARKNET_BRIDGE_ADDRESS; // default/fallback bridge
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const STARKNET_ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS;
const PORT = parseInt(process.env.PORT || '3001', 10);

// Multichain routing table: sourceChain -> Starknet bridge address
const BRIDGE_ROUTING = {};
function loadMultichainConfig() {
  const mcPath = path.join(__dirname, '..', '..', 'deploy-multichain.json');
  if (fs.existsSync(mcPath)) {
    const mc = JSON.parse(fs.readFileSync(mcPath, 'utf8'));
    for (const [key, info] of Object.entries(mc)) {
      BRIDGE_ROUTING[key] = info.bridge_address;
    }
    log('INFO', `Loaded multichain routing for ${Object.keys(BRIDGE_ROUTING).length} chains`);
  }
  // Always have the default
  if (STARKNET_BRIDGE_ADDRESS) {
    BRIDGE_ROUTING['default'] = STARKNET_BRIDGE_ADDRESS;
  }
}

function resolveBridgeAddress(sourceChain) {
  if (sourceChain && BRIDGE_ROUTING[sourceChain]) return BRIDGE_ROUTING[sourceChain];
  return BRIDGE_ROUTING['default'] || STARKNET_BRIDGE_ADDRESS;
}

// ---------------------------------------------------------------------------
// ABI (only what we need)
// ---------------------------------------------------------------------------

const BRIDGE_ABI = [
  {
    name: 'mint',
    type: 'function',
    inputs: [
      { name: 'full_proof_with_hints', type: 'core::array::Span::<core::felt252>' },
      { name: 'max_fee_bps', type: 'core::integer::u256' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'get_relayer_fee',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
];

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
// Rate limiter (10 req/min per IP, in-memory)
// ---------------------------------------------------------------------------

// Storacha client (initialized in main, null if W3UP_EMAIL not configured)
let storachaClient = null;

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Periodic cleanup to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    ...CORS_HEADERS,
  });
  res.end(json);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const MAX_BODY = 1024 * 1024; // 1 MB

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

// Use socket address for rate limiting (x-forwarded-for is trivially spoofable).
// If behind a reverse proxy, configure the proxy to set a trusted header
// and update this function to read from that header instead.
function getClientIP(req) {
  return req.socket.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateConfig() {
  const required = {
    RELAYER_PRIVATE_KEY,
    STARKNET_ACCOUNT_ADDRESS,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    log('ERROR', `Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!STARKNET_BRIDGE_ADDRESS && Object.keys(BRIDGE_ROUTING).length === 0) {
    log('ERROR', 'No bridge addresses configured. Set STARKNET_BRIDGE_ADDRESS or provide deploy-multichain.json');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleRelay(req, res, account, bridgeContract) {
  const ip = getClientIP(req);

  if (isRateLimited(ip)) {
    sendJson(res, 429, { error: 'Rate limit exceeded (10 req/min)' });
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
    return;
  }

  const { calldata, max_fee_bps, sourceChain } = body;

  if (!Array.isArray(calldata) || calldata.length === 0) {
    sendJson(res, 400, { error: 'calldata must be a non-empty array of strings' });
    return;
  }

  if (typeof max_fee_bps !== 'number' || max_fee_bps < 0) {
    sendJson(res, 400, { error: 'max_fee_bps must be a non-negative number' });
    return;
  }

  // Resolve the correct Starknet bridge for this source chain
  const targetBridge = resolveBridgeAddress(sourceChain);

  log('INFO', 'Relay request received', {
    ip,
    sourceChain: sourceChain || 'default',
    targetBridge,
    calldataLength: calldata.length,
    max_fee_bps,
  });

  try {
    // Create contract instance for the target bridge
    const targetContract = new Contract(BRIDGE_ABI, targetBridge, account);
    const feeBps = await targetContract.get_relayer_fee();
    const feeNum = Number(feeBps);

    if (feeNum === 0) {
      log('WARN', 'Relayer fee is 0 -- no profit from this relay');
    }

    // Estimate gas to check viability
    // For now, we submit directly -- gas estimation on Starknet devnet
    // can be unreliable, so we catch execution errors instead.

    // Build the mint() call
    const maxFeeBig = BigInt(max_fee_bps);
    const maxFeeLow = (maxFeeBig & ((1n << 128n) - 1n)).toString();
    const maxFeeHigh = (maxFeeBig >> 128n).toString();

    const tx = await account.execute([
      {
        contractAddress: targetBridge,
        entrypoint: 'mint',
        calldata: CallData.compile({
          full_proof_with_hints: calldata,
          max_fee_bps: { low: maxFeeLow, high: maxFeeHigh },
        }),
      },
    ]);

    log('INFO', 'Mint tx submitted', { txHash: tx.transaction_hash });

    const receipt = await account.waitForTransaction(tx.transaction_hash);

    log('INFO', 'Relay completed', {
      txHash: tx.transaction_hash,
      status: receipt.execution_status || 'ACCEPTED',
    });

    // Best-effort Storacha receipt upload (non-blocking for relay response)
    let receiptCid = null;
    try {
      if (storachaClient) {
        const bridgeReceipt = createReceipt({
          commitment: BigInt(calldata[0] || '0'),
          nullifierHash: BigInt(calldata[1] || '0'),
          amount: BigInt(calldata[2] || '0'),
          sourceChain: sourceChain || 'unknown',
          destChain: 'starknet',
        });
        receiptCid = await uploadReceipt(storachaClient, bridgeReceipt);
        log('INFO', 'Receipt uploaded to Storacha', { cid: receiptCid });
      }
    } catch (storachaErr) {
      log('WARN', 'Storacha receipt upload failed (non-critical)', {
        error: storachaErr.message,
      });
    }

    sendJson(res, 200, {
      success: true,
      txHash: tx.transaction_hash,
      feeBps: feeNum,
      receiptCid,
    });
  } catch (err) {
    log('ERROR', 'Relay failed', { error: err.message });
    sendJson(res, 500, {
      error: 'Relay transaction failed',
      details: err.message,
    });
  }
}

async function handleFee(res, bridgeContract) {
  try {
    const feeBps = await bridgeContract.get_relayer_fee();
    sendJson(res, 200, {
      fee_bps: Number(feeBps),
      fee_percent: Number(feeBps) / 100,
    });
  } catch (err) {
    log('ERROR', 'Failed to fetch fee', { error: err.message });
    sendJson(res, 500, { error: 'Failed to fetch relayer fee' });
  }
}

function handleHealth(res) {
  sendJson(res, 200, {
    status: 'ok',
    service: 'privacy-bridge-relayer',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

async function main() {
  loadMultichainConfig();
  validateConfig();

  const provider = new RpcProvider({ nodeUrl: STARKNET_RPC_URL });
  const account = new Account(
    provider,
    STARKNET_ACCOUNT_ADDRESS,
    RELAYER_PRIVATE_KEY,
    '1',
    constants.TRANSACTION_VERSION.V3,
  );
  const bridgeContract = new Contract(
    BRIDGE_ABI,
    STARKNET_BRIDGE_ADDRESS,
    provider,
  );

  // Initialize Storacha client if configured
  const W3UP_EMAIL = process.env.W3UP_EMAIL;
  if (W3UP_EMAIL) {
    try {
      const { create } = await import('@web3-storage/w3up-client');
      storachaClient = await create();
      log('INFO', 'Storacha client initialized', { email: W3UP_EMAIL });
    } catch (err) {
      log('WARN', 'Storacha init failed, receipts will not be uploaded', {
        error: err.message,
      });
    }
  } else {
    log('INFO', 'W3UP_EMAIL not set, Storacha receipt upload disabled');
  }

  const server = http.createServer(async (req, res) => {
    const { method, url } = req;

    try {
      // CORS preflight
      if (method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }

      if (method === 'POST' && url === '/relay') {
        await handleRelay(req, res, account, bridgeContract);
      } else if (method === 'GET' && url === '/fee') {
        await handleFee(res, bridgeContract);
      } else if (method === 'GET' && url === '/health') {
        handleHealth(res);
      } else {
        sendJson(res, 404, { error: 'Not found' });
      }
    } catch (err) {
      log('ERROR', 'Unhandled request error', { error: err.message });
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });

  server.listen(PORT, () => {
    log('INFO', `Relayer service listening on port ${PORT}`, {
      starknetRpc: STARKNET_RPC_URL,
      bridge: STARKNET_BRIDGE_ADDRESS,
    });
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    log('INFO', `Received ${signal}, shutting down...`);
    server.close(() => {
      log('INFO', 'Relayer stopped');
      process.exit(0);
    });

    // Force exit after 5s if connections hang
    setTimeout(() => process.exit(0), 5000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log('FATAL', 'Relayer crashed', { error: err.message, stack: err.stack });
  process.exit(1);
});
