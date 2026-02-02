// src/services/lnbits.js

const LNBITS_URL = import.meta.env.VITE_LNBITS_URL;
const INVOICE_KEY = import.meta.env.VITE_LNBITS_INVOICE_KEY; 
const ADMIN_KEY = import.meta.env.VITE_LNBITS_ADMIN_KEY;     

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
    const response = await fetch(`${LNBITS_URL}/withdraw/api/v1/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': ADMIN_KEY },
      body: JSON.stringify({
        title: `SatoshiDuell Win #${gameId}`, 
        min_withdrawable: sats,     
        max_withdrawable: sats,     
        uses: 1,                   
        wait_time: 1,              
        is_unique: false // <--- FIX: False, damit Wallets nicht meckern
      }),
    });

    if (!response.ok) throw new Error('Konnte Auszahlung nicht erstellen');

    const data = await response.json();
    // Wir geben jetzt ein OBJEKT zurück mit id und lnurl
    return { lnurl: data.lnurl, id: data.id }; 

  } catch (error) {
    console.error("Withdraw Exception:", error);
    return null;
  }
};

// 4. PRÜFEN OB ABGEHOBEN WURDE (NEU)
export const getWithdrawLinkStatus = async (linkId) => {
  try {
    const response = await fetch(`${LNBITS_URL}/withdraw/api/v1/links/${linkId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': ADMIN_KEY },
    });
    
    if (!response.ok) return false;
    const data = await response.json();
    
    // Wenn 'used' >= 1 ist, wurde das Geld abgehoben
    return data.used >= 1;
  } catch (error) {
    return false;
  }
};