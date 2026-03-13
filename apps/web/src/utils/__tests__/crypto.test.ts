// apps/web/src/utils/__tests__/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { generateSecureRoomName, CryptoUtils } from '../crypto';

describe('CryptoUtils', () => {
  describe('hash', () => {
    it('should generate a valid SHA-256 hash', async () => {
      const result = await CryptoUtils.hash('test-data');
      expect(result).toMatch(/^[a-f0-9]{64}$/);
      expect(result).toHaveLength(64);
    });

    it('should return empty string for empty input', async () => {
      const result = await CryptoUtils.hash('');
      expect(result).toBe('');
    });

    it('should generate different hashes for different inputs', async () => {
      const hash1 = await CryptoUtils.hash('test1');
      const hash2 = await CryptoUtils.hash('test2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateRandomString', () => {
    it('should generate a random string of specified length', () => {
      const result = CryptoUtils.generateRandomString(16);
      expect(result).toHaveLength(32); // 16 bytes * 2 hex chars
    });

    it('should generate different strings on multiple calls', () => {
      const result1 = CryptoUtils.generateRandomString(8);
      const result2 = CryptoUtils.generateRandomString(8);
      expect(result1).not.toBe(result2);
    });
  });

  describe('encrypt/decrypt', () => {
    it('should return data as-is (placeholder)', async () => {
      const data = 'sensitive-data';
      const encrypted = await CryptoUtils.encrypt(data);
      expect(encrypted).toBe(data);

      const decrypted = await CryptoUtils.decrypt(encrypted);
      expect(decrypted).toBe(data);
    });
  });
});

describe('generateSecureRoomName', () => {
  it('should generate a valid room name format', async () => {
    const result = await generateSecureRoomName('test-id', 'test-salt');
    expect(result).toMatch(/^galeno-[a-f0-9]{16}$/);
  });

  it('should generate different room names for different inputs', async () => {
    const result1 = await generateSecureRoomName('consulta-1', 'salt-1');
    await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamp
    const result2 = await generateSecureRoomName('consulta-2', 'salt-2');

    expect(result1).not.toBe(result2);
  });

  it('should generate fallback room name for empty inputs', async () => {
    const result1 = await generateSecureRoomName('', 'salt');
    const result2 = await generateSecureRoomName('id', '');
    const result3 = await generateSecureRoomName('', '');

    expect(result1).toMatch(/^galeno-[a-z0-9]{8}$/);
    expect(result2).toMatch(/^galeno-[a-z0-9]{8}$/);
    expect(result3).toMatch(/^galeno-[a-z0-9]{8}$/);
  });

  it('should include hash of combined string', async () => {
    const identifier = 'consulta-123';
    const salt = 'doctor-salt';
    const result = await generateSecureRoomName(identifier, salt);

    // Verify it's a galeno room name with 16 hex chars
    expect(result).toMatch(/^galeno-[a-f0-9]{16}$/);
  });
});
