#!/usr/bin/env node
/**
 * Privacy Bridge CLI — Lock on Flow EVM, Prove, Mint on Starknet
 *
 * Usage:
 *   node scripts/bridge.mjs lock   --amount 0.01 --contract 0x...
 *   node scripts/bridge.mjs prove  --secret <hex> --nullifier <hex> --amount <wei> --leaf-index <n> --contract 0x...
 *   node scripts/bridge.mjs mint   --proof <file> --recipient <starknet-addr>
 *
 * Environment:
 *   FLOW_PRIVATE_KEY     — Flow EVM wallet private key
 *   BRIDGE_CONTRACT      — PrivacyBridge contract address on Flow EVM
 *   STARKNET_PRIVATE_KEY — Starknet wallet private key
 *   STARKNET_ADDRESS     — Starknet account address
 */
import { ethers } from 'ethers';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeCommitment, computeNullifierHash, poseidonHash } from '../sdk/src/poseidon.mjs';
import { buildTreeFromCommitments } from '../sdk/src/merkle.mjs';
import { generateBridgeProof, generateGaragaCalldata } from '../sdk/src/prover.mjs';
import { getFlowProvider, lockTokens, fetchAllCommitments, ALLOWED_DENOMINATIONS } from '../sdk/src/flow.mjs';
import { createReceipt } from '../sdk/src/storacha.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function randomFieldElement() {
  // Random 31-byte value (fits in BN254 scalar field)
  const bytes = crypto.randomBytes(31);
  return BigInt('0x' + bytes.toString('hex'));
}

async function cmdLock(args) {
  const amount = args['--amount'];
  const contractAddr = args['--contract'] || process.env.BRIDGE_CONTRACT;
  const privateKey = process.env.FLOW_PRIVATE_KEY;

  if (!amount || !contractAddr || !privateKey) {
    console.error('Usage: bridge.mjs lock --amount <FLOW> --contract <addr>');
    console.error('Env: FLOW_PRIVATE_KEY');
    process.exit(1);
  }

  const provider = getFlowProvider();
  const wallet = new ethers.Wallet(privateKey, provider);
  const amountWei = ethers.parseEther(amount);

  // Fix 1: Validate denomination
  if (!ALLOWED_DENOMINATIONS.includes(amountWei)) {
    console.error(`Invalid denomination. Allowed: ${ALLOWED_DENOMINATIONS.map(d => ethers.formatEther(d)).join(', ')} FLOW`);
    process.exit(1);
  }

  // Generate secret and nullifier
  const secret = randomFieldElement();
  const nullifier = randomFieldElement();
  const commitment = computeCommitment(secret, nullifier, BigInt(amountWei));

  console.log('Locking on Flow EVM...');
  console.log(`  Amount: ${amount} FLOW`);
  console.log(`  Commitment: 0x${commitment.toString(16)}`);

  const result = await lockTokens(contractAddr, wallet, commitment, amountWei);

  console.log(`  TX: ${result.txHash}`);
  console.log(`  Leaf index: ${result.leafIndex}`);

  // Save note for later proof generation
  const note = {
    secret: '0x' + secret.toString(16),
    nullifier: '0x' + nullifier.toString(16),
    commitment: '0x' + commitment.toString(16),
    amount: amountWei.toString(),
    leafIndex: result.leafIndex,
    txHash: result.txHash,
    contract: contractAddr,
    chain: 'flow-evm-testnet',
    timestamp: new Date().toISOString(),
  };

  const notePath = path.join(__dirname, '..', `note-${result.leafIndex}.json`);
  fs.writeFileSync(notePath, JSON.stringify(note, null, 2));
  console.log(`\nNote saved: ${notePath}`);
  console.log('KEEP THIS FILE SAFE — you need it to claim on Starknet.');
}

async function cmdProve(args) {
  const noteFile = args['--note'];
  const recipient = args['--recipient'];

  if (!noteFile || !recipient) {
    console.error('Usage: bridge.mjs prove --note <note-file.json> --recipient <starknet-addr>');
    process.exit(1);
  }

  const note = JSON.parse(fs.readFileSync(noteFile, 'utf-8'));
  const contractAddr = note.contract || process.env.BRIDGE_CONTRACT;
  const provider = getFlowProvider();

  console.log('Fetching all commitments from Flow...');
  const commitmentsBigInt = await fetchAllCommitments(contractAddr, provider);
  console.log(`  Found ${commitmentsBigInt.length} deposits`);

  console.log('Building Merkle tree...');
  const tree = buildTreeFromCommitments(commitmentsBigInt);
  const proof = tree.getProof(note.leafIndex);

  console.log(`  Root: 0x${proof.root.toString(16).slice(0, 16)}...`);

  const wasmPath = path.join(__dirname, '..', 'circuits', 'target', 'bridge_js', 'bridge.wasm');
  const zkeyPath = path.join(__dirname, '..', 'circuits', 'target', 'bridge_final.zkey');

  if (!fs.existsSync(wasmPath)) {
    console.error('Circuit not compiled. Run: bash circuits/setup.sh');
    process.exit(1);
  }

  console.log('Generating Groth16 proof...');
  const witness = {
    root: proof.root,
    secret: BigInt(note.secret),
    nullifier: BigInt(note.nullifier),
    amount: BigInt(note.amount),
    recipient,
    pathElements: proof.pathElements,
    pathIndices: proof.pathIndices,
  };

  const result = await generateBridgeProof(witness, { wasmPath, zkeyPath });
  console.log('  Proof generated and verified locally.');

  const vkPath = path.join(__dirname, '..', 'circuits', 'target', 'verification_key.json');
  console.log('Generating garaga calldata...');
  const garagaCalldata = generateGaragaCalldata(result.proof, result.publicSignals, vkPath);
  console.log(`  Got ${garagaCalldata.length} felts`);

  const nullifierHash = result.nullifierHash;

  // Save proof for mint step
  const proofData = {
    proof: result.proof,
    publicSignals: result.publicSignals,
    garagaCalldata,
    nullifierHash: '0x' + nullifierHash.toString(16),
    recipient,
    amount: note.amount,
    root: '0x' + proof.root.toString(16),
  };

  const proofPath = path.join(__dirname, '..', `proof-${note.leafIndex}.json`);
  fs.writeFileSync(proofPath, JSON.stringify(proofData, null, 2));
  console.log(`\nProof saved: ${proofPath}`);

  // Create receipt for Storacha
  const receipt = createReceipt({
    commitment: BigInt(note.commitment),
    nullifierHash,
    amount: BigInt(note.amount),
  });
  const receiptPath = path.join(__dirname, '..', `receipt-${note.leafIndex}.json`);
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(`Receipt saved: ${receiptPath}`);
}

async function cmdMint(args) {
  const proofFile = args['--proof'];

  if (!proofFile) {
    console.error('Usage: bridge.mjs mint --proof <proof-file.json>');
    console.error('Env: STARKNET_PRIVATE_KEY, STARKNET_ADDRESS, STARKNET_RPC_URL');
    process.exit(1);
  }

  const proofData = JSON.parse(fs.readFileSync(proofFile, 'utf-8'));
  if (!proofData.garagaCalldata || proofData.garagaCalldata.length < 30) {
    console.error('Proof file missing garagaCalldata. Re-run: bridge.mjs prove');
    process.exit(1);
  }

  // Load deployment info
  const deployPath = path.join(__dirname, '..', 'deploy.json');
  if (!fs.existsSync(deployPath)) {
    console.error('deploy.json not found. Run: node scripts/deploy-devnet.mjs');
    process.exit(1);
  }
  const deploy = JSON.parse(fs.readFileSync(deployPath, 'utf-8'));

  const { RpcProvider, Account, Contract, CallData } = await import('starknet');

  const rpcUrl = process.env.STARKNET_RPC_URL || deploy.rpc || 'http://127.0.0.1:5051';
  const provider = new RpcProvider({ nodeUrl: rpcUrl });

  const accountAddr = process.env.STARKNET_ADDRESS || deploy.owner;
  const privateKey = process.env.STARKNET_PRIVATE_KEY || '0xb137668388dbe9acdfa3bc734cc2c469';
  const account = new Account(provider, accountAddr, privateKey);

  console.log('Submitting proof to Starknet bridge...');
  console.log(`  Bridge: ${deploy.bridge_address}`);
  console.log(`  Calldata felts: ${proofData.garagaCalldata.length}`);

  // max_fee_bps: accept up to 5% relayer fee (u256 as low/high)
  const tx = await account.execute({
    contractAddress: deploy.bridge_address,
    entrypoint: 'mint',
    calldata: CallData.compile({
      full_proof_with_hints: proofData.garagaCalldata,
      max_fee_bps: { low: '500', high: '0' },
    }),
  });

  console.log(`  TX hash: ${tx.transaction_hash}`);
  await provider.waitForTransaction(tx.transaction_hash);
  console.log('  Mint confirmed on Starknet.');
}

// Parse CLI args
const [,, command, ...rawArgs] = process.argv;
const args = {};
for (let i = 0; i < rawArgs.length; i += 2) {
  args[rawArgs[i]] = rawArgs[i + 1];
}

switch (command) {
  case 'lock':  await cmdLock(args); break;
  case 'prove': await cmdProve(args); break;
  case 'mint':  await cmdMint(args); break;
  default:
    console.log('Privacy Bridge CLI');
    console.log('');
    console.log('Commands:');
    console.log('  lock   Lock FLOW tokens on Flow EVM');
    console.log('  prove  Generate ZK proof from a deposit note');
    console.log('  mint   Submit proof to Starknet (WIP)');
    break;
}
