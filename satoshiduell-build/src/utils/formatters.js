// utils/formatters.js

/**
 * Formatiert einen Namen für die Anzeige
 * @param {string} name - Der zu formatierende Name
 * @returns {string} Formatierter Name in Großbuchstaben
 */
export const formatName = (name) => {
  if (!name) return '';
  if (name.length <= 14) return name.toUpperCase();
  return (name.substring(0, 6) + '...' + name.substring(name.length - 4)).toUpperCase();
};

/**
 * Formatiert Zeit in mm:ss Format
 * @param {number} seconds - Zeit in Sekunden
 * @returns {string} Formatierte Zeit
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Formatiert Satoshi-Beträge
 * @param {number} sats - Satoshi-Betrag
 * @returns {string} Formatierter Betrag mit Tausender-Trennzeichen
 */
export const formatSats = (sats) => {
  return new Intl.NumberFormat('de-DE').format(sats);
};

/**
 * Formatiert einen Zeitstempel als relatives Datum
 * @param {string} timestamp - ISO Zeitstempel
 * @returns {string} Relatives Datum (z.B. "vor 2 Stunden")
 */
export const formatRelativeTime = (timestamp) => {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `vor ${minutes} Min`;
  if (hours < 24) return `vor ${hours} Std`;
  return `vor ${days} Tag${days !== 1 ? 'en' : ''}`;
};

/**
 * Kürzt eine Lightning-Adresse für die Anzeige
 * @param {string} address - Lightning-Adresse
 * @returns {string} Gekürzte Adresse
 */
export const shortenLightningAddress = (address) => {
  if (!address || address.length < 20) return address;
  return `${address.substring(0, 10)}...${address.substring(address.length - 10)}`;
};
