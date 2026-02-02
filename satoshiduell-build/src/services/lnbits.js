// services/lnbits.js

import { LNBITS_CONFIG } from '../constants/config';

/**
 * Erstellt eine Lightning Invoice
 * @param {number} amount - Betrag in Satoshis
 * @param {string} memo - Beschreibung der Invoice
 * @returns {Promise<{payment_request: string, payment_hash: string}>}
 */
export const createInvoice = async (amount, memo = 'SatoshiDuell Deposit') => {
  const response = await fetch(`${LNBITS_CONFIG.url}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'X-Api-Key': LNBITS_CONFIG.invoiceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      out: false,
      amount: amount,
      memo: memo,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Invoice creation failed: ${error}`);
  }

  return await response.json();
};

/**
 * Prüft den Status einer Invoice
 * @param {string} paymentHash - Hash der zu prüfenden Invoice
 * @returns {Promise<{paid: boolean}>}
 */
export const checkInvoiceStatus = async (paymentHash) => {
  const response = await fetch(
    `${LNBITS_CONFIG.url}/api/v1/payments/${paymentHash}`,
    {
      headers: {
        'X-Api-Key': LNBITS_CONFIG.invoiceKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to check invoice status');
  }

  const data = await response.json();
  return { paid: data.paid || false };
};

/**
 * Erstellt einen LNURL-Withdraw Link
 * @param {number} amount - Betrag in Satoshis
 * @param {string} description - Beschreibung
 * @returns {Promise<{lnurl: string, id: string}>}
 */
export const createWithdrawLink = async (amount, description = 'SatoshiDuell Reward') => {
  // Diese Funktion wird über die serverless API aufgerufen
  // da der Admin Key nicht im Frontend liegen sollte
  const response = await fetch('/api/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount, description }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create withdraw link');
  }

  return await response.json();
};

/**
 * Prüft ob ein Withdraw Link eingelöst wurde
 * @param {string} withdrawId - ID des Withdraw Links
 * @returns {Promise<{used: boolean}>}
 */
export const checkWithdrawStatus = async (withdrawId) => {
  try {
    const response = await fetch(
      `${LNBITS_CONFIG.url}/withdraw/api/v1/links/${withdrawId}`,
      {
        headers: {
          'X-Api-Key': LNBITS_CONFIG.invoiceKey,
        },
      }
    );

    if (!response.ok) return { used: false };

    const data = await response.json();
    return { used: data.used || false };
  } catch (e) {
    console.error('Withdraw status check error:', e);
    return { used: false };
  }
};

/**
 * Erstellt eine Donation-Invoice
 * @param {number} amount - Betrag in Satoshis
 * @returns {Promise<{payment_request: string}>}
 */
export const createDonationInvoice = async (amount) => {
  const response = await fetch('/api/donate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create donation invoice');
  }

  return await response.json();
};

/**
 * Verarbeitet eine Refund-Anfrage
 * @param {string} duelId - ID des Duels
 * @param {number} amount - Zu erstattender Betrag
 * @returns {Promise<{lnurl: string}>}
 */
export const requestRefund = async (duelId, amount) => {
  const response = await fetch('/api/refund', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ duelId, amount }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Refund failed');
  }

  return await response.json();
};
