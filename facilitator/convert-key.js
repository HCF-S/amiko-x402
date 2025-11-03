const bs58 = require('bs58');

// Your hex private key (with or without 0x prefix)
const hexKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

// Remove 0x prefix if present
const cleanHex = hexKey.replace('0x', '');

// Convert hex to buffer
const buffer = Buffer.from(cleanHex, 'hex');

// Convert buffer to base58
const base58Key = bs58.encode(buffer);

console.log('Hex:', hexKey);
console.log('Base58:', base58Key);