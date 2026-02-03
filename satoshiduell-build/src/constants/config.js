// constants/config.js

export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_KEY,
};

export const LNBITS_CONFIG = {
  url: import.meta.env.VITE_LNBITS_URL,
  invoiceKey: import.meta.env.VITE_INVOICE_KEY,
};

export const APP_CONFIG = {
  mainDomain: 'https://satoshiduell.vercel.app',
  refundTimeoutMs: 3 * 24 * 60 * 60 * 1000, // 3 Tage
  maxQuizTime: 15, // Sekunden
  questionsPerGame: 5,
  maxAvatarSize: 2 * 1024 * 1024, // 2MB
};

export const NOSTR_CONFIG = {
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
  ],
};

export const SOUND_FILES = {
  click: '/click.mp3',
  correct: '/correct.mp3',
  // Einige Uploads nutzten 'Wrong.mp3' mit Großbuchstaben – unterstütze beides via existierender Datei
  wrong: '/Wrong.mp3',
  tick: '/tick.mp3',
};

export const VIBRATION_PATTERNS = {
  click: 10,
  correct: [50, 50, 50],
  wrong: 200,
  win: [100, 50, 100, 50, 200],
};
