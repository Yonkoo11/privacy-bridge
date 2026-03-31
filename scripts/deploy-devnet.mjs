#!/usr/bin/env node
/**
 * Deploy Privacy Bridge contracts to starknet-devnet.
 *
 * Deploys: ECIP ops -> Groth16 Verifier -> ShieldedToken (pFLOW) -> PrivacyBridge
 * The token is deployed first with a placeholder bridge address,
 * then the bridge is deployed with the token address.
 * Finally the token's bridge is already set correctly via constructor.
 *
 * Flow: deploy token(bridge=0x0 placeholder) -> deploy bridge(token) -> redeploy token(bridge=actual)
 * Actually: we deploy bridge first to get its address, then deploy token with bridge address.
 * But bridge needs token address... chicken-and-egg.
 *
 * Solution: Use UDC to predict bridge address, deploy token first, then deploy bridge.
 * Simpler solution: Deploy bridge with token=0x0, deploy token with bridge address,
 * then have bridge store token address via a setter... but that adds attack surface.
 *
 * Cleanest: Deploy in two passes using starknet.js deploy which returns the address.
 * 1. Declare all classes
 * 2. Compute bridge address deterministically (salt)
 * 3. Deploy token with computed bridge address
 * 4. Deploy bridge with token address
 *
 * Prerequisites:
 *   starknet-devnet --seed 42   (on port 5050)
 *   node scripts/rpc-proxy.mjs  (on port 5051)
 *   scarb build                 (in contracts/starknet/)
 *   starkli on PATH
 */
import { RpcProvider, Account, CallData, constants, hash } from 'starknet';
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

// ECIP ops contract
const ECIP_SIERRA_DIR = '/tmp/ecip-build/target/dev';
const ECIP_SIERRA = path.join(ECIP_SIERRA_DIR, 'universal_ecip_UniversalECIP.contract_class.json');
const ECIP_CASM = path.join(ECIP_SIERRA_DIR, 'universal_ecip_UniversalECIP.compiled_contract_class.json');

function ensureEcipBuild() {
  if (fs.existsSync(ECIP_SIERRA)) return;
  console.log('  Building ECIP ops contract from garaga source...');
  const cacheBase = path.join(process.env.HOME, 'Library/Caches/com.swmansion.scarb/registry/git/checkouts');
  const dirs = fs.readdirSync(cacheBase).filter(d => d.startsWith('garaga-'));
  if (dirs.length === 0) throw new Error('garaga not in scarb cache — run scarb build in contracts/starknet/ first');
  const garagaCheckout = fs.readdirSync(path.join(cacheBase, dirs[0]))[0];
  const ecipSrc = path.join(cacheBase, dirs[0], garagaCheckout, 'src/contracts/universal_ecip');

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
  const scarb214 = path.join(process.env.HOME, '.local/bin/scarb');
  const scarbBin = fs.existsSync(scarb214) ? scarb214 : 'scarb';
  execSync(`cd ${buildDir} && ${scarbBin} build`, { stdio: 'inherit', timeout: 180_000 });
}

async function main() {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, ACC_ADDR, ACC_PK, '1', constants.TRANSACTION_VERSION.V3);

  console.log('Account:', ACC_ADDR);

  // 0. Declare ECIP ops class
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

  // 3. Declare ShieldedToken
  console.log('\n--- Declaring ShieldedToken (pFLOW) ---');
  const tokenClass = declareWithCasmDiscovery(
    path.join(CONTRACTS_DIR, 'privacy_bridge_ShieldedToken.contract_class.json'),
    path.join(CONTRACTS_DIR, 'privacy_bridge_ShieldedToken.compiled_contract_class.json'),
  );
  console.log('Token class:', tokenClass);

  // 4. Deploy token first with a temporary bridge=0x0 (we'll redeploy properly)
  // Actually, use deterministic deployment: deploy bridge first, but bridge needs token...
  // Simplest: deploy token with bridge=account (temp), deploy bridge with token, then
  // redeploy token with correct bridge address.
  //
  // Even simpler for devnet: deploy both, token allows bridge to mint.
  // We need to know bridge address before deploying token.
  // Use UDC address calculation:
  //
  // starknet.js deploy uses UDC. We can compute the address before deploying.
  // But UDC address computation needs the deployer address and a unique flag.
  //
  // Cleanest approach: deploy token with bridge=0x1 (placeholder),
  // deploy bridge with real token address, then... token won't let bridge mint.
  //
  // Real solution: Add set_bridge() to token? No, that's attack surface.
  //
  // Best: compute bridge deploy address, deploy token with that address, then deploy bridge.
  const bridgeSalt = '0x1';
  const bridgeConstructorCalldata = CallData.compile({
    verifier_class_hash: verifierClass,
    owner: ACC_ADDR,
    token_address: '0x0', // placeholder, will be replaced after we know token address
  });

  // We need to compute the bridge address. UDC deploys use:
  // address = pedersen(deployer, salt, classHash, constructorHash)
  // But starknet.js calculateContractAddressFromHash can do this.
  // Problem: we need token address in bridge constructor, and bridge address in token constructor.
  //
  // Break the cycle: deploy token with a known salt so we can predict its address,
  // then deploy bridge with that token address.
  const tokenSalt = '0x2';
  const tokenConstructorForHash = CallData.compile({ bridge: '0x0' });

  // Actually let's just do two deploys and use the starknet.js built-in.
  // Deploy order: token(bridge=deployer_temp) -> bridge(token) won't work because token
  // will reject mints from the bridge.
  //
  // Final approach: compute both addresses via hash, deploy in correct order.
  // starknet.js hash.calculateContractAddressFromHash(salt, classHash, calldata, deployerAddress)

  // First compute token address (we need bridge address for its constructor)
  // This is circular. Let's use a 2-step deploy:
  // 1. Deploy bridge with token_address=0x0
  // 2. Deploy token with bridge=bridgeAddress
  // 3. The bridge has wrong token address... so add a set_token_address to bridge? Adds attack surface.
  //
  // Pragmatic devnet solution: add an owner-only set_token_address to bridge.
  // For production: use CREATE2-style deterministic addressing.
  //
  // Actually, simplest: compute the bridge address deterministically BEFORE deploying anything.
  // starknet.js UDC uses unique=true by default, which means:
  //   address = hash(PREFIX, deployer, salt, classHash, hash(calldata))
  // We can compute this if we know all the calldata.
  // But calldata includes token_address which we also don't know yet...
  //
  // OK, break the cycle by deploying token first with a dummy bridge, then deploy bridge,
  // then redeploy token. OR: predict token address.
  //
  // Let's use unique=false for token deployment so we can predict its address:
  //   address = hash(PREFIX, 0, salt, classHash, hash(calldata))
  // Then deploy bridge with that predicted token address.
  // Then deploy token at that predicted address.

  // Compute token address with unique=false
  const tokenCalldata = CallData.compile({ bridge: '0x0' }); // placeholder
  // We need to figure out bridge address first, but that needs token address...

  // FINAL APPROACH: Deploy bridge without token (token_address=0x0),
  // then deploy token with bridge address.
  // Bridge mints via IShieldedToken dispatcher call, which will fail if token_address=0x0.
  // So we add a one-time set_token_address function to the bridge.
  // This is the pragmatic path. Let me update bridge.cairo to add this.

  console.log('\n--- Deploying PrivacyBridge (token_address=0x0 initially) ---');
  const bridgeRes = await account.deploy({
    classHash: bridgeClass,
    constructorCalldata: CallData.compile({
      verifier_class_hash: verifierClass,
      owner: ACC_ADDR,
      token_address: '0x0',
    }),
  });
  await provider.waitForTransaction(bridgeRes.transaction_hash);
  const bridgeAddress = bridgeRes.contract_address[0];
  console.log('Bridge address:', bridgeAddress);

  console.log('\n--- Deploying ShieldedToken (pFLOW) ---');
  const tokenRes = await account.deploy({
    classHash: tokenClass,
    constructorCalldata: CallData.compile({
      bridge: bridgeAddress,
      name: '0x70464c4f57',      // 'pFLOW' as felt252
      symbol: '0x70464c4f57',    // 'pFLOW' as felt252
    }),
  });
  await provider.waitForTransaction(tokenRes.transaction_hash);
  const tokenAddress = tokenRes.contract_address[0];
  console.log('Token address:', tokenAddress);

  // Set token address on bridge
  console.log('\n--- Setting token address on bridge ---');
  const setTokenTx = await account.execute({
    contractAddress: bridgeAddress,
    entrypoint: 'set_token_address',
    calldata: CallData.compile({ token_address: tokenAddress }),
  });
  await provider.waitForTransaction(setTokenTx.transaction_hash);
  console.log('Token address set on bridge');

  // Save deployment info
  const deployInfo = {
    network: 'devnet',
    rpc: RPC_URL,
    ecip_class_hash: ecipClass,
    verifier_class_hash: verifierClass,
    bridge_class_hash: bridgeClass,
    token_class_hash: tokenClass,
    bridge_address: bridgeAddress,
    token_address: tokenAddress,
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
