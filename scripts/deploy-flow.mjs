#!/usr/bin/env node
/**
 * Deploy PrivacyBridge.sol to Flow EVM testnet using forge + ethers.
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
const SOL_PATH = path.join(__dirname, '..', 'contracts', 'flow', 'PrivacyBridge.sol');

const FLOW_RPC = 'https://testnet.evm.nodes.onflow.org';
const CHAIN_ID = 545;

async function main() {
  const privateKey = process.env.FLOW_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Set FLOW_PRIVATE_KEY env var (funded wallet on Flow EVM testnet)');
    console.error('Faucet: https://faucet.flow.com/fund-account');
    process.exit(1);
  }

  // Compile with forge (solc)
  console.log('Compiling PrivacyBridge.sol...');
  const tmpDir = '/tmp/privacy-bridge-sol';
  execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir}/src`);
  fs.copyFileSync(SOL_PATH, path.join(tmpDir, 'src', 'PrivacyBridge.sol'));

  // Minimal foundry.toml
  fs.writeFileSync(path.join(tmpDir, 'foundry.toml'), `[profile.default]
src = "src"
out = "out"
solc = "0.8.20"
`);

  execSync(`cd ${tmpDir} && forge build`, { stdio: 'inherit', timeout: 60_000 });

  const artifact = JSON.parse(
    fs.readFileSync(path.join(tmpDir, 'out', 'PrivacyBridge.sol', 'PrivacyBridge.json'), 'utf8')
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

  console.log('Deploying PrivacyBridge...');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`PrivacyBridge deployed: ${address}`);

  // Save deployment
  const deployPath = path.join(__dirname, '..', 'deploy-flow.json');
  const deployInfo = {
    network: 'flow-evm-testnet',
    rpc: FLOW_RPC,
    chainId: CHAIN_ID,
    contract_address: address,
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
