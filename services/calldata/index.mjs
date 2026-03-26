/**
 * Garaga Calldata Proxy
 *
 * HTTP wrapper around the Python garaga subprocess.
 * Takes a snarkjs proof + publicSignals, returns garaga calldata (~2918 felts).
 *
 * Endpoints:
 *   POST /calldata - Generate garaga calldata from proof
 *   GET  /health   - Service health check
 *
 * Config (env vars):
 *   PYTHON_PATH - Path to python3.10 binary (default '/opt/homebrew/bin/python3.10')
 *   VK_PATH     - Path to verification_key.json (default 'circuits/target/verification_key.json')
 *   PORT        - HTTP port (default 3002)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PYTHON_PATH = process.env.PYTHON_PATH || '/opt/homebrew/bin/python3.10';
const VK_PATH = process.env.VK_PATH || 'circuits/target/verification_key.json';
const PORT = parseInt(process.env.PORT || '3002', 10);

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
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const MAX_BODY = 5 * 1024 * 1024; // 5 MB (proofs can be large)

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

// ---------------------------------------------------------------------------
// Garaga calldata generation
// ---------------------------------------------------------------------------

/**
 * Generate garaga calldata by spawning a Python subprocess.
 *
 * Same logic as sdk/src/prover.mjs generateGaragaCalldata(),
 * but async and with proper error handling for a service context.
 *
 * @param {object} proof - snarkjs proof object (pi_a, pi_b, pi_c)
 * @param {string[]} publicSignals - snarkjs public signals (decimal strings)
 * @returns {Promise<string[]>} garaga calldata as string array
 */
async function generateCalldata(proof, publicSignals) {
  const tag = crypto.randomUUID();
  const tmpDir = os.tmpdir();
  const proofPath = path.join(tmpDir, `cd-proof-${tag}.json`);
  const pubPath = path.join(tmpDir, `cd-pub-${tag}.json`);
  const cdOutPath = path.join(tmpDir, `cd-out-${tag}.json`);
  const pyPath = path.join(tmpDir, `cd-garaga-${tag}.py`);

  const vkAbsPath = path.resolve(VK_PATH);

  // Validate VK file exists
  if (!fs.existsSync(vkAbsPath)) {
    throw new Error(`Verification key not found at ${vkAbsPath}`);
  }

  const pyScript = [
    'import sys, json',
    'from garaga.starknet.groth16_contract_generator.calldata import groth16_calldata_from_vk_and_proof',
    'from garaga.starknet.groth16_contract_generator.parsing_utils import Groth16Proof, Groth16VerifyingKey',
    `vk = Groth16VerifyingKey.from_json('${vkAbsPath}')`,
    `proof = Groth16Proof.from_json(proof_path='${proofPath}', public_inputs_path='${pubPath}')`,
    'calldata = groth16_calldata_from_vk_and_proof(vk, proof)',
    `json.dump([str(x) for x in calldata], open('${cdOutPath}', 'w'))`,
    'print(len(calldata))',
  ].join('\n');

  try {
    fs.writeFileSync(proofPath, JSON.stringify(proof));
    fs.writeFileSync(pubPath, JSON.stringify(publicSignals));
    fs.writeFileSync(pyPath, pyScript);

    const { stdout, stderr } = await execFileAsync(PYTHON_PATH, [pyPath], {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr) {
      log('WARN', 'Python stderr', { stderr: stderr.slice(0, 500) });
    }

    const numFelts = parseInt(stdout.trim(), 10);
    if (isNaN(numFelts) || numFelts < 30) {
      throw new Error(`garaga returned ${numFelts} felts, expected ~2918`);
    }

    const calldata = JSON.parse(fs.readFileSync(cdOutPath, 'utf8'));

    // Strip garaga's length prefix if present (same logic as sdk/src/prover.mjs)
    if (calldata.length > 1 && parseInt(calldata[0], 10) === calldata.length - 1) {
      return calldata.slice(1);
    }

    return calldata;
  } finally {
    // Clean up all temp files
    for (const f of [proofPath, pubPath, pyPath, cdOutPath]) {
      try {
        fs.unlinkSync(f);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleCalldata(req, res) {
  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
    return;
  }

  const { proof, publicSignals } = body;

  if (!proof || typeof proof !== 'object') {
    sendJson(res, 400, { error: 'proof must be an object (snarkjs proof with pi_a, pi_b, pi_c)' });
    return;
  }

  if (!Array.isArray(publicSignals) || publicSignals.length === 0) {
    sendJson(res, 400, { error: 'publicSignals must be a non-empty array of strings' });
    return;
  }

  log('INFO', 'Calldata request received', {
    publicSignalsCount: publicSignals.length,
  });

  const startMs = Date.now();

  try {
    const calldata = await generateCalldata(proof, publicSignals);
    const durationMs = Date.now() - startMs;

    log('INFO', 'Calldata generated', {
      felts: calldata.length,
      durationMs,
    });

    sendJson(res, 200, { calldata });
  } catch (err) {
    const durationMs = Date.now() - startMs;

    log('ERROR', 'Calldata generation failed', {
      error: err.message,
      durationMs,
    });

    sendJson(res, 500, {
      error: 'Calldata generation failed',
      details: err.message,
    });
  }
}

function handleHealth(res) {
  const vkExists = fs.existsSync(path.resolve(VK_PATH));

  sendJson(res, 200, {
    status: vkExists ? 'ok' : 'degraded',
    service: 'privacy-bridge-calldata',
    vkPath: path.resolve(VK_PATH),
    vkExists,
    pythonPath: PYTHON_PATH,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

async function main() {
  log('INFO', 'Starting Calldata Proxy', {
    pythonPath: PYTHON_PATH,
    vkPath: path.resolve(VK_PATH),
    port: PORT,
  });

  const server = http.createServer(async (req, res) => {
    const { method, url } = req;

    try {
      if (method === 'POST' && url === '/calldata') {
        await handleCalldata(req, res);
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
    log('INFO', `Calldata proxy listening on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    log('INFO', `Received ${signal}, shutting down...`);
    server.close(() => {
      log('INFO', 'Calldata proxy stopped');
      process.exit(0);
    });

    setTimeout(() => process.exit(0), 5000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log('FATAL', 'Calldata proxy crashed', { error: err.message, stack: err.stack });
  process.exit(1);
});
