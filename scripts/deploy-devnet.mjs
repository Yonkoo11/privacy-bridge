#!/usr/bin/env node
/**
 * Deploy Privacy Bridge contracts to starknet-devnet.
 *
 * Uses starkli for declares (handles CASM hash mismatch with devnet 0.7.2)
 * and starknet.js for deploy (handles UDC calldata encoding).
 *
 * Prerequisites:
 *   starknet-devnet --seed 42   (on port 5050)
 *   node scripts/rpc-proxy.mjs  (on port 5051)
 *   scarb build                 (in contracts/starknet/)
 *   starkli on PATH
 */
import { RpcProvider, Account, CallData, constants } from 'starknet';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.join(__dirname, '..', 'contracts', 'starknet', 'target', 'dev');

// devnet --seed 42 predeployed account #0
const ACC_ADDR = '0x034ba56f92265f0868c57d3fe72ecab144fc96f97954bbbc4252cef8e8a979ba';
const ACC_PK = '0xb137668388dbe9acdfa3bc734cc2c469';
const RPC_URL = process.env.STARKNET_RPC_URL || 'http://127.0.0.1:5051';

const STARKLI = `${process.env.HOME}/.starkli/bin/starkli`;
const STARKLI_ACCT = '/tmp/devnet-bridge-account.json';

// Create starkli account file if missing
if (!fs.existsSync(STARKLI_ACCT)) {
  fs.writeFileSync(STARKLI_ACCT, JSON.stringify({
    version: 1,
    variant: { type: 'open_zeppelin', version: 1, public_key: '0x05a5e37c60e77a0318643b111f88413a76af6233c891a0cfb2804106372006d4' },
    deployment: { status: 'deployed', class_hash: '0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564', address: ACC_ADDR },
  }));
}

function starkliDeclare(sierraPath, casmHash) {
  const out = execSync(
    `${STARKLI} declare --rpc ${RPC_URL} --account ${STARKLI_ACCT} --private-key ${ACC_PK} --casm-hash ${casmHash} ${sierraPath} --watch 2>&1`,
    { encoding: 'utf8', timeout: 180_000 }
  );
  const m = out.match(/Class hash declared:\n?(0x[0-9a-fA-F]+)/);
  if (m) return m[1];
  const m2 = out.match(/0x[0-9a-fA-F]{40,}/g);
  if (m2) return m2[m2.length - 1];
  throw new Error(`Could not parse class hash:\n${out}`);
}

/**
 * Two-step CASM hash discovery: try with starkli-computed hash first.
 * If devnet rejects it, parse the expected hash from the error and retry.
 */
function declareWithCasmDiscovery(sierraPath, casmPath) {
  // Compute the CASM hash from our compiled artifact
  const ourHash = execSync(`${STARKLI} class-hash ${casmPath}`, { encoding: 'utf8' }).trim();
  try {
    return starkliDeclare(sierraPath, ourHash);
  } catch (e) {
    const errMsg = e.stderr || e.stdout || e.message || '';
    const m = errMsg.match(/Expected: (0x[0-9a-fA-F]+)/);
    if (m) {
      console.log(`  CASM mismatch, retrying with devnet hash: ${m[1]}`);
      return starkliDeclare(sierraPath, m[1]);
    }
    throw e;
  }
}

// ECIP ops contract: built from garaga source, needed for MSM operations during proof verification.
// The verifier does library_call to this class hash.
const ECIP_SIERRA_DIR = '/tmp/ecip-build/target/dev';
const ECIP_SIERRA = path.join(ECIP_SIERRA_DIR, 'universal_ecip_UniversalECIP.contract_class.json');
const ECIP_CASM = path.join(ECIP_SIERRA_DIR, 'universal_ecip_UniversalECIP.compiled_contract_class.json');

function ensureEcipBuild() {
  if (fs.existsSync(ECIP_SIERRA)) return;
  console.log('  Building ECIP ops contract from garaga source...');
  // Find garaga source in scarb cache
  const cacheBase = path.join(process.env.HOME, 'Library/Caches/com.swmansion.scarb/registry/git/checkouts');
  const dirs = fs.readdirSync(cacheBase).filter(d => d.startsWith('garaga-'));
  if (dirs.length === 0) throw new Error('garaga not in scarb cache — run scarb build in contracts/starknet/ first');
  const garagaCheckout = fs.readdirSync(path.join(cacheBase, dirs[0]))[0];
  const ecipSrc = path.join(cacheBase, dirs[0], garagaCheckout, 'src/contracts/universal_ecip');

  // Copy to temp build dir with git dependency instead of relative path
  const buildDir = '/tmp/ecip-build';
  execSync(`rm -rf ${buildDir} && mkdir -p ${buildDir}/src`);
  fs.copyFileSync(path.join(ecipSrc, 'src/lib.cairo'), path.join(buildDir, 'src/lib.cairo'));
  fs.writeFileSync(path.join(buildDir, 'Scarb.toml'), `[package]
name = "universal_ecip"
version = "0.1.0"
edition = "2024_07"
[dependencies]
garaga = { git = "https://github.com/keep-starknet-strange/garaga.git", tag = "v1.0.1" }
starknet = "2.14.0"
[cairo]
sierra-replace-ids = false
[[target.starknet-contract]]
casm = true
casm-add-pythonic-hints = true
`);
  // Use scarb 2.14.0
  const scarb214 = path.join(process.env.HOME, '.local/bin/scarb');
  const scarbBin = fs.existsSync(scarb214) ? scarb214 : 'scarb';
  execSync(`cd ${buildDir} && ${scarbBin} build`, { stdio: 'inherit', timeout: 180_000 });
}

async function main() {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, ACC_ADDR, ACC_PK, '1', constants.TRANSACTION_VERSION.V3);

  console.log('Account:', ACC_ADDR);

  // 0. Declare ECIP ops class (required by garaga verifier for MSM operations)
  console.log('\n--- Declaring ECIP ops (UniversalECIP) ---');
  ensureEcipBuild();
  const ecipClass = declareWithCasmDiscovery(ECIP_SIERRA, ECIP_CASM);
  console.log('ECIP ops class:', ecipClass);

  // 1. Declare verifier
  console.log('\n--- Declaring Groth16VerifierBN254 ---');
  const verifierClass = declareWithCasmDiscovery(
    path.join(CONTRACTS_DIR, 'privacy_bridge_Groth16VerifierBN254.contract_class.json'),
    path.join(CONTRACTS_DIR, 'privacy_bridge_Groth16VerifierBN254.compiled_contract_class.json'),
  );
  console.log('Verifier class:', verifierClass);

  // 2. Declare bridge
  console.log('\n--- Declaring PrivacyBridge ---');
  const bridgeClass = declareWithCasmDiscovery(
    path.join(CONTRACTS_DIR, 'privacy_bridge_PrivacyBridge.contract_class.json'),
    path.join(CONTRACTS_DIR, 'privacy_bridge_PrivacyBridge.compiled_contract_class.json'),
  );
  console.log('Bridge class:', bridgeClass);

  // 3. Deploy bridge via starknet.js (handles UDC calldata correctly)
  console.log('\n--- Deploying PrivacyBridge ---');
  const res = await account.deploy({
    classHash: bridgeClass,
    constructorCalldata: CallData.compile({
      verifier_class_hash: verifierClass,
      owner: ACC_ADDR,
    }),
  });
  await provider.waitForTransaction(res.transaction_hash);
  const bridgeAddress = res.contract_address[0];
  console.log('Bridge address:', bridgeAddress);

  // Save deployment info
  const deployInfo = {
    network: 'devnet',
    rpc: RPC_URL,
    ecip_class_hash: ecipClass,
    verifier_class_hash: verifierClass,
    bridge_class_hash: bridgeClass,
    bridge_address: bridgeAddress,
    owner: ACC_ADDR,
    timestamp: new Date().toISOString(),
  };

  const deployPath = path.join(__dirname, '..', 'deploy.json');
  fs.writeFileSync(deployPath, JSON.stringify(deployInfo, null, 2));
  console.log(`\nDeployment saved: ${deployPath}`);
}

main().catch(err => {
  console.error('Deploy failed:', err.message || err);
  process.exit(1);
});
