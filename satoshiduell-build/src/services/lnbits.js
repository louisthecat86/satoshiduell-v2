// src/services/lnbits.js

import { supabase } from './supabase';

const LNBITS_URL = import.meta.env.VITE_LNBITS_URL;
const INVOICE_KEY = import.meta.env.VITE_LNBITS_INVOICE_KEY; 

// 1. INVOICE ERSTELLEN
export const createInvoice = async (amount, memo) => {
  try {
    const response = await fetch(`${LNBITS_URL}/api/v1/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': INVOICE_KEY },
      body: JSON.stringify({ out: false, amount: amount, memo: memo || "SatoshiDuell", expiry: 600, unit: "sat" }),
    });
    if (!response.ok) throw new Error('LNbits Create Invoice Failed');
    return await response.json(); 
  } catch (error) {
    console.error("Invoice Fehler:", error);
    return null;
  }
};

// 2. PAYMENT STATUS PRÜFEN
export const checkPaymentStatus = async (paymentHash) => {
  try {
    const response = await fetch(`${LNBITS_URL}/api/v1/payments/${paymentHash}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': INVOICE_KEY },
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.paid;
  } catch (error) { return false; }
};

// 3. WITHDRAW LINK ERSTELLEN
export const createWithdrawLink = async (amount, gameId) => {
  const sats = Math.floor(amount);
  console.log(`💸 Erzeuge Withdraw Link über ${sats} Sats...`);

  try {
    const { data, error } = await supabase.functions.invoke('create-withdraw-link', {
      body: { amount: sats, gameId }
    });

    if (error || !data?.lnurl) {
      const msg = error?.message || data?.error || 'Konnte Auszahlung nicht erstellen';
      throw new Error(msg);
    }

    return { lnurl: data.lnurl, id: data.id };

  } catch (error) {
    console.error("Withdraw Exception:", error);
    return null;
  }
};

// 4. PRÜFEN OB ABGEHOBEN WURDE (NEU)
export const getWithdrawLinkStatus = async (linkId) => {
  try {
    const { data, error } = await supabase.functions.invoke('create-withdraw-link', {
      body: { linkId }
    });

    if (error || !data) return false;
    return Boolean(data.used);
  } catch (error) {
    return false;
  }
};