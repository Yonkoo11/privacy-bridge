#!/usr/bin/env node
/**
 * Deploy separate PrivacyBridge + ShieldedToken pairs for each source chain
 * on Starknet devnet.
 *
 * Reuses the class declarations from the initial deploy, then instantiates
 * one bridge+token pair per source chain with the correct name/symbol.
 *
 * Prerequisites:
 *   starknet-devnet --seed 42   (port 5050)
 *   node scripts/rpc-proxy.mjs  (port 5051)
 *   node scripts/deploy-devnet.mjs  (must run first to declare classes)
 *
 * Usage:
 *   node scripts/deploy-starknet-multichain.mjs
 */
import { RpcProvider, Account, CallData, constants } from 'starknet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACC_ADDR = '0x034ba56f92265f0868c57d3fe72ecab144fc96f97954bbbc4252cef8e8a979ba';
const ACC_PK = '0xb137668388dbe9acdfa3bc734cc2c469';
const RPC_URL = process.env.STARKNET_RPC_URL || 'http://127.0.0.1:5051';

// Source chains that need Starknet bridge+token pairs
const SOURCE_CHAINS = [
  { key: 'flow-evm', chainId: 545, name: 'pFLOW', symbol: 'pFLOW' },
  { key: 'sepolia', chainId: 11155111, name: 'pETH', symbol: 'pETH' },
  { key: 'base-sepolia', chainId: 84532, name: 'pBASE', symbol: 'pBASE' },
  { key: 'arbitrum-sepolia', chainId: 421614, name: 'pARB', symbol: 'pARB' },
  { key: 'optimism-sepolia', chainId: 11155420, name: 'pOP', symbol: 'pOP' },
];

function stringToFelt(str) {
  let hex = '0x';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16);
  }
  return hex;
}

async function main() {
  // Load initial deployment to get class hashes
  const deployPath = path.join(__dirname, '..', 'deploy.json');
  if (!fs.existsSync(deployPath)) {
    console.error('deploy.json not found. Run deploy-devnet.mjs first to declare classes.');
    process.exit(1);
  }
  const initial = JSON.parse(fs.readFileSync(deployPath, 'utf8'));

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, ACC_ADDR, ACC_PK, '1', constants.TRANSACTION_VERSION.V3);

  const bridgeClass = initial.bridge_class_hash;
  const tokenClass = initial.token_class_hash;
  const verifierClass = initial.verifier_class_hash;

  console.log('Class hashes from initial deployment:');
  console.log(`  Bridge: ${bridgeClass}`);
  console.log(`  Token:  ${tokenClass}`);
  console.log(`  Verifier: ${verifierClass}`);

  const results = {};
  const multichainPath = path.join(__dirname, '..', 'deploy-multichain.json');

  // Check if we already have some deployments
  if (fs.existsSync(multichainPath)) {
    const existing = JSON.parse(fs.readFileSync(multichainPath, 'utf8'));
    Object.assign(results, existing);
    console.log(`\nLoaded ${Object.keys(existing).length} existing deployments`);
  }

  for (const chain of SOURCE_CHAINS) {
    if (results[chain.key]) {
      console.log(`\n--- ${chain.name} already deployed, skipping ---`);
      continue;
    }

    console.log(`\n=== Deploying ${chain.name} (source chain ${chain.key}, id ${chain.chainId}) ===`);

    // Deploy bridge with token_address=0x0 initially
    console.log(`  Deploying PrivacyBridge for ${chain.name}...`);
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
    console.log(`  Bridge: ${bridgeAddress}`);

    // Deploy token with bridge address
    const nameFelt = stringToFelt(chain.name);
    const symbolFelt = stringToFelt(chain.symbol);
    console.log(`  Deploying ShieldedToken (${chain.symbol})...`);
    const tokenRes = await account.deploy({
      classHash: tokenClass,
      constructorCalldata: CallData.compile({
        bridge: bridgeAddress,
        name: nameFelt,
        symbol: symbolFelt,
      }),
    });
    await provider.waitForTransaction(tokenRes.transaction_hash);
    const tokenAddress = tokenRes.contract_address[0];
    console.log(`  Token: ${tokenAddress}`);

    // Set token address on bridge
    console.log(`  Setting token address on bridge...`);
    const setTx = await account.execute({
      contractAddress: bridgeAddress,
      entrypoint: 'set_token_address',
      calldata: CallData.compile({ token_address: tokenAddress }),
    });
    await provider.waitForTransaction(setTx.transaction_hash);
    console.log(`  Done.`);

    results[chain.key] = {
      sourceChainId: chain.chainId,
      name: chain.name,
      symbol: chain.symbol,
      bridge_address: bridgeAddress,
      token_address: tokenAddress,
      timestamp: new Date().toISOString(),
    };

    // Save after each deployment (crash-safe)
    fs.writeFileSync(multichainPath, JSON.stringify(results, null, 2));
  }

  console.log('\n=== All Starknet bridge+token pairs deployed ===');
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nSaved to: ${multichainPath}`);
}

main().catch(err => {
  console.error('Deploy failed:', err.message || err);
  process.exit(1);
});
