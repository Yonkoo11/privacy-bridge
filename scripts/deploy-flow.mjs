#!/usr/bin/env node
/**
 * Deploy PoseidonT3Wrapper + PrivacyBridge to Flow EVM testnet using forge + ethers.
 *
 * Prerequisites:
 *   FLOW_PRIVATE_KEY env var (funded wallet on Flow EVM testnet)
 *   forge on PATH
 *
 * Flow EVM Testnet:
 *   RPC: https://testnet.evm.nodes.onflow.org
 *   Chain ID: 545
 *   Faucet: https://faucet.flow.com/fund-account (fund EVM address)
 */
import { ethers } from 'ethers';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.join(__dirname, '..', 'contracts', 'flow');

const FLOW_RPC = 'https://testnet.evm.nodes.onflow.org';
const CHAIN_ID = 545;

async function main() {
  const privateKey = process.env.FLOW_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Set FLOW_PRIVATE_KEY env var (funded wallet on Flow EVM testnet)');
    console.error('Faucet: https://faucet.flow.com/fund-account');
    process.exit(1);
  }

  // Compile with forge
  console.log('Compiling contracts...');
  const tmpDir = '/tmp/privacy-bridge-sol';
  execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}/src`);

  // Copy all sol files
  fs.copyFileSync(
    path.join(CONTRACTS_DIR, 'PrivacyBridge.sol'),
    path.join(tmpDir, 'src', 'PrivacyBridge.sol')
  );
  fs.copyFileSync(
    path.join(CONTRACTS_DIR, 'PoseidonT3.sol'),
    path.join(tmpDir, 'src', 'PoseidonT3.sol')
  );

  // Install poseidon-solidity dependency for forge
  const poseidonSrc = path.join(__dirname, '..', 'node_modules', 'poseidon-solidity', 'PoseidonT3.sol');
  execSync(`mkdir -p ${tmpDir}/lib/poseidon-solidity`);
  fs.copyFileSync(poseidonSrc, path.join(tmpDir, 'lib', 'poseidon-solidity', 'PoseidonT3.sol'));

  // Foundry config with remappings
  fs.writeFileSync(path.join(tmpDir, 'foundry.toml'), `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.20"
remappings = ["poseidon-solidity/=lib/poseidon-solidity/"]
`);

  execSync(`cd ${tmpDir} && forge build`, { stdio: 'inherit', timeout: 60_000 });

  const bridgeArtifact = JSON.parse(
    fs.readFileSync(path.join(tmpDir, 'out', 'PrivacyBridge.sol', 'PrivacyBridge.json'), 'utf8')
  );
  const hasherArtifact = JSON.parse(
    fs.readFileSync(path.join(tmpDir, 'out', 'PoseidonT3.sol', 'PoseidonT3Wrapper.json'), 'utf8')
  );

  const provider = new ethers.JsonRpcProvider(FLOW_RPC, { chainId: CHAIN_ID, name: 'Flow EVM Testnet' });
  const wallet = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} FLOW`);

  if (balance === 0n) {
    console.error('Wallet has 0 FLOW. Fund it at https://faucet.flow.com/fund-account');
    process.exit(1);
  }

  // Step 1: Deploy PoseidonT3 library
  const libArtifact = JSON.parse(
    fs.readFileSync(path.join(tmpDir, 'out', 'PoseidonT3.sol', 'PoseidonT3.json'), 'utf8')
  );
  console.log('Deploying PoseidonT3 library...');
  const libFactory = new ethers.ContractFactory(libArtifact.abi, libArtifact.bytecode.object, wallet);
  const libContract = await libFactory.deploy();
  await libContract.waitForDeployment();
  const libAddr = await libContract.getAddress();
  console.log(`PoseidonT3 library deployed: ${libAddr}`);

  // Step 2: Link PoseidonT3Wrapper bytecode with library address
  // Replace the placeholder __$...$__ with the actual library address
  let wrapperBytecode = hasherArtifact.bytecode.object;
  const libAddrClean = libAddr.toLowerCase().replace('0x', '');
  // The placeholder is 40 hex chars (20 bytes) starting with __$
  wrapperBytecode = wrapperBytecode.replace(/__\$[0-9a-fA-F]{34}\$__/g, libAddrClean);

  console.log('Deploying PoseidonT3Wrapper (linked)...');
  const hasherFactory = new ethers.ContractFactory(hasherArtifact.abi, wrapperBytecode, wallet);
  const hasherContract = await hasherFactory.deploy();
  await hasherContract.waitForDeployment();
  const hasherAddr = await hasherContract.getAddress();
  console.log(`PoseidonT3Wrapper deployed: ${hasherAddr}`);

  // Deploy PrivacyBridge with hasher address
  console.log('Deploying PrivacyBridge...');
  const bridgeFactory = new ethers.ContractFactory(bridgeArtifact.abi, bridgeArtifact.bytecode.object, wallet);
  const bridgeContract = await bridgeFactory.deploy(hasherAddr);
  await bridgeContract.waitForDeployment();
  const bridgeAddr = await bridgeContract.getAddress();
  console.log(`PrivacyBridge deployed: ${bridgeAddr}`);

  // Save deployment
  const deployPath = path.join(__dirname, '..', 'deploy-flow.json');
  const deployInfo = {
    network: 'flow-evm-testnet',
    rpc: FLOW_RPC,
    chainId: CHAIN_ID,
    hasher_address: hasherAddr,
    contract_address: bridgeAddr,
    deployer: wallet.address,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(deployPath, JSON.stringify(deployInfo, null, 2));
  console.log(`Deployment saved: ${deployPath}`);
}

main().catch(err => {
  console.error('Deploy failed:', err.message || err);
  process.exit(1);
});
