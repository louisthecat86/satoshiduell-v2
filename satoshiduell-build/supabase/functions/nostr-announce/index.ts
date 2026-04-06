// ============================================================
// Edge Function: nostr-announce
// Pfad: supabase/functions/nostr-announce/index.ts
// ============================================================
// POST { action, tournamentId, matchPlayers? }
//
// Actions:
//   'tournament_created'   → Neues Turnier angekündigt
//   'tournament_started'   → Turnier/Qualifying gestartet + Teilnehmer getaggt
//   'qualifying_ended'     → Bracket startet, Qualifizierte getaggt
//   'round_started'        → Neue Runde, betroffene Spieler getaggt
//   'tournament_finished'  → Gewinner + alle Teilnehmer getaggt
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicKey, finalizeEvent } from 'https://esm.sh/nostr-tools@2.7.0/pure';

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
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const data = nsec.slice(5);
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
  return new Uint8Array(bytes);
}

function npubToHex(npub: string): string | null {
  try {
    if (!npub || !npub.startsWith('npub1')) return null;
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const data = npub.slice(5);
    const values: number[] = [];
    for (const c of data) {
      const v = CHARSET.indexOf(c);
      if (v === -1) return null;
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
  } catch {
    return null;
  }
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

// ── Teilnehmer-npubs sammeln ──

async function collectParticipantNpubs(tournamentId: number, participants: string[]): Promise<string[]> {
  const npubHexSet = new Set<string>();

  if (!participants || participants.length === 0) return [];

  // 1. npubs aus Profilen laden
  const { data: profiles } = await supabase
    .from('profiles')
    .select('username, npub')
    .in('username', participants);

  for (const p of profiles || []) {
    if (p.npub) {
      const hex = npubToHex(p.npub);
      if (hex) npubHexSet.add(hex);
    }
  }

  // 2. npubs aus Registrierungen (identity_type = 'nostr')
  const { data: regs } = await supabase
    .from('tournament_registrations')
    .select('identity_type, identity_value')
    .eq('tournament_id', tournamentId)
    .eq('identity_type', 'nostr')
    .eq('status', 'redeemed');

  for (const r of regs || []) {
    if (r.identity_value) {
      const hex = npubToHex(r.identity_value);
      if (hex) npubHexSet.add(hex);
    }
  }

  return Array.from(npubHexSet);
}

// ── Post Builder ──

function buildCreatedPost(tournament: any, prizes: any[]): string {
  const name = tournament.name || 'Unbekannt';
  const format = tournament.format === 'bracket' ? 'Bracket K.O.' : 'Highscore';
  const maxPlayers = tournament.max_players ? `${tournament.max_players} Spieler` : 'Offene Teilnehmerzahl';
  const deadline = tournament.play_until
    ? `\n⏰ Deadline: ${new Date(tournament.play_until).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`
    : '';
  const description = tournament.description ? `\n📝 ${tournament.description}` : '';
  const inviteCode = tournament.invite_code || '';
  const link = inviteCode ? `https://www.satoshiduell.com/t/${inviteCode}` : 'https://www.satoshiduell.com';

  let prizeText = '';
  if (prizes.length > 0) {
    const prizeLines = prizes.map(p =>
      `  ${p.place === 1 ? '🏆' : p.place === 2 ? '🥈' : '🥉'} ${p.title}`
    );
    prizeText = `\n\n🎁 Preise:\n${prizeLines.join('\n')}`;
  }

  return `🏆 Neues Turnier: ${name}\n📋 ${format} | ${maxPlayers}${deadline}${description}${prizeText}\n\n👉 Jetzt registrieren: ${link}\n\n#SatoshiDuell #Bitcoin #Lightning`;
}

function buildStartedPost(tournament: any): string {
  const name = tournament.name || 'Unbekannt';
  const count = (tournament.participants || []).length;
  const isQualifying = tournament.status === 'qualifying';

  if (isQualifying) {
    return `⚔️ ${name} — Qualifikationsrunde gestartet!\n👥 ${count} Spieler kämpfen um die Bracket-Plätze\n🎯 Top ${tournament.qualifying_target || '?'} kommen weiter\n\n🔥 Spielt euer Quiz!\n\n#SatoshiDuell #Bitcoin #Lightning`;
  }

  return `⚔️ ${name} — Turnier gestartet!\n👥 ${count} Spieler treten an\n\n🔥 Möge der Beste gewinnen!\n\n#SatoshiDuell #Bitcoin #Lightning`;
}

function buildQualifyingEndedPost(tournament: any): string {
  const name = tournament.name || 'Unbekannt';
  const count = (tournament.participants || []).length;

  return `🎯 ${name} — Qualifikation beendet!\n✅ ${count} Spieler haben sich für das Bracket qualifiziert\n⚔️ Die K.O.-Runde beginnt jetzt!\n\n#SatoshiDuell #Bitcoin #Lightning`;
}

function buildRoundStartedPost(tournament: any, matchPlayers: string[]): string {
  const name = tournament.name || 'Unbekannt';
  const matchCount = Math.floor(matchPlayers.length / 2);

  return `🔔 ${name} — Nächste Runde!\n⚔️ ${matchCount} ${matchCount === 1 ? 'Match steht' : 'Matches stehen'} an\n\n⏰ Spielt eure Matches!\n\n#SatoshiDuell #Bitcoin #Lightning`;
}

function buildFinishedPost(tournament: any): string {
  const name = tournament.name || 'Unbekannt';
  const winner = tournament.winner || 'Unbekannt';

  return `🎉 ${name} — Turnier beendet!\n\n👑 Gewinner: ${winner}\n\nGlückwunsch! ⚡🏆\n\n#SatoshiDuell #Bitcoin #Lightning`;
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
    const { action, tournamentId, matchPlayers } = body;

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

    if (!tournament.nostr_announce) {
      return jsonResponse({ ok: true, skipped: true, message: 'Nostr-Announce deaktiviert' });
    }

    // Post-Text bauen
    let content = '';
    const participants = tournament.participants || [];

    switch (action) {
      case 'tournament_created': {
        const { data: prizes } = await supabase
          .from('tournament_prizes')
          .select('title, place')
          .eq('tournament_id', tournamentId)
          .order('place');
        content = buildCreatedPost(tournament, prizes || []);
        break;
      }
      case 'tournament_started':
        content = buildStartedPost(tournament);
        break;
      case 'qualifying_ended':
        content = buildQualifyingEndedPost(tournament);
        break;
      case 'round_started':
        content = buildRoundStartedPost(tournament, matchPlayers || []);
        break;
      case 'tournament_finished':
        content = buildFinishedPost(tournament);
        break;
      default:
        return jsonResponse({ ok: false, error: `Unbekannte Aktion: ${action}` }, 400);
    }

    // Nostr Event bauen
    const privateKeyBytes = nsecToHex(SATOSHIDUELL_NSEC);

    // Tags sammeln
    const tags: string[][] = [];

    // Creator taggen wenn Opt-in
    if (tournament.creator_announce_npub) {
      const creatorHex = npubToHex(tournament.creator_announce_npub);
      if (creatorHex) tags.push(['p', creatorHex]);
    }

    // Teilnehmer-npubs taggen (bei allen Actions außer created)
    if (action !== 'tournament_created') {
      // Bei round_started nur die betroffenen Spieler taggen
      const playersToTag = (action === 'round_started' && matchPlayers?.length > 0)
        ? matchPlayers
        : participants;

      const participantNpubs = await collectParticipantNpubs(tournamentId, playersToTag);
      for (const hex of participantNpubs) {
        // Doppelte vermeiden (Creator könnte auch Teilnehmer sein)
        if (!tags.some(t => t[0] === 'p' && t[1] === hex)) {
          tags.push(['p', hex]);
        }
      }
    }

    // Hashtags
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

    return jsonResponse({
      ok: true,
      eventId: (signedEvent as any).id,
      published: successful,
      relays: RELAYS.length,
      tagged: tags.filter(t => t[0] === 'p').length,
    });

  } catch (err) {
    console.error('Nostr announce error:', err);
    return jsonResponse({ ok: false, error: (err as Error).message || 'Internal error' }, 500);
  }
});