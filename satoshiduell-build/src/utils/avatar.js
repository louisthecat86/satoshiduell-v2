// utils/avatar.js

/**
 * Lädt das Profilbild eines Nostr-Benutzers
 * @param {string} pubkey - Nostr Public Key
 * @returns {Promise<string|null>} URL des Profilbilds oder null
 */
export const fetchNostrImage = async (pubkey) => {
  if (!pubkey) return null;
  try {
    const res = await fetch(`https://api.nostr.band/v0/profile/${pubkey}`);
    const data = await res.json();
    return data?.profile?.picture || null;
  } catch (e) {
    console.error("Nostr img error", e);
    return null;
  }
};

/**
 * Generiert einen CryptoPunk-Avatar basierend auf einem Namen
 * Wandelt den Namen deterministisch in eine Punk-Nummer (0-9999) um
 * @param {string} name - Name für den Avatar-Seed
 * @returns {string} URL des CryptoPunk-Bildes
 */
export const getCryptoPunkAvatar = (name) => {
  if (!name) return 'https://www.larvalabs.com/public/images/cryptopunks/punk0.png';
  
  // Einfacher Hash: Jeden Buchstaben in eine Zahl umwandeln
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Absoluten Wert nehmen und auf 0-9999 mappen
  const punkNumber = Math.abs(hash) % 10000;
  
  return `https://www.larvalabs.com/public/images/cryptopunks/punk${punkNumber}.png`;
};

/**
 * Generiert einen Roboter-Avatar basierend auf einem Namen
 * @param {string} name - Name für den Avatar-Seed
 * @returns {string} URL des generierten Avatars
 */
export const getRobotAvatar = (name) => {
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${name}`;
};

/**
 * Validiert eine Bild-Datei für Avatar-Upload
 * @param {File} file - Die zu validierende Datei
 * @param {number} maxSize - Maximale Dateigröße in Bytes
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateAvatarFile = (file, maxSize = 2 * 1024 * 1024) => {
  if (!file) {
    return { valid: false, error: 'Keine Datei ausgewählt' };
  }

  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Datei muss ein Bild sein' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: `Datei zu groß (max ${maxSize / 1024 / 1024}MB)` };
  }

  return { valid: true };
};

/**
 * Generiert einen eindeutigen Dateinamen für Avatar-Upload
 * @param {string} username - Benutzername
 * @param {string} originalFilename - Originaler Dateiname
 * @returns {string} Generierter Dateiname
 */
export const generateAvatarFilename = (username, originalFilename) => {
  const cleanName = username.replace(/[^a-zA-Z0-9]/g, '');
  const fileExt = originalFilename.split('.').pop();
  return `${cleanName}_${Date.now()}.${fileExt}`;
};
