import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../../src/utils/crypto.js';

describe('AES-256-GCM Token Encryption & Integrity', () => {
  it('Should encrypt and decrypt Facebook tokens accurately', () => {
    const rawToken = 'EAABwb1234567890abcdefghijklmnopqrstuvwxyz_SECRET_META_PAGE_TOKEN';
    const encrypted = encryptToken(rawToken);

    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:cipher

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('Should throw an error if encrypted token is tampered with (Auth Tag verification)', () => {
    const rawToken = 'sensitive_access_token';
    const encrypted = encryptToken(rawToken);
    const parts = encrypted.split(':');

    // Tamper with the ciphertext
    const tamperedCipher = parts[2].slice(0, -2) + 'ff';
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    expect(() => decryptToken(tamperedPayload)).toThrow();
  });
});

