# Tournament System - Vollständige Logik & Payment Flow

## 🎯 Übersicht

Das Turniersystem ermöglicht es befähigten Usern, eigene Turniere zu erstellen, Preispools zu hinterlegen und Teilnehmer Entry Fees zahlen zu lassen.

## 💰 Payment-Modelle

### Option A: Creator-finanziert (EMPFOHLEN) ⭐

**Konzept:**
- Creator zahlt kompletten Prize Pool im Voraus
- Entry Fees werden separat gesammelt
- Am Ende: Winner → Prize Pool, Creator → Entry Fees zurück

**Beispiel:**
```
Creator zahlt:     500.000 Sats (Prize Pool)
Entry Fee:         1.000 Sats pro Spieler
16 Spieler:        16.000 Sats gesammelt

Nach Turnier:
→ Winner:          500.000 Sats
→ Creator:         16.000 Sats (Einnahmen)
```

**Vorteil:** Creator hat Anreiz Turnier zu organisieren (Entry Fee Einnahmen)

---

### Option B: Entry Fees = Prize Pool

**Konzept:**
- Creator zahlt nichts
- Alle Entry Fees bilden den Prize Pool
- Winner bekommt alles

**Beispiel:**
```
Creator zahlt:     0 Sats
Entry Fee:         10.000 Sats pro Spieler
16 Spieler:        160.000 Sats

Nach Turnier:
→ Winner:          160.000 Sats
→ Creator:         0 Sats
```

**Vorteil:** Kein Risiko für Creator

---

### Option C: Hybrid

**Konzept:**
- Creator zahlt Basis-Prize
- Entry Fees werden zum Prize addiert
- Winner bekommt alles

**Beispiel:**
```
Creator zahlt:     100.000 Sats (Basis)
Entry Fee:         1.000 Sats pro Spieler
16 Spieler:        16.000 Sats

Total Prize Pool:  116.000 Sats

Nach Turnier:
→ Winner:          116.000 Sats
→ Creator:         0 Sats
```

---

## 📋 Workflow Schritt-für-Schritt

### PHASE 1: Turnier-Erstellung

**1.1 Creator füllt Formular aus**
- Name, Beschreibung
- Max Players (8, 16, 32...)
- Entry Fee (z.B. 1.000 Sats)
- Prize Pool (z.B. 500.000 Sats) ← **Creator muss das zahlen!**
- Regeln, Format, etc.

**1.2 System berechnet**
```javascript
const potentialRevenue = entryFee * maxPlayers;
const creatorInvestment = prizePool;
const creatorProfit = potentialRevenue; // Bei Option A

console.log(`
  Du zahlst:           ${creatorInvestment} Sats
  Max. Entry Fees:     ${potentialRevenue} Sats
  Dein Profit (max):   ${creatorProfit} Sats
`);
```

**1.3 Turnier in DB erstellen**
```javascript
const tournament = await createTournament({
  name: "Bitcoin Cup",
  creator: "wolpertinger1",
  max_players: 16,
  entry_fee: 1000,
  creator_prize_deposit: 500000,
  total_prize_pool: 500000,
  status: "pending_payment", // ← Wichtig!
  // ... weitere Felder
});
```

**1.4 LNbits Invoice generieren**
```javascript
const invoice = await createInvoice({
  amount: 500000, // Prize Pool
  memo: `Tournament Prize Pool: ${tournament.name}`,
  webhook: `${API_URL}/webhooks/tournament-payment/${tournament.id}`
});

// Invoice im Turnier speichern
await updateTournament(tournament.id, {
  creator_payment_request: invoice.payment_request,
  creator_payment_hash: invoice.payment_hash
});
```

**1.5 Creator zahlt**
- QR-Code anzeigen
- Creator scannt mit Lightning Wallet
- Zahlt 500.000 Sats

**1.6 Webhook empfängt Zahlung**
```javascript
// POST /webhooks/tournament-payment/:tournamentId
async function handleTournamentPayment(tournamentId, payment) {
  if (payment.paid) {
    await updateTournament(tournamentId, {
      creator_payment_verified: true,
      status: "registration" // ← Jetzt öffentlich!
    });
  }
}
```

---

### PHASE 2: Spieler-Registrierung

**2.1 Spieler sieht Turnier**
- Status: "registration"
- Entry Fee: 1.000 Sats
- Prize Pool: 500.000 Sats
- 3/16 Spieler

**2.2 Spieler klickt "Registrieren"**
```javascript
async function registerForTournament(tournamentId, username) {
  // 1. Prüfen ob Platz frei
  if (tournament.current_participants >= tournament.max_players) {
    throw new Error("Turnier voll");
  }
  
  // 2. Invoice für Entry Fee erstellen
  const invoice = await createInvoice({
    amount: tournament.entry_fee,
    memo: `Entry Fee: ${tournament.name} - ${username}`,
    webhook: `${API_URL}/webhooks/entry-fee/${tournamentId}/${username}`
  });
  
  return invoice;
}
```

**2.3 Spieler zahlt Entry Fee**
- QR-Code anzeigen
- Spieler zahlt 1.000 Sats

**2.4 Webhook empfängt Entry Fee**
```javascript
async function handleEntryFeePayment(tournamentId, username, payment) {
  if (payment.paid) {
    // Spieler zu Teilnehmern hinzufügen
    await addParticipant(tournamentId, username);
    
    // Entry Fee akkumulieren
    await updateTournament(tournamentId, {
      current_participants: tournament.current_participants + 1,
      accumulated_entry_fees: tournament.accumulated_entry_fees + tournament.entry_fee,
      participants: [...tournament.participants, username]
    });
    
    // Auto-Start wenn voll
    if (tournament.current_participants === tournament.max_players) {
      await startTournament(tournamentId);
    }
  }
}
```

---

### PHASE 3: Turnier läuft

**3.1 Bracket generieren**
```javascript
async function startTournament(tournamentId) {
  const participants = tournament.participants; // ['Alice', 'Bob', ...]
  
  // Shuffle für Random Seeding
  const shuffled = shuffle(participants);
  
  // Bracket erstellen
  const bracket = generateBracket(shuffled, tournament.max_players);
  
  // Matches erstellen (als Duels)
  for (const match of bracket.round1) {
    await createDuel({
      creator: match.player1,
      challenger: match.player2,
      tournament_id: tournamentId,
      round: 1,
      // ... weitere Felder
    });
  }
  
  await updateTournament(tournamentId, {
    status: "active",
    started_at: new Date(),
    bracket: bracket
  });
}
```

**3.2 Matches spielen**
- Wie normale Duels
- Nach jedem Match: Bracket aktualisieren
- Winner kommt in nächste Runde

**3.3 Runden-Fortschritt**
```javascript
async function advanceToNextRound(tournamentId) {
  // Alle Matches der aktuellen Runde abgeschlossen?
  const allMatchesFinished = checkRoundComplete(tournament);
  
  if (allMatchesFinished) {
    const winners = getWinnersOfCurrentRound(tournament);
    
    // Nächste Runde erstellen
    await createNextRoundMatches(tournamentId, winners);
    
    await updateTournament(tournamentId, {
      current_round: tournament.current_round + 1
    });
  }
}
```

---

### PHASE 4: Auszahlung

**4.1 Finale endet**
```javascript
async function finishTournament(tournamentId, winner) {
  await updateTournament(tournamentId, {
    status: "finished",
    finished_at: new Date(),
    winner: winner
  });
}
```

**4.2 Winner sieht "Prize claimen" Button**
```javascript
// In ResultView oder TournamentsView
{tournament.status === 'finished' && 
 tournament.winner === user.username && 
 !tournament.prize_pool_claimed && (
  <Button onClick={() => claimPrize(tournament.id)}>
    Prize Pool claimen (500.000 Sats)
  </Button>
)}
```

**4.3 Winner klickt Claimen**
```javascript
async function claimTournamentPrize(tournamentId, winner) {
  // Verifizieren
  if (tournament.winner !== winner) {
    throw new Error("Nicht berechtigt");
  }
  
  if (tournament.prize_pool_claimed) {
    throw new Error("Bereits ausgezahlt");
  }
  
  // LNbits Withdraw erstellen
  const withdraw = await createWithdraw({
    amount: tournament.total_prize_pool,
    title: `Prize: ${tournament.name}`,
    uses: 1 // Einmalig
  });
  
  await updateTournament(tournamentId, {
    prize_pool_withdraw_link: withdraw.lnurl,
    prize_pool_claimed: true
  });
  
  return withdraw.lnurl;
}
```

**4.4 Winner scannt LNURL**
- QR-Code anzeigen
- Winner scannt mit Wallet
- 500.000 Sats werden ausgezahlt

**4.5 Creator claimed Entry Fees** (nur Option A)
```javascript
async function claimEntryFees(tournamentId, creator) {
  if (tournament.creator !== creator) {
    throw new Error("Nicht berechtigt");
  }
  
  if (tournament.entry_fees_claimed) {
    throw new Error("Bereits ausgezahlt");
  }
  
  const withdraw = await createWithdraw({
    amount: tournament.accumulated_entry_fees,
    title: `Entry Fees: ${tournament.name}`,
    uses: 1
  });
  
  await updateTournament(tournamentId, {
    entry_fees_withdraw_link: withdraw.lnurl,
    entry_fees_claimed: true
  });
  
  return withdraw.lnurl;
}
```

---

## 🔐 Wichtige Sicherheitsaspekte

1. **Escrow:** Alle Zahlungen gehen an LNbits Wallet → sicheres Escrow
2. **Verifizierung:** Nur berechtigte User können claimen
3. **Einmalig:** Withdraw-Links haben `uses: 1`
4. **Status-Tracking:** `prize_pool_claimed`, `entry_fees_claimed` verhindern Doppel-Auszahlung

---

## 📊 Geldfluss-Diagramm

```
PHASE 1: Erstellung
Creator → (500k) → LNbits Wallet
                     ↓
                   Escrow

PHASE 2: Registrierung  
Player1 → (1k) → LNbits Wallet
Player2 → (1k) → LNbits Wallet
...
Player16 → (1k) → LNbits Wallet
                     ↓
                 Escrow (16k)

PHASE 4: Auszahlung
LNbits Wallet → (500k) → Winner
LNbits Wallet → (16k) → Creator
```

---

## 🚀 Nächste Implementierungsschritte

1. **Migration ausführen** (tournaments table)
2. **CreateTournamentView erweitern:**
   - Berechnung & Vorschau anzeigen
   - Nach Submit: Invoice generieren
   - Payment-Waiting-Screen
   
3. **Payment-Integration:**
   - LNbits Invoice erstellen
   - Webhook-Endpoint
   - Status-Updates
   
4. **Registration-Flow:**
   - Entry Fee Payment
   - Participant Management
   
5. **Tournament-Logik:**
   - Bracket Generation
   - Match Creation
   - Round Advancement
   
6. **Claim-System:**
   - Winner Claim UI
   - Creator Entry Fees Claim
   - LNURL Withdraw Display

---

Welches Payment-Modell sollen wir verwenden? **Option A empfohlen!**
