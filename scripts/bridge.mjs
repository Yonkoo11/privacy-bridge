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
import { generateBridgeProof, serializeProofToFelts } from '../sdk/src/prover.mjs';
import { getFlowProvider, lockTokens, fetchAllCommitments } from '../sdk/src/flow.mjs';
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

  const felts = serializeProofToFelts(result.proof, result.publicSignals);
  const nullifierHash = result.nullifierHash;

  // Save proof for mint step
  const proofData = {
    proof: result.proof,
    publicSignals: result.publicSignals,
    felts: felts.map(String),
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
  console.log('Starknet mint: requires devnet running + Cairo contract deployed.');
  console.log('See contracts/starknet/ for the Cairo contract.');
  console.log('This step will be implemented after garaga verifier integration.');
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
