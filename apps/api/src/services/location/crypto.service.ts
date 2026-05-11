import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

/**
 * Crypto service for encrypting/decrypting sensitive location data
 */
class CryptoService {
  private readonly key: Buffer;

  constructor() {
    const encryptionKey = process.env.LOCATION_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('LOCATION_ENCRYPTION_KEY environment variable is required');
    }
    
    // Convert hex key to buffer
    if (encryptionKey.length !== KEY_LENGTH * 2) {
      throw new Error(`LOCATION_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} characters long (64 hex chars)`);
    }
    
    this.key = Buffer.from(encryptionKey,  'hex');
  }

  /**
   * Encrypts a string value using AES-256-GCM
   * @param value The string to encrypt
   * @returns Object containing encrypted data, iv, and authTag
   */
  encrypt(value: string): { encrypted: string; iv: string; authTag: string } {
    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM,  this.key,  iv);
      
      // Encrypt the value
      let encrypted = cipher.update(value,  'utf8',  'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag
      const authTag = cipher.getAuthTag().toString('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts an encrypted value using AES-256-GCM
   * @param encrypted The encrypted string
   * @param iv The initialization vector used during encryption
   * @param authTag The authentication tag
   * @returns The decrypted string
   */
  decrypt(encrypted: string,  iv: string,  authTag: string): string {
    try {
      // Convert hex strings back to buffers
      const ivBuffer = Buffer.from(iv,  'hex');
      const authTagBuffer = Buffer.from(authTag,  'hex');
      const encryptedBuffer = Buffer.from(encrypted,  'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM,  this.key,  ivBuffer);
      
      // Set the auth tag
      decipher.setAuthTag(authTagBuffer);
      
      // Decrypt the value
      let decrypted = decipher.update(encryptedBuffer,  undefined,  'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
}

export default new CryptoService();