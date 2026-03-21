// ============================================================
// Edge Function: tournament-tokens
// Pfad: supabase/functions/tournament-tokens/index.ts
// ============================================================
// Zwei Aktionen:
//   POST { action: 'create', tournamentId, issuedTo, createdBy }
//   POST { action: 'redeem', tournamentId, token, username }
//
// Nur diese Edge Function darf Tokens erstellen und einlösen.
// Der Client nutzt den anon-Key um die Function aufzurufen,
// die Function nutzt intern den service_role-Key.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
};

// ── Crypto Helpers ──

async function hashValue(value: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(value.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `T-${hex}`;
}

// ── ACTION: Create Token ──

async function handleCreate(tournamentId: number, issuedTo: string | null, createdBy: string | null) {
  // Turnier laden & prüfen
  const { data: tournament, error: fetchError } = await supabase
    .from('tournaments')
    .select('id, max_players, creator, status')
    .eq('id', tournamentId)
    .single();

  if (fetchError || !tournament) {
    return jsonResponse({ ok: false, error: 'Turnier nicht gefunden' }, 404);
  }

  // Nur Creator darf Tokens erstellen
  if (!createdBy || tournament.creator?.toLowerCase() !== createdBy.toLowerCase()) {
    return jsonResponse({ ok: false, error: 'Nur der Turnier-Creator darf Tokens erstellen' }, 403);
  }

  // Token-Limit prüfen
  if (tournament.max_players && tournament.max_players > 0) {
    const { count, error: countError } = await supabase
      .from('tournament_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    if (countError) {
      return jsonResponse({ ok: false, error: countError.message }, 500);
    }
    if ((count || 0) >= tournament.max_players) {
      return jsonResponse({ ok: false, error: 'Token-Limit erreicht' }, 400);
    }
  }

  // Token generieren und hashen
  const token = generateToken();
  const tokenHash = await hashValue(token);

  const { data, error } = await supabase
    .from('tournament_tokens')
    .insert([
      {
        tournament_id: tournamentId,
        token_hash: tokenHash,
        issued_to: issuedTo || null,
        created_by: createdBy || null,
      },
    ])
    .select()
    .single();

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  // Klartext-Token zurückgeben (wird nur einmal angezeigt)
  return jsonResponse({ ok: true, data, token });
}

// ── ACTION: Redeem Token ──

async function handleRedeem(tournamentId: number, token: string, username: string) {
  if (!token || !username) {
    return jsonResponse({ ok: false, error: 'Token und Username erforderlich' }, 400);
  }

  const tokenHash = await hashValue(token);

  // Token suchen: muss zum Turnier gehören, darf nicht benutzt sein
  const { data: tokenRow, error: fetchError } = await supabase
    .from('tournament_tokens')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .maybeSingle();

  if (fetchError || !tokenRow) {
    return jsonResponse({ ok: false, error: 'Token ungültig oder bereits verwendet' }, 400);
  }

  // Token als benutzt markieren
  const { error: updateError } = await supabase
    .from('tournament_tokens')
    .update({
      used_by: username,
      used_at: new Date().toISOString(),
    })
    .eq('id', tokenRow.id)
    .is('used_at', null); // Double-check: Race-Condition verhindern

  if (updateError) {
    return jsonResponse({ ok: false, error: updateError.message }, 500);
  }

  // Spieler zum Turnier hinzufügen
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    return jsonResponse({ ok: false, error: 'Turnier nicht gefunden' }, 404);
  }

  const normalizedName = username.trim();
  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];

  // Schon dabei?
  const existing = participants.some(
    (p: string) => (p || '').toLowerCase() === normalizedName.toLowerCase()
  );
  if (existing) {
    return jsonResponse({ ok: true, data: tournament, message: 'Bereits im Turnier' });
  }

  // Voll?
  if (tournament.max_players && participants.length >= tournament.max_players) {
    return jsonResponse({ ok: false, error: 'Turnier ist voll' }, 400);
  }

  // Abgelaufen?
  if (tournament.play_until && new Date(tournament.play_until) <= new Date()) {
    return jsonResponse({ ok: false, error: 'Turnier ist abgelaufen' }, 400);
  }

  const updatedParticipants = [...participants, normalizedName];
  const updates: Record<string, unknown> = {
    participants: updatedParticipants,
    current_participants: updatedParticipants.length,
  };

  // Auto-Start bei Bracket wenn voll
  if (
    tournament.format === 'bracket' &&
    tournament.max_players &&
    updatedParticipants.length >= tournament.max_players
  ) {
    updates.status = 'active';
    updates.started_at = new Date().toISOString();
  }

  // Auto-Start bei Highscore wenn voll
  if (
    tournament.format === 'highscore' &&
    tournament.max_players &&
    updatedParticipants.length >= tournament.max_players &&
    tournament.status === 'registration'
  ) {
    updates.status = 'active';
    updates.started_at = new Date().toISOString();
  }

  const { data: updatedTournament, error: updateTError } = await supabase
    .from('tournaments')
    .update(updates)
    .eq('id', tournamentId)
    .select()
    .single();

  if (updateTError) {
    return jsonResponse({ ok: false, error: updateTError.message }, 500);
  }

  return jsonResponse({ ok: true, data: updatedTournament });
}

// ── Main Handler ──

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: 'Server configuration error' }, 500);
  }

  try {
    const body = await req.json();
    const { action, tournamentId, issuedTo, createdBy, token, username } = body;

    if (!action || !tournamentId) {
      return jsonResponse({ ok: false, error: 'action und tournamentId erforderlich' }, 400);
    }

    if (action === 'create') {
      return await handleCreate(tournamentId, issuedTo, createdBy);
    }

    if (action === 'redeem') {
      return await handleRedeem(tournamentId, token, username);
    }

    return jsonResponse({ ok: false, error: `Unbekannte Aktion: ${action}` }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, error: (err as Error).message || 'Internal error' }, 500);
  }
});