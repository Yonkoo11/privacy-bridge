#!/usr/bin/env node
/**
 * Test note encryption/decryption using the same Web Crypto API the browser uses.
 * Node 20+ has crypto.subtle — no excuses.
 */
import { webcrypto } from 'node:crypto';

// Polyfill globalThis.crypto for Node (browser has this natively)
if (!globalThis.crypto?.subtle) {
  globalThis.crypto = webcrypto;
}

// Re-implement the encryption module logic inline to test it identically
// (can't import .ts directly, so replicate the exact algorithm)

async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptNote(note, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(note));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const packed = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return btoa(String.fromCharCode(...packed));
}

async function decryptNote(encrypted, password) {
  const packed = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  const salt = packed.slice(0, 16);
  const iv = packed.slice(16, 28);
  const ciphertext = packed.slice(28);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

// ---- Tests ----

let pass = 0;
let fail = 0;

function check(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    pass++;
  } else {
    console.log(`  FAIL: ${msg}`);
    fail++;
  }
}

async function main() {
  console.log('=== Note Encryption/Decryption Tests ===\n');

  const note = {
    secret: '123456789012345678901234567890',
    nullifier: '987654321098765432109876543210',
    commitment: '111222333444555666777888999000',
    nullifierHash: '000999888777666555444333222111',
    amount: '1000000000000000',
    timestamp: 1711234567890,
  };

  // Test 1: Encrypt and decrypt with correct password
  console.log('Test 1: Round-trip with correct password');
  const encrypted = await encryptNote(note, 'my-strong-password-123');
  check(typeof encrypted === 'string', 'encrypt returns a string');
  check(encrypted.length > 50, `ciphertext is non-trivial (${encrypted.length} chars)`);

  const decrypted = await decryptNote(encrypted, 'my-strong-password-123');
  check(decrypted.secret === note.secret, 'secret matches');
  check(decrypted.nullifier === note.nullifier, 'nullifier matches');
  check(decrypted.commitment === note.commitment, 'commitment matches');
  check(decrypted.nullifierHash === note.nullifierHash, 'nullifierHash matches');
  check(decrypted.amount === note.amount, 'amount matches');
  check(decrypted.timestamp === note.timestamp, 'timestamp matches');

  // Test 2: Wrong password fails
  console.log('\nTest 2: Wrong password fails');
  try {
    await decryptNote(encrypted, 'wrong-password');
    check(false, 'should have thrown on wrong password');
  } catch (err) {
    check(true, `wrong password rejected: ${err.message.slice(0, 60)}`);
  }

  // Test 3: Different encryptions produce different ciphertext (random salt/iv)
  console.log('\nTest 3: Randomized encryption');
  const encrypted2 = await encryptNote(note, 'my-strong-password-123');
  check(encrypted !== encrypted2, 'same note + password gives different ciphertext (random salt/iv)');

  // But both decrypt correctly
  const decrypted2 = await decryptNote(encrypted2, 'my-strong-password-123');
  check(decrypted2.secret === note.secret, 'second ciphertext also decrypts correctly');

  // Test 4: Empty password still works (user's choice)
  console.log('\nTest 4: Empty password');
  const encrypted3 = await encryptNote(note, '');
  const decrypted3 = await decryptNote(encrypted3, '');
  check(decrypted3.secret === note.secret, 'empty password round-trip works');

  // Test 5: Large note (edge case for AES-GCM)
  console.log('\nTest 5: Large secret values (full-size field elements)');
  const bigNote = {
    secret: '2188824287183927522224640574525727508854836440041603434369820418657516807170',
    nullifier: '7296831411054634284494899302818205683588673399917978294938246369253081118348',
    commitment: '18569430475105882587588266137607568536966745962756824967863025649567413107741',
    nullifierHash: '3875469582305982650592985492834958234523948572349587234958723495872349582',
    amount: '100000000000000000',
    timestamp: Date.now(),
  };
  const bigEncrypted = await encryptNote(bigNote, 'test123');
  const bigDecrypted = await decryptNote(bigEncrypted, 'test123');
  check(bigDecrypted.secret === bigNote.secret, 'large field element secret survives round-trip');
  check(bigDecrypted.nullifier === bigNote.nullifier, 'large field element nullifier survives round-trip');

  // Test 6: Tampered ciphertext
  console.log('\nTest 6: Tampered ciphertext fails');
  const chars = encrypted.split('');
  // Flip a char in the middle of the ciphertext (past salt+iv)
  const idx = Math.floor(chars.length / 2);
  chars[idx] = chars[idx] === 'A' ? 'B' : 'A';
  const tampered = chars.join('');
  try {
    await decryptNote(tampered, 'my-strong-password-123');
    check(false, 'should have thrown on tampered ciphertext');
  } catch {
    check(true, 'tampered ciphertext rejected (GCM auth tag)');
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
