#!/usr/bin/env node
/**
 * Deploy PoseidonT3Wrapper + PrivacyBridge to any EVM chain.
 *
 * Usage:
 *   DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-evm.mjs --chain sepolia
 *   DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-evm.mjs --chain base-sepolia
 *
 * Supported chains: flow-evm-testnet, sepolia, base-sepolia, arbitrum-sepolia, polygon-amoy, optimism-sepolia
 */
import { ethers } from 'ethers';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.join(__dirname, '..', 'contracts', 'flow');
const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');

const CHAINS = {
  'flow-evm-testnet': { rpc: 'https://testnet.evm.nodes.onflow.org', chainId: 545, name: 'Flow EVM Testnet', symbol: 'FLOW' },
  'sepolia': { rpc: 'https://rpc.sepolia.org', chainId: 11155111, name: 'Ethereum Sepolia', symbol: 'ETH' },
  'base-sepolia': { rpc: 'https://sepolia.base.org', chainId: 84532, name: 'Base Sepolia', symbol: 'ETH' },
  'arbitrum-sepolia': { rpc: 'https://sepolia-rollup.arbitrum.io/rpc', chainId: 421614, name: 'Arbitrum Sepolia', symbol: 'ETH' },
  'polygon-amoy': { rpc: 'https://rpc-amoy.polygon.technology', chainId: 80002, name: 'Polygon Amoy', symbol: 'POL' },
  'optimism-sepolia': { rpc: 'https://sepolia.optimism.io', chainId: 11155420, name: 'Optimism Sepolia', symbol: 'ETH' },
};

function getChainArg() {
  const idx = process.argv.indexOf('--chain');
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error('Usage: DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-evm.mjs --chain <chain-key>');
    console.error('Chains:', Object.keys(CHAINS).join(', '));
    process.exit(1);
  }
  const key = process.argv[idx + 1];
  if (!CHAINS[key]) {
    console.error(`Unknown chain: ${key}`);
    console.error('Available:', Object.keys(CHAINS).join(', '));
    process.exit(1);
  }
  return { key, ...CHAINS[key] };
}

async function main() {
  const chain = getChainArg();
  const privateKey = process.env.DEPLOY_PRIVATE_KEY || process.env.FLOW_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Set DEPLOY_PRIVATE_KEY env var (funded wallet)');
    process.exit(1);
  }

  console.log(`\n=== Deploying to ${chain.name} (${chain.key}) ===\n`);

  // Check if already deployed
  if (!fs.existsSync(DEPLOYMENTS_DIR)) fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  const deployPath = path.join(DEPLOYMENTS_DIR, `${chain.key}.json`);
  if (fs.existsSync(deployPath)) {
    const existing = JSON.parse(fs.readFileSync(deployPath, 'utf8'));
    console.log(`Already deployed on ${chain.key}:`);
    console.log(`  Bridge: ${existing.contract_address}`);
    console.log(`  Hasher: ${existing.hasher_address}`);
    console.log('Delete the file to redeploy.');
    return;
  }

  // Compile with forge
  console.log('Compiling contracts...');
  const tmpDir = `/tmp/privacy-bridge-sol-${chain.key}`;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

  fs.copyFileSync(path.join(CONTRACTS_DIR, 'PrivacyBridge.sol'), path.join(tmpDir, 'src', 'PrivacyBridge.sol'));
  fs.copyFileSync(path.join(CONTRACTS_DIR, 'PoseidonT3.sol'), path.join(tmpDir, 'src', 'PoseidonT3.sol'));

  const poseidonSrc = path.join(__dirname, '..', 'node_modules', 'poseidon-solidity', 'PoseidonT3.sol');
  fs.mkdirSync(path.join(tmpDir, 'lib', 'poseidon-solidity'), { recursive: true });
  fs.copyFileSync(poseidonSrc, path.join(tmpDir, 'lib', 'poseidon-solidity', 'PoseidonT3.sol'));

  fs.writeFileSync(path.join(tmpDir, 'foundry.toml'), `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.20"
remappings = ["poseidon-solidity/=lib/poseidon-solidity/"]
`);

  execFileSync('forge', ['build'], { cwd: tmpDir, stdio: 'inherit', timeout: 60_000 });

  const bridgeArtifact = JSON.parse(fs.readFileSync(path.join(tmpDir, 'out', 'PrivacyBridge.sol', 'PrivacyBridge.json'), 'utf8'));
  const hasherArtifact = JSON.parse(fs.readFileSync(path.join(tmpDir, 'out', 'PoseidonT3.sol', 'PoseidonT3Wrapper.json'), 'utf8'));
  const libArtifact = JSON.parse(fs.readFileSync(path.join(tmpDir, 'out', 'PoseidonT3.sol', 'PoseidonT3.json'), 'utf8'));

  const provider = new ethers.JsonRpcProvider(chain.rpc, { chainId: chain.chainId, name: chain.name });
  const wallet = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ${chain.symbol}`);

  if (balance === 0n) {
    console.error(`Wallet has 0 ${chain.symbol}. Fund it first.`);
    process.exit(1);
  }

  // Deploy PoseidonT3 library
  console.log('Deploying PoseidonT3 library...');
  const libFactory = new ethers.ContractFactory(libArtifact.abi, libArtifact.bytecode.object, wallet);
  const libContract = await libFactory.deploy();
  await libContract.waitForDeployment();
  const libAddr = await libContract.getAddress();
  console.log(`PoseidonT3: ${libAddr}`);

  // Link + deploy PoseidonT3Wrapper
  let wrapperBytecode = hasherArtifact.bytecode.object;
  const libAddrClean = libAddr.toLowerCase().replace('0x', '');
  wrapperBytecode = wrapperBytecode.replace(/__\$[0-9a-fA-F]{34}\$__/g, libAddrClean);

  console.log('Deploying PoseidonT3Wrapper...');
  const hasherFactory = new ethers.ContractFactory(hasherArtifact.abi, wrapperBytecode, wallet);
  const hasherContract = await hasherFactory.deploy();
  await hasherContract.waitForDeployment();
  const hasherAddr = await hasherContract.getAddress();
  console.log(`PoseidonT3Wrapper: ${hasherAddr}`);

  // Deploy PrivacyBridge
  console.log('Deploying PrivacyBridge...');
  const bridgeFactory = new ethers.ContractFactory(bridgeArtifact.abi, bridgeArtifact.bytecode.object, wallet);
  const bridgeContract = await bridgeFactory.deploy(hasherAddr);
  await bridgeContract.waitForDeployment();
  const bridgeAddr = await bridgeContract.getAddress();
  console.log(`PrivacyBridge: ${bridgeAddr}`);

  // Save deployment
  const deployInfo = {
    chain: chain.key,
    network: chain.name,
    rpc: chain.rpc,
    chainId: chain.chainId,
    hasher_library: libAddr,
    hasher_address: hasherAddr,
    contract_address: bridgeAddr,
    deployer: wallet.address,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(deployPath, JSON.stringify(deployInfo, null, 2));
  console.log(`\nDeployment saved: ${deployPath}`);
  console.log('\nUpdate app/src/lib/chains.ts with:');
  console.log(`  bridgeAddress: '${bridgeAddr}',`);
}

main().catch(err => {
  console.error('Deploy failed:', err.message || err);
  process.exit(1);
});
