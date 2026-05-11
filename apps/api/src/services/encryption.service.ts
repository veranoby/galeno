import { encrypt, decrypt } from '../utils/crypto.js';

/**
 * Encryption Service - Wrapper for encryption/decryption operations
 */
export class EncryptionService {
  /**
   * Encrypts a value
   * @param value - Value to encrypt
   * @returns Encrypted value
   */
  async encrypt(value: string): Promise<string> {
    return encrypt(value);
  }

  /**
   * Decrypts a value
   * @param encryptedValue - Value to decrypt
   * @returns Decrypted value
   */
  async decrypt(encryptedValue: string): Promise<string> {
    return decrypt(encryptedValue);
  }
}

export const encryptionService = new EncryptionService();
