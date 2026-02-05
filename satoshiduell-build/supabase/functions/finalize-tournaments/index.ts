import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const cronSecret = Deno.env.get('CRON_SECRET') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateShortToken = (length = 9) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => alphabet[b % alphabet.length]).join('');
};

const determineWinner = (participants: string[], scores: Record<string, number>, times: Record<string, number>) => {
  let winner: string | null = null;

  participants.forEach((player) => {
    if (!player) return;
    const key = player.toLowerCase();
    if (!winner) {
      winner = player;
      return;
    }

    const winnerKey = winner.toLowerCase();
    const wScore = scores[winnerKey] ?? 0;
    const wTime = times[winnerKey] ?? Number.MAX_SAFE_INTEGER;
    const pScore = scores[key] ?? 0;
    const pTime = times[key] ?? Number.MAX_SAFE_INTEGER;

    if (pScore > wScore || (pScore === wScore && pTime < wTime)) {
      winner = player;
    }
  });

  return winner;
};

Deno.serve(async (req) => {
  if (!supabaseUrl || !supabaseServiceKey || !cronSecret) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or CRON_SECRET'
    }), { status: 500 });
  }

  const providedSecret = req.headers.get('x-cron-secret') || '';
  if (providedSecret !== cronSecret) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Unauthorized'
    }), { status: 401 });
  }

  const nowIso = new Date().toISOString();

  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id, participants, participant_scores, participant_times, winner_token, winner_token_created_at, status, play_until, image_path')
    .not('play_until', 'is', null)
    .neq('status', 'finished')
    .lte('play_until', nowIso);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  let updated = 0;
  let skipped = 0;

  for (const tournament of tournaments || []) {
    const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
    if (participants.length === 0) {
      skipped += 1;
      continue;
    }

    const scores = tournament.participant_scores || {};
    const times = tournament.participant_times || {};
    const winner = determineWinner(participants, scores, times);
    const updates: Record<string, unknown> = {
      status: 'finished',
      finished_at: nowIso,
      winner
    };

    if (!tournament.winner_token) {
      updates.winner_token = `T${generateShortToken(9)}`;
      updates.winner_token_created_at = nowIso;
    }

    const { data: updatedTournament, error: updateError } = await supabase
      .from('tournaments')
      .update(updates)
      .eq('id', tournament.id)
      .select('id, image_path')
      .single();

    if (updateError || !updatedTournament) {
      continue;
    }

    updated += 1;

    if (updatedTournament.image_path) {
      await supabase.storage.from('tournament-images').remove([updatedTournament.image_path]);
      await supabase
        .from('tournaments')
        .update({ image_url: null, image_path: null })
        .eq('id', tournament.id);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    updated,
    skipped,
    total: tournaments?.length || 0
  }), { status: 200 });
});
