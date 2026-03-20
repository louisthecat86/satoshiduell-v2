// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const cronSecret = Deno.env.get('CRON_SECRET') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

const buildRankedList = (participants, scores, times) => {
  const rows = (participants || []).map(name => {
    const key = (name || '').toLowerCase();
    const score = scores[key];
    const timeMs = times[key];
    const played = score !== undefined && score !== null;
    return { name, key, score: played ? score : null, timeMs: played ? timeMs : null, played };
  });

  rows.sort((a, b) => {
    if (a.played !== b.played) return a.played ? -1 : 1;
    if (!a.played && !b.played) return 0;
    if (a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
    const at = a.timeMs ?? Number.MAX_SAFE_INTEGER;
    const bt = b.timeMs ?? Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  return rows;
};

const assignPrizesToWinners = async (tournamentId, rankedList) => {
  const { data: prizes } = await supabase
    .from('tournament_prizes')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('place', { ascending: true });

  if (!prizes || prizes.length === 0) return;

  for (const prize of prizes) {
    const winner = rankedList[prize.place - 1];
    if (!winner) continue;

    const { data: reg } = await supabase
      .from('tournament_registrations')
      .select('identity_type, identity_value, identity_display')
      .eq('tournament_id', tournamentId)
      .ilike('player_username', winner.name)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('npub')
      .ilike('username', winner.name)
      .maybeSingle();

    await supabase
      .from('tournament_prizes')
      .update({
        winner_username: winner.name,
        winner_npub: profile?.npub || null,
        winner_identity_type: reg?.identity_type || null,
        winner_identity_value: reg?.identity_value || null,
      })
      .eq('id', prize.id);
  }
};

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  if (!supabaseUrl || !supabaseServiceKey || !cronSecret) {
    return new Response(JSON.stringify({
      ok: false, error: 'Missing env vars'
    }), { status: 500 });
  }

  const providedSecret = req.headers.get('x-cron-secret') || '';
  if (providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });
  }

  const nowIso = new Date().toISOString();
  let highscoreFinalized = 0;
  let bracketMatchesFinalized = 0;
  let errors = 0;

  // ============================================
  // 1. HIGHSCORE-TURNIERE MIT ABGELAUFENER DEADLINE
  // ============================================
  try {
    const { data: expiredHighscore } = await supabase
      .from('tournaments')
      .select('*')
      .eq('format', 'highscore')
      .not('play_until', 'is', null)
      .neq('status', 'finished')
      .neq('status', 'cancelled')
      .lte('play_until', nowIso);

    for (const tournament of expiredHighscore || []) {
      const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
      if (participants.length === 0) continue;

      const scores = tournament.participant_scores || {};
      const times = tournament.participant_times || {};
      const ranked = buildRankedList(participants, scores, times);

      const winnerName = ranked.length > 0 && ranked[0].played ? ranked[0].name : null;
      let winnerNpub = null;

      if (winnerName) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('npub')
          .ilike('username', winnerName)
          .maybeSingle();
        winnerNpub = profile?.npub || null;
      }

      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          status: 'finished',
          finished_at: nowIso,
          winner: winnerName,
          winner_npub: winnerNpub,
        })
        .eq('id', tournament.id);

      if (updateError) {
        errors += 1;
        continue;
      }

      await assignPrizesToWinners(tournament.id, ranked);

      // Bild aufräumen
      if (tournament.image_path) {
        await supabase.storage.from('tournament-images').remove([tournament.image_path]);
        await supabase.from('tournaments')
          .update({ image_url: null, image_path: null })
          .eq('id', tournament.id);
      }

      highscoreFinalized += 1;
    }
  } catch (e) {
    console.error('Highscore finalization error:', e);
    errors += 1;
  }

  // ============================================
  // 2. BRACKET-MATCHES MIT ABGELAUFENER DEADLINE
  // ============================================
  try {
    const { data: expiredMatches } = await supabase
      .from('tournament_bracket_matches')
      .select('*')
      .in('status', ['ready', 'active'])
      .not('deadline_at', 'is', null)
      .lte('deadline_at', nowIso);

    for (const match of expiredMatches || []) {
      let winner = null;

      if (match.player1_score !== null && match.player2_score === null) {
        winner = match.player1;
      } else if (match.player2_score !== null && match.player1_score === null) {
        winner = match.player2;
      } else if (match.player1_score !== null && match.player2_score !== null) {
        winner = (match.player1_score > match.player2_score
          || (match.player1_score === match.player2_score
              && (match.player1_time_ms || Infinity) < (match.player2_time_ms || Infinity)))
          ? match.player1 : match.player2;
      } else {
        // Keiner gespielt → player1 gewinnt (höherer Seed)
        winner = match.player1;
      }

      await supabase
        .from('tournament_bracket_matches')
        .update({ status: 'finished', finished_at: nowIso, winner })
        .eq('id', match.id);

      bracketMatchesFinalized += 1;

      // Prüfen ob alle Matches der Runde fertig → nächste Runde vorbereiten
      // (vereinfacht: wird beim nächsten Cron-Lauf aufgeräumt)
      const { data: allRoundMatches } = await supabase
        .from('tournament_bracket_matches')
        .select('*')
        .eq('tournament_id', match.tournament_id)
        .eq('round_name', match.round_name);

      const allDone = (allRoundMatches || []).every(m => m.status === 'finished');
      if (allDone) {
        // Alle Matches dieser Runde laden + nächste Runde finden
        const { data: allMatches } = await supabase
          .from('tournament_bracket_matches')
          .select('*')
          .eq('tournament_id', match.tournament_id)
          .order('match_index');

        if (allMatches) {
          const roundNames = [];
          const seen = new Set();
          allMatches.forEach(m => { if (!seen.has(m.round_name)) { seen.add(m.round_name); roundNames.push(m.round_name); } });

          const currentIdx = roundNames.indexOf(match.round_name);
          const currentRoundMatches = allMatches.filter(m => m.round_name === match.round_name);
          const winners = currentRoundMatches.map(m => m.winner);

          if (currentIdx === roundNames.length - 1) {
            // Finale → Turnier beenden
            const finalWinner = winners[0] || null;
            let winnerNpub = null;
            if (finalWinner) {
              const { data: profile } = await supabase
                .from('profiles').select('npub')
                .ilike('username', finalWinner).maybeSingle();
              winnerNpub = profile?.npub || null;
            }

            await supabase.from('tournaments').update({
              status: 'finished', finished_at: nowIso,
              winner: finalWinner, winner_npub: winnerNpub,
            }).eq('id', match.tournament_id);

            // Bracket-Ranking für Preise
            const ranked = [];
            const placed = new Set();
            for (let r = roundNames.length - 1; r >= 0; r--) {
              const rm = allMatches.filter(m => m.round_name === roundNames[r]);
              rm.forEach(m => {
                if (m.winner && !placed.has(m.winner.toLowerCase())) {
                  ranked.push({ name: m.winner, key: m.winner.toLowerCase(), played: true });
                  placed.add(m.winner.toLowerCase());
                }
              });
              rm.forEach(m => {
                const loser = m.winner === m.player1 ? m.player2 : m.player1;
                if (loser && !placed.has(loser.toLowerCase())) {
                  ranked.push({ name: loser, key: loser.toLowerCase(), played: true });
                  placed.add(loser.toLowerCase());
                }
              });
            }
            await assignPrizesToWinners(match.tournament_id, ranked);

          } else if (currentIdx < roundNames.length - 1) {
            // Nächste Runde vorbereiten
            const nextRound = roundNames[currentIdx + 1];
            const nextMatches = allMatches.filter(m => m.round_name === nextRound);

            const { data: tournament } = await supabase
              .from('tournaments').select('round_deadline_hours, questions_per_round')
              .eq('id', match.tournament_id).single();

            const qPerRound = tournament?.questions_per_round || {};
            const numQ = qPerRound[nextRound] || 5;

            for (let i = 0; i < nextMatches.length; i++) {
              const p1 = winners[i * 2] || null;
              const p2 = winners[i * 2 + 1] || null;

              // Einfache Fragen-IDs (zufällig)
              const { data: qIds } = await supabase
                .from('questions').select('id').limit(200);
              const shuffled = (qIds || []).sort(() => 0.5 - Math.random());
              const questionIds = shuffled.slice(0, numQ).map(q => q.id);

              await supabase
                .from('tournament_bracket_matches')
                .update({
                  player1: p1, player2: p2,
                  questions: questionIds,
                  status: (p1 && p2) ? 'ready' : (p1 || p2) ? 'finished' : 'pending',
                  winner: (p1 && !p2) ? p1 : (!p1 && p2) ? p2 : null,
                  finished_at: (p1 && !p2) || (!p1 && p2) ? nowIso : null,
                  deadline_at: new Date(
                    Date.now() + (tournament?.round_deadline_hours || 24) * 3600000
                  ).toISOString(),
                })
                .eq('id', nextMatches[i].id);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Bracket finalization error:', e);
    errors += 1;
  }

  return new Response(JSON.stringify({
    ok: true,
    highscoreFinalized,
    bracketMatchesFinalized,
    errors,
    timestamp: nowIso,
  }), { status: 200 });
});