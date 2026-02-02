// utils/validators.js

/**
 * Validiert einen Benutzernamen
 * @param {string} name - Zu validierender Name
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateUsername = (name) => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name darf nicht leer sein' };
  }

  if (name.length < 3) {
    return { valid: false, error: 'Name muss mindestens 3 Zeichen haben' };
  }

  if (name.length > 20) {
    return { valid: false, error: 'Name darf maximal 20 Zeichen haben' };
  }

  // Nur alphanumerische Zeichen und Unterstriche
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return { valid: false, error: 'Name darf nur Buchstaben, Zahlen und _ enthalten' };
  }

  return { valid: true };
};

/**
 * Validiert einen PIN
 * @param {string} pin - Zu validierender PIN
 * @returns {{ valid: boolean, error?: string }}
 */
export const validatePin = (pin) => {
  if (!pin || pin.trim().length === 0) {
    return { valid: false, error: 'PIN darf nicht leer sein' };
  }

  if (pin.length < 4) {
    return { valid: false, error: 'PIN muss mindestens 4 Zeichen haben' };
  }

  if (pin.length > 12) {
    return { valid: false, error: 'PIN darf maximal 12 Zeichen haben' };
  }

  if (!/^\d+$/.test(pin)) {
    return { valid: false, error: 'PIN darf nur Zahlen enthalten' };
  }

  return { valid: true };
};

/**
 * Validiert einen Satoshi-Betrag
 * @param {number|string} amount - Zu validierender Betrag
 * @param {number} min - Minimaler Betrag
 * @param {number} max - Maximaler Betrag
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateSatoshiAmount = (amount, min = 100, max = 1000000) => {
  const num = Number(amount);

  if (isNaN(num)) {
    return { valid: false, error: 'Betrag muss eine Zahl sein' };
  }

  if (num < min) {
    return { valid: false, error: `Mindestbetrag ist ${min} Sats` };
  }

  if (num > max) {
    return { valid: false, error: `Maximalbetrag ist ${max} Sats` };
  }

  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Betrag muss eine ganze Zahl sein' };
  }

  return { valid: true };
};

/**
 * Validiert eine Lightning Invoice
 * @param {string} invoice - Lightning Invoice String
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateLightningInvoice = (invoice) => {
  if (!invoice || invoice.trim().length === 0) {
    return { valid: false, error: 'Invoice darf nicht leer sein' };
  }

  if (!invoice.toLowerCase().startsWith('lnbc') && !invoice.toLowerCase().startsWith('lntb')) {
    return { valid: false, error: 'Ungültiges Invoice-Format' };
  }

  return { valid: true };
};

/**
 * Validiert eine Nostr Public Key
 * @param {string} pubkey - Hex oder npub Public Key
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateNostrPubkey = (pubkey) => {
  if (!pubkey || pubkey.trim().length === 0) {
    return { valid: false, error: 'Pubkey darf nicht leer sein' };
  }

  // Hex pubkey (64 Zeichen)
  if (/^[0-9a-f]{64}$/i.test(pubkey)) {
    return { valid: true };
  }

  // npub format
  if (pubkey.startsWith('npub1')) {
    return { valid: true };
  }

  return { valid: false, error: 'Ungültiger Nostr Pubkey' };
};
