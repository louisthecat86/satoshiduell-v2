// utils/crypto.js

/**
 * Hasht einen PIN mit SHA-256
 * @param {string} pin - Der zu hashende PIN
 * @returns {Promise<string>} Gehashter PIN als Hex-String
 */
export async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generiert eine zufällige ID
 * @param {number} length - Länge der ID
 * @returns {string} Zufällige ID
 */
export function generateId(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validiert einen PIN
 * @param {string} pin - Zu validierender PIN
 * @returns {boolean} Ob der PIN valid ist
 */
export function isValidPin(pin) {
  return pin && pin.length >= 4 && /^\d+$/.test(pin);
}
