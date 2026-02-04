// services/nostr.js

import { nip19 } from 'nostr-tools';
import { NOSTR_CONFIG } from '../constants/config';

/**
 * Konvertiert einen npub zu einem hex pubkey
 * @param {string} npub - npub String
 * @returns {string} Hex pubkey
 */
export const npubToHex = (npub) => {
  try {
    const { data } = nip19.decode(npub);
    return data;
  } catch (e) {
    throw new Error('Invalid npub format');
  }
};

/**
 * Konvertiert einen hex pubkey zu npub
 * @param {string} hex - Hex pubkey
 * @returns {string} npub String
 */
export const hexToNpub = (hex) => {
  try {
    return nip19.npubEncode(hex);
  } catch (e) {
    throw new Error('Invalid hex pubkey');
  }
};

/**
 * Lädt Profil-Informationen von einem Nostr-Relay
 * @param {string} pubkey - Hex pubkey
 * @returns {Promise<{picture?: string, name?: string, about?: string}>}
 */
export const fetchNostrProfile = async (pubkey) => {
  try {
    const response = await fetch(`https://api.nostr.band/v0/profile/${pubkey}`);
    const data = await response.json();
    return data?.profile || {};
  } catch (e) {
    console.error('Nostr profile fetch error:', e);
    return {};
  }
};

/**
 * Verbindet mit Nostr Extension (NIP-07)
 * @returns {Promise<string>} Hex pubkey
 */
export const connectNostrExtension = async () => {
  if (!window.nostr) {
    throw new Error('Nostr Extension nicht gefunden. Bitte installiere eine Extension wie Alby oder nos2x.');
  }

  try {
    const pubkey = await window.nostr.getPublicKey();
    return pubkey;
  } catch (e) {
    throw new Error('Zugriff auf Nostr Extension verweigert');
  }
};

/**
 * Erstellt einen Amber Login-Link
 * @param {string} callbackUrl - URL für Callback nach Login
 * @returns {string} Amber Login URL
 */
export const createAmberLoginUrl = (callbackUrl) => {
  const intentUrl = `intent:#Intent;scheme=nostrsigner;S.compressionType=none;S.returnType=public_key;S.type=get_public_key;S.callbackUrl=${encodeURIComponent(callbackUrl)};end`;
  return intentUrl;
};

/**
 * Signiert eine Nostr-Nachricht mit der Extension
 * @param {Object} event - Nostr Event
 * @returns {Promise<Object>} Signiertes Event
 */
export const signNostrEvent = async (event) => {
  if (!window.nostr) {
    throw new Error('Nostr Extension nicht gefunden');
  }

  try {
    return await window.nostr.signEvent(event);
  } catch (e) {
    throw new Error('Event signierung fehlgeschlagen');
  }
};

/**
 * Veröffentlicht ein Nostr-Event
 * @param {Object} signedEvent - Signiertes Nostr Event
 * @returns {Promise<void>}
 */
export const publishNostrEvent = async (signedEvent) => {
  const relays = NOSTR_CONFIG.relays;
  const errors = [];

  for (const relay of relays) {
    try {
      const ws = new WebSocket(relay);
      
      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          ws.send(JSON.stringify(['EVENT', signedEvent]));
          resolve();
        };
        
        ws.onerror = (error) => {
          reject(error);
        };

        // Timeout nach 5 Sekunden
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      ws.close();
    } catch (e) {
      errors.push(`${relay}: ${e.message}`);
    }
  }

  if (errors.length === relays.length) {
    throw new Error('Konnte zu keinem Relay verbinden');
  }
};

/**
 * Erstellt ein Nostr-Event für Duel-Ergebnis
 * @param {Object} duelData - Duel-Informationen
 * @param {string} userPubkey - Pubkey des Benutzers
 * @returns {Object} Nostr Event
 */
export const createDuelResultEvent = (duelData, userPubkey) => {
  const { creator, challenger, creator_score, challenger_score, amount } = duelData;
  
  const winner = creator_score > challenger_score ? creator : challenger;
  const isWinner = winner === (duelData.creator === userPubkey ? creator : challenger);

  const content = isWinner
    ? `⚡ Ich habe gerade ein SatoshiDuell gewonnen! 🏆\n\n${creator} vs ${challenger}\n${creator_score} : ${challenger_score}\n\nGewinn: ${amount * 2} Sats\n\n#Bitcoin #Lightning #SatoshiDuell`
    : `⚡ Habe gerade ein SatoshiDuell gespielt!\n\n${creator} vs ${challenger}\n${creator_score} : ${challenger_score}\n\n#Bitcoin #Lightning #SatoshiDuell`;

  return {
    kind: 1, // Text note
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', 'bitcoin'],
      ['t', 'lightning'],
      ['t', 'satoshiduell'],
    ],
    content,
    pubkey: userPubkey,
  };
};

/**
 * Teilt ein Duel-Ergebnis auf Nostr
 * @param {Object} duelData - Duel-Informationen
 * @returns {Promise<void>}
 */
export const shareDuelOnNostr = async (duelData) => {
  const pubkey = await connectNostrExtension();
  const event = createDuelResultEvent(duelData, pubkey);
  const signedEvent = await signNostrEvent(event);
  await publishNostrEvent(signedEvent);
};
