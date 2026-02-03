
// Hilfsfunktion: Lightning Address zu URL umwandeln
const parseLightningAddress = (address) => {
    // z.B. user@domain.com -> https://domain.com/.well-known/lnurlp/user
    const parts = address.split('@');
    if (parts.length !== 2) return null;
    return `https://${parts[1]}/.well-known/lnurlp/${parts[0]}`;
};

export const fetchInvoiceFromLnAddress = async (lnAddress, amountSats, comment = "Spende") => {
    try {
        // 1. LNURL-Pay URL auflösen
        const url = parseLightningAddress(lnAddress);
        if (!url) throw new Error("Ungültige Lightning Adresse");

        // 2. Ersten Request senden (Metadaten holen)
        const res1 = await fetch(url);
        const data1 = await res1.json();

        if (data1.status === 'ERROR') throw new Error(data1.reason);
        
        // Checken ob Betrag im Rahmen liegt (Min/Max sind in Millisats)
        const amountMillisats = amountSats * 1000;
        if (amountMillisats < data1.minSendable || amountMillisats > data1.maxSendable) {
            throw new Error(`Betrag ungültig. Min: ${data1.minSendable/1000}, Max: ${data1.maxSendable/1000}`);
        }

        // 3. Callback ausführen (Rechnung holen)
        // Die URL enthält einen Callback Parameter
        const callbackUrl = new URL(data1.callback);
        callbackUrl.searchParams.append('amount', amountMillisats);
        if (comment && data1.commentAllowed > 0) {
            callbackUrl.searchParams.append('comment', comment.substring(0, data1.commentAllowed));
        }

        const res2 = await fetch(callbackUrl.toString());
        const data2 = await res2.json();

        if (data2.status === 'ERROR') throw new Error(data2.reason);

        // Das ist der fertige QR-Code String (pr)
        return data2.pr; 

    } catch (error) {
        console.error("LNURL Fehler:", error);
        return null;
    }
};