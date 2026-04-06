// ============================================================
// Edge Function: nostr-announce
// Pfad: supabase/functions/nostr-announce/index.ts
// ============================================================
// POST { action, tournamentId, creatorNpub? }
//
// Actions:
//   'tournament_created'  → "🏆 Neues Turnier: ..."
//   'tournament_started'  → "⚔️ Turnier gestartet: ..."
//   'tournament_finished' → "🎉 Gewinner: ..."
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicKey, finalizeEvent } from 'https://esm.sh/nostr-tools@2.7.0/pure';
import { bytesToHex, hexToBytes } from 'https://esm.sh/@noble/hashes@1.3.3/utils';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SATOSHIDUELL_NSEC = Deno.env.get('SATOSHIDUELL_NSEC') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.einundzwanzig.space',
  'wss://relay.primal.net',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

// ── Nostr Helpers ──

function nsecToHex(nsec: string): Uint8Array {
  // bech32 decode nsec to hex private key
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const data = nsec.slice(5); // remove "nsec1"
  const values: number[] = [];
  for (const c of data) {
    const v = CHARSET.indexOf(c);
    if (v === -1) throw new Error('Invalid bech32 character');
    values.push(v);
  }
  // Convert 5-bit to 8-bit
  let acc = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const v of values.slice(0, -6)) { // remove checksum
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function npubToHex(npub: string): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const data = npub.slice(5); // remove "npub1"
  const values: number[] = [];
  for (const c of data) {
    const v = CHARSET.indexOf(c);
    if (v === -1) throw new Error('Invalid bech32 character');
    values.push(v);
  }
  let acc = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const v of values.slice(0, -6)) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function publishToRelay(relay: string, event: Record<string, unknown>): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      resolve(false);
    }, 5000);

    let ws: WebSocket;
    try {
      ws = new WebSocket(relay);
    } catch {
      clearTimeout(timeout);
      resolve(false);
      return;
    }

    ws.onopen = () => {
      ws.send(JSON.stringify(['EVENT', event]));
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data[0] === 'OK') {
          clearTimeout(timeout);
          ws.close();
          resolve(data[2] === true);
        }
      } catch {}
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
  });
}

// ── Post Builder ──

function buildTournamentCreatedPost(tournament: Record<string, unknown>): string {
  const name = tournament.name || 'Unbekannt';
  const format = tournament.format === 'bracket' ? 'Bracket K.O.' : 'Highscore';
  const maxPlayers = tournament.max_players ? `${tournament.max_players} Spieler` : 'Offene Teilnehmerzahl';
  const deadline = tournament.play_until
    ? `Deadline: ${new Date(tournament.play_until as string).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`
    : '';
  const description = tournament.description ? `\n${tournament.description}` : '';
  const inviteCode = tournament.invite_code || '';
  const link = inviteCode ? `https://www.satoshiduell.com/t/${inviteCode}` : 'https://www.satoshiduell.com';

  const prizes = [];
  if ((tournament as any)._prizes?.length > 0) {
    for (const p of (tournament as any)._prizes) {
      prizes.push(`  ${p.place === 1 ? '🏆' : p.place === 2 ? '🥈' : '🥉'} ${p.title}`);
    }
  }

  let post = `🏆 Neues Turnier: ${name}\n`;
  post += `📋 Format: ${format} | ${maxPlayers}\n`;
  if (deadline) post += `⏰ ${deadline}\n`;
  if (description) post += `${description}\n`;
  if (prizes.length > 0) post += `\n🎁 Preise:\n${prizes.join('\n')}\n`;
  post += `\n👉 Jetzt registrieren: ${link}`;
  post += `\n\n#SatoshiDuell #Bitcoin #Lightning`;

  return post;
}

function buildTournamentStartedPost(tournament: Record<string, unknown>): string {
  const name = tournament.name || 'Unbekannt';
  const count = (tournament.participants as string[])?.length || 0;
  const format = tournament.format === 'bracket' ? 'Bracket' : 'Highscore';
  const status = (tournament as any).status === 'qualifying' ? 'Qualifikationsrunde' : format;

  let post = `⚔️ ${name} — ${status} gestartet!\n`;
  post += `👥 ${count} Spieler treten an\n`;
  post += `\n🔥 Möge der Beste gewinnen!`;
  post += `\n\n#SatoshiDuell #Bitcoin #Lightning`;

  return post;
}

function buildTournamentFinishedPost(tournament: Record<string, unknown>): string {
  const name = tournament.name || 'Unbekannt';
  const winner = tournament.winner || 'Unbekannt';

  let post = `🎉 ${name} — Turnier beendet!\n\n`;
  post += `👑 Gewinner: ${winner}\n`;
  post += `\nGlückwunsch! ⚡🏆`;
  post += `\n\n#SatoshiDuell #Bitcoin #Lightning`;

  return post;
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  if (!SATOSHIDUELL_NSEC) {
    return jsonResponse({ ok: false, error: 'SATOSHIDUELL_NSEC not configured' }, 500);
  }

  try {
    const body = await req.json();
    const { action, tournamentId } = body;

    if (!action || !tournamentId) {
      return jsonResponse({ ok: false, error: 'action und tournamentId erforderlich' }, 400);
    }

    // Tournament laden
    const { data: tournament, error: fetchError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (fetchError || !tournament) {
      return jsonResponse({ ok: false, error: 'Turnier nicht gefunden' }, 404);
    }

    // Nostr-Announce deaktiviert?
    if (!tournament.nostr_announce) {
      return jsonResponse({ ok: true, skipped: true, message: 'Nostr-Announce deaktiviert' });
    }

    // Preise laden für Created-Post
    let prizes: any[] = [];
    if (action === 'tournament_created') {
      const { data: prizeData } = await supabase
        .from('tournament_prizes')
        .select('title, place')
        .eq('tournament_id', tournamentId)
        .order('place');
      prizes = prizeData || [];
    }

    // Post-Text bauen
    let content = '';
    const tournamentWithPrizes = { ...tournament, _prizes: prizes };

    switch (action) {
      case 'tournament_created':
        content = buildTournamentCreatedPost(tournamentWithPrizes);
        break;
      case 'tournament_started':
        content = buildTournamentStartedPost(tournament);
        break;
      case 'tournament_finished':
        content = buildTournamentFinishedPost(tournament);
        break;
      default:
        return jsonResponse({ ok: false, error: `Unbekannte Aktion: ${action}` }, 400);
    }

    // Nostr Event bauen
    const privateKeyBytes = nsecToHex(SATOSHIDUELL_NSEC);
    const pubkeyHex = getPublicKey(privateKeyBytes);

    // Tags: Creator taggen wenn npub hinterlegt
    const tags: string[][] = [];
    if (tournament.creator_announce_npub) {
      try {
        const creatorPubkeyHex = npubToHex(tournament.creator_announce_npub);
        tags.push(['p', creatorPubkeyHex]);
      } catch (e) {
        console.error('Invalid creator npub:', e);
      }
    }

    // Hashtags als t-Tags
    tags.push(['t', 'SatoshiDuell']);
    tags.push(['t', 'Bitcoin']);
    tags.push(['t', 'Lightning']);

    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    };

    const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

    // An alle Relays senden
    const results = await Promise.allSettled(
      RELAYS.map(relay => publishToRelay(relay, signedEvent))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - successful;

    return jsonResponse({
      ok: true,
      eventId: (signedEvent as any).id,
      published: successful,
      failed,
      relays: RELAYS.length,
    });

  } catch (err) {
    console.error('Nostr announce error:', err);
    return jsonResponse({ ok: false, error: (err as Error).message || 'Internal error' }, 500);
  }
});