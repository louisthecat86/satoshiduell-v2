import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LNBITS_URL = Deno.env.get('LNBITS_URL') || '';
const LNBITS_ADMIN_KEY = Deno.env.get('LNBITS_ADMIN_KEY') || '';
const LNBITS_INVOICE_KEY = Deno.env.get('LNBITS_INVOICE_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
};

// Maximale Auszahlung pro Einzeltransaktion (Sicherheitslimit)
const MAX_PAYOUT_SATS = 50000;

// ═══════════════════════════════════════════
// LNbits Payment-Hash Verifizierung
// Prüft ob eine Zahlung tatsächlich bei LNbits eingegangen ist
// ═══════════════════════════════════════════
async function verifyPaymentWithLnbits(paymentHash: string, expectedAmount: number): Promise<{ valid: boolean; error?: string }> {
  if (!paymentHash) {
    return { valid: false, error: 'No payment hash provided' };
  }

  try {
    const response = await fetch(`${LNBITS_URL}/api/v1/payments/${paymentHash}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': LNBITS_INVOICE_KEY || LNBITS_ADMIN_KEY
      }
    });

    if (!response.ok) {
      return { valid: false, error: `Payment not found (${response.status})` };
    }

    const data = await response.json();

    // Prüfe ob bezahlt
    if (!data.paid) {
      return { valid: false, error: 'Payment not yet confirmed' };
    }

    // Prüfe ob incoming (nicht outgoing) - Betrag in msats, incoming ist positiv
    // LNbits speichert amount in msats (1 sat = 1000 msats)
    const amountSats = Math.abs(data.amount) / 1000;
    if (amountSats < expectedAmount) {
      return { valid: false, error: `Payment amount ${amountSats} < expected ${expectedAmount}` };
    }

    return { valid: true };
  } catch (_e) {
    return { valid: false, error: 'Payment verification request failed' };
  }
}

// LNbits Withdraw-Link erstellen (intern)
async function createLnbitsWithdrawLink(amount: number, title: string) {
  const response = await fetch(`${LNBITS_URL}/withdraw/api/v1/links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': LNBITS_ADMIN_KEY
    },
    body: JSON.stringify({
      title,
      min_withdrawable: amount,
      max_withdrawable: amount,
      uses: 1,
      wait_time: 1,
      is_unique: true
    })
  });

  if (!response.ok) return null;
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!LNBITS_URL || !LNBITS_ADMIN_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: 'Server misconfigured' }, 500);
  }

  // Auth: JWT muss vorhanden sein (verify_jwt = true in config.toml)
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  let payload: {
    amount?: number;
    gameId?: string | number;
    linkId?: string;
    playerName?: string;
    type?: string; // 'win' | 'refund'
  } = {};
  try {
    payload = await req.json();
  } catch (_e) {
    payload = {};
  }

  // ═══════════════════════════════════════════
  // Status-Check für bestehenden Withdraw-Link
  // ═══════════════════════════════════════════
  if (payload.linkId) {
    try {
      const response = await fetch(`${LNBITS_URL}/withdraw/api/v1/links/${payload.linkId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': LNBITS_ADMIN_KEY
        }
      });
      if (!response.ok) {
        return jsonResponse({ ok: false, error: 'Failed to fetch withdraw link status' }, 500);
      }
      const data = await response.json();
      return jsonResponse({ ok: true, used: data.used >= 1 });
    } catch (_e) {
      return jsonResponse({ ok: false, error: 'Withdraw status request failed' }, 500);
    }
  }

  // ═══════════════════════════════════════════
  // Gemeinsame Validierung
  // ═══════════════════════════════════════════
  const gameId = payload.gameId ? String(payload.gameId) : '';
  const playerName = payload.playerName ? String(payload.playerName).toLowerCase().trim() : '';
  const withdrawType = payload.type || 'win';

  if (!gameId) return jsonResponse({ ok: false, error: 'gameId is required' }, 400);
  if (!playerName) return jsonResponse({ ok: false, error: 'playerName is required' }, 400);

  // Spiel aus Datenbank laden (inkl. Payment-Hashes)
  const { data: game, error: gameError } = await supabase
    .from('duels')
    .select('id, status, amount, creator, challenger, winner, is_claimed, claimed, mode, participants, participant_scores, participant_times, max_players, refund_claimed, creator_score, challenger_score, creator_payment_hash, challenger_payment_hash, participant_payment_hashes, creator_paid_at, challenger_paid_at, participant_paid_at')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    return jsonResponse({ ok: false, error: 'Game not found' }, 404);
  }

  // ═══════════════════════════════════════════
  // REFUND-Logik
  // ═══════════════════════════════════════════
  if (withdrawType === 'refund') {
    const refundAmount = game.amount || 0;
    if (refundAmount <= 0) {
      return jsonResponse({ ok: false, error: 'Invalid refund amount' }, 400);
    }
    if (refundAmount > MAX_PAYOUT_SATS) {
      return jsonResponse({ ok: false, error: 'Amount exceeds limit' }, 400);
    }

    if (game.mode === 'arena') {
      // Arena-Refund: Spieler muss Teilnehmer sein
      const participants = Array.isArray(game.participants) ? game.participants : [];
      if (!participants.some((p: string) => p.toLowerCase() === playerName)) {
        return jsonResponse({ ok: false, error: 'Not a participant' }, 403);
      }
      // Prüfen ob bereits geclaimed
      const refundClaimed = game.refund_claimed || {};
      if (refundClaimed[playerName]) {
        return jsonResponse({ ok: false, error: 'Refund already claimed' }, 400);
      }
      // Spiel muss im richtigen Status sein
      if (!['open', 'pending_payment', 'finished'].includes(game.status)) {
        return jsonResponse({ ok: false, error: 'Game cannot be refunded in current status' }, 400);
      }
      // *** PAYMENT VERIFICATION: Prüfe ob der Spieler tatsächlich bezahlt hat ***
      const participantHashes = game.participant_payment_hashes || {};
      const playerHash = participantHashes[playerName];
      if (playerHash) {
        const verification = await verifyPaymentWithLnbits(playerHash, refundAmount);
        if (!verification.valid) {
          return jsonResponse({ ok: false, error: `Payment verification failed: ${verification.error}` }, 403);
        }
      }
      // Hinweis: Für alte Spiele ohne Hash erlauben wir Refund mit paid_at Check
      else {
        const paidAt = (game.participant_paid_at || {})[playerName];
        if (!paidAt) {
          return jsonResponse({ ok: false, error: 'No payment record found for this player' }, 403);
        }
      }
    } else {
      // Standard-Duell-Refund: Nur Creator kann refunden, Spiel muss noch offen sein
      if (game.creator?.toLowerCase() !== playerName) {
        return jsonResponse({ ok: false, error: 'Only the creator can refund' }, 403);
      }
      if (!['open', 'pending_payment'].includes(game.status)) {
        return jsonResponse({ ok: false, error: 'Game cannot be refunded (already active/finished)' }, 400);
      }
      if (game.is_claimed || game.claimed) {
        return jsonResponse({ ok: false, error: 'Already claimed' }, 400);
      }
      // *** PAYMENT VERIFICATION ***
      if (game.creator_payment_hash) {
        const verification = await verifyPaymentWithLnbits(game.creator_payment_hash, refundAmount);
        if (!verification.valid) {
          return jsonResponse({ ok: false, error: `Payment verification failed: ${verification.error}` }, 403);
        }
      } else if (!game.creator_paid_at) {
        return jsonResponse({ ok: false, error: 'No payment record found' }, 403);
      }
    }

    // Withdraw-Link erstellen
    try {
      const data = await createLnbitsWithdrawLink(refundAmount, `SatoshiDuell Refund #${gameId}`);
      if (!data) {
        return jsonResponse({ ok: false, error: 'Could not create refund link' }, 500);
      }
      return jsonResponse({ ok: true, lnurl: data.lnurl, id: data.id });
    } catch (_e) {
      return jsonResponse({ ok: false, error: 'Refund request failed' }, 500);
    }
  }

  // ═══════════════════════════════════════════
  // WIN-Logik (Standard)
  // ═══════════════════════════════════════════
  if (game.status !== 'finished') {
    return jsonResponse({ ok: false, error: 'Game is not finished' }, 400);
  }

  if (game.is_claimed || game.claimed) {
    return jsonResponse({ ok: false, error: 'Already claimed' }, 400);
  }

  // ═══════════════════════════════════════════
  // *** KRITISCH: ZAHLUNGSVERIFIZIERUNG ***
  // Bevor ein Withdraw-Link erstellt wird, MUSS
  // verifiziert werden, dass ALLE Spieler tatsächlich
  // über LNbits bezahlt haben.
  // ═══════════════════════════════════════════
  const gameAmount = game.amount || 0;

  if (game.mode === 'arena') {
    const participants = Array.isArray(game.participants) ? game.participants : [];
    const participantHashes = game.participant_payment_hashes || {};
    
    for (const p of participants) {
      const pKey = p.toLowerCase();
      const hash = participantHashes[pKey];
      if (hash) {
        const verification = await verifyPaymentWithLnbits(hash, gameAmount);
        if (!verification.valid) {
          return jsonResponse({ ok: false, error: `Payment verification failed for participant: ${verification.error}` }, 403);
        }
      } else {
        // Alte Spiele ohne Hash: paid_at als Fallback prüfen
        const paidAt = (game.participant_paid_at || {})[pKey];
        if (!paidAt) {
          return jsonResponse({ ok: false, error: `No payment record for participant ${pKey}` }, 403);
        }
      }
    }
  } else {
    // Standard-Duell: Beide Spieler müssen bezahlt haben
    if (game.creator_payment_hash) {
      const creatorVerify = await verifyPaymentWithLnbits(game.creator_payment_hash, gameAmount);
      if (!creatorVerify.valid) {
        return jsonResponse({ ok: false, error: `Creator payment verification failed: ${creatorVerify.error}` }, 403);
      }
    } else if (!game.creator_paid_at) {
      return jsonResponse({ ok: false, error: 'No creator payment record' }, 403);
    }

    if (game.challenger_payment_hash) {
      const challengerVerify = await verifyPaymentWithLnbits(game.challenger_payment_hash, gameAmount);
      if (!challengerVerify.valid) {
        return jsonResponse({ ok: false, error: `Challenger payment verification failed: ${challengerVerify.error}` }, 403);
      }
    } else if (!game.challenger_paid_at) {
      return jsonResponse({ ok: false, error: 'No challenger payment record' }, 403);
    }
  }

  // Gewinner bestimmen und prüfen
  let isWinner = false;
  let expectedPayout = 0;

  if (game.mode === 'arena') {
    const participants = Array.isArray(game.participants) ? game.participants : [];
    const scores = game.participant_scores || {};
    const times = game.participant_times || {};
    
    let winner: string | null = null;
    participants.forEach((p: string) => {
      const key = p.toLowerCase();
      if (!winner) { winner = p; return; }
      const wKey = winner.toLowerCase();
      const wScore = scores[wKey] ?? 0;
      const wTime = times[wKey] ?? Number.MAX_SAFE_INTEGER;
      const pScore = scores[key] ?? 0;
      const pTime = times[key] ?? Number.MAX_SAFE_INTEGER;
      if (pScore > wScore || (pScore === wScore && pTime < wTime)) winner = p;
    });

    isWinner = winner?.toLowerCase() === playerName;
    expectedPayout = (game.amount || 0) * participants.length;
  } else {
    // Gewinner aus Scores berechnen (nicht aus game.winner vertrauen!)
    const creatorWins = (game.creator_score ?? 0) > (game.challenger_score ?? 0);
    const challengerWins = (game.challenger_score ?? 0) > (game.creator_score ?? 0);
    
    if (creatorWins && game.creator?.toLowerCase() === playerName) {
      isWinner = true;
    } else if (challengerWins && game.challenger?.toLowerCase() === playerName) {
      isWinner = true;
    } else if (!creatorWins && !challengerWins) {
      // Unentschieden: Zeitvergleich
      const creatorTime = game.creator_time ?? Number.MAX_SAFE_INTEGER;
      const challengerTime = game.challenger_time ?? Number.MAX_SAFE_INTEGER;
      if (creatorTime < challengerTime && game.creator?.toLowerCase() === playerName) {
        isWinner = true;
      } else if (challengerTime < creatorTime && game.challenger?.toLowerCase() === playerName) {
        isWinner = true;
      }
    }
    expectedPayout = (game.amount || 0) * 2;
  }

  if (!isWinner) {
    return jsonResponse({ ok: false, error: 'You are not the winner of this game' }, 403);
  }

  // Betrag validieren
  const requestedAmount = Math.floor(Number(payload.amount || expectedPayout));
  
  if (requestedAmount <= 0) {
    return jsonResponse({ ok: false, error: 'Invalid amount' }, 400);
  }
  if (requestedAmount > expectedPayout) {
    return jsonResponse({ ok: false, error: `Amount exceeds game pot (max: ${expectedPayout})` }, 400);
  }
  if (requestedAmount > MAX_PAYOUT_SATS) {
    return jsonResponse({ ok: false, error: `Amount exceeds maximum payout limit (${MAX_PAYOUT_SATS})` }, 400);
  }

  // Atomar als claimed markieren BEVOR der Link erstellt wird
  const { data: claimResult, error: claimError } = await supabase
    .from('duels')
    .update({ is_claimed: true, claimed: true })
    .eq('id', gameId)
    .eq('is_claimed', false)
    .select('id')
    .single();

  if (claimError || !claimResult) {
    return jsonResponse({ ok: false, error: 'Already claimed (race condition prevented)' }, 400);
  }

  // Withdraw-Link erstellen
  try {
    const data = await createLnbitsWithdrawLink(requestedAmount, `SatoshiDuell Win #${gameId}`);
    if (!data) {
      await supabase.from('duels').update({ is_claimed: false, claimed: false }).eq('id', gameId);
      return jsonResponse({ ok: false, error: 'Konnte Auszahlung nicht erstellen' }, 500);
    }
    return jsonResponse({ ok: true, lnurl: data.lnurl, id: data.id });
  } catch (_e) {
    await supabase.from('duels').update({ is_claimed: false, claimed: false }).eq('id', gameId);
    return jsonResponse({ ok: false, error: 'Withdraw request failed' }, 500);
  }
});
