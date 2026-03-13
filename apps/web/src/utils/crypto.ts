// apps/web/src/utils/crypto.ts
/**
 * Client-side encryption utilities for sensitive data
 * Note: In a real application, sensitive encryption should primarily happen on the server
 * This is provided for demonstration purposes
 */

/**
 * Simple client-side encryption placeholder
 * In production, sensitive encryption should happen on the server
 */
export class CryptoUtils {
  /**
   * Placeholder for encrypting data
   * In a real app, this would use a proper encryption algorithm
   * For now, we'll just return the data as-is since encryption happens on the server
   */
  static async encrypt(data: string): Promise<string> {
    // In a real application, you might use the Web Crypto API for client-side encryption
    // But for sensitive data like location, server-side encryption is preferred
    return data;
  }

  /**
   * Placeholder for decrypting data
   */
  static async decrypt(encryptedData: string): Promise<string> {
    // In a real application, you might use the Web Crypto API for client-side decryption
    // But for sensitive data like location, server-side encryption is preferred
    return encryptedData;
  }

  /**
   * Hashes data using SHA-256
   */
  static async hash(data: string): Promise<string> {
    if (!data) return '';

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generates a random string of specified length
   */
  static generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Generate a secure room name using HMAC-like hashing
 * @param identifier - Unique identifier (e.g., citaId or consultaId)
 * @param salt - Salt for added security
 * @returns Secure room name hash
 */
export async function generateSecureRoomName(identifier: string, salt: string): Promise<string> {
  if (!identifier || !salt) {
    return `galeno-${Math.random().toString(36).substring(2, 10)}`;
  }

  // Create a combined string and hash it
  const combined = `${salt}-${identifier}-${Date.now()}`;
  const hash = await CryptoUtils.hash(combined);

  // Return first 16 chars of hash for room name
  return `galeno-${hash.substring(0, 16)}`;
}