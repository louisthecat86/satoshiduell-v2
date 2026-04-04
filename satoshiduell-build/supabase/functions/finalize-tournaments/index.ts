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

const isPowerOf2 = (n) => n > 0 && (n & (n - 1)) === 0;

const nextLowerPowerOf2 = (n) => {
  if (n <= 2) return 2;
  let p = 2;
  while (p * 2 < n) p *= 2;
  return p;
};

const getRoundsForSize = (maxPlayers) => {
  switch (maxPlayers) {
    case 4:   return ['semi', 'final'];
    case 8:   return ['quarter', 'semi', 'final'];
    case 16:  return ['round_of_16', 'quarter', 'semi', 'final'];
    case 32:  return ['round_of_32', 'round_of_16', 'quarter', 'semi', 'final'];
    case 64:  return ['round_of_64', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'final'];
    case 128: return ['round_of_128', 'round_of_64', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'final'];
    default:  return ['semi', 'final'];
  }
};

const getDefaultQuestionsPerRound = (maxPlayers) => {
  switch (maxPlayers) {
    case 4:   return { semi: 5, final: 10 };
    case 8:   return { quarter: 5, semi: 7, final: 10 };
    case 16:  return { round_of_16: 5, quarter: 5, semi: 7, final: 10 };
    case 32:  return { round_of_32: 3, round_of_16: 5, quarter: 5, semi: 7, final: 10 };
    case 64:  return { round_of_64: 3, round_of_32: 3, round_of_16: 5, quarter: 5, semi: 7, final: 10 };
    case 128: return { round_of_128: 3, round_of_64: 3, round_of_32: 3, round_of_16: 5, quarter: 5, semi: 7, final: 10 };
    default:  return { semi: 5, final: 10 };
  }
};

const deduplicateParticipants = (participants) => {
  const seen = new Set();
  return (participants || []).filter(p => {
    const key = (p || '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const shuffleArray = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

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

const fetchQuestionIds = async (count = 5) => {
  const { data } = await supabase.from('questions').select('id').limit(200);
  if (!data || data.length === 0) return [];
  const shuffled = [...data].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(row => row.id);
};

// ============================================
// BRACKET GENERATION (für Auto-Start)
// ============================================

const generateBracketMatchesForTournament = async (tournament) => {
  const participants = shuffleArray(tournament.participants || []);
  const rounds = getRoundsForSize(tournament.max_players);
  const qPerRound = tournament.questions_per_round || getDefaultQuestionsPerRound(tournament.max_players);
  const firstRound = rounds[0];
  const numFirstRoundMatches = Math.floor(participants.length / 2);
  const numQ = qPerRound[firstRound] || 5;

  const totalQNeeded = numQ * numFirstRoundMatches;
  const questionIds = await fetchQuestionIds(totalQNeeded);

  const matches = [];

  for (let i = 0; i < numFirstRoundMatches; i++) {
    const p1 = participants[i * 2] || null;
    const p2 = participants[i * 2 + 1] || null;
    const matchQuestions = questionIds.slice(i * numQ, (i + 1) * numQ);

    matches.push({
      tournament_id: tournament.id,
      round_name: firstRound,
      match_index: i,
      player1: p1,
      player2: p2,
      questions: matchQuestions,
      status: (p1 && p2) ? 'ready' : 'finished',
      winner: (!p2 && p1) ? p1 : null,
      deadline_at: new Date(
        Date.now() + (tournament.round_deadline_hours || 24) * 3600000
      ).toISOString(),
    });
  }

  let prevCount = numFirstRoundMatches;
  for (let r = 1; r < rounds.length; r++) {
    const roundCount = Math.max(1, Math.floor(prevCount / 2));
    for (let i = 0; i < roundCount; i++) {
      matches.push({
        tournament_id: tournament.id,
        round_name: rounds[r],
        match_index: i,
        player1: null,
        player2: null,
        questions: null,
        status: 'pending',
      });
    }
    prevCount = roundCount;
  }

  await supabase.from('tournament_bracket_matches').insert(matches);
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
  let bracketAutoStarted = 0;
  let qualifyingFinalized = 0;
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
      .neq('status', 'archived')
      .lte('play_until', nowIso);

    for (const tournament of expiredHighscore || []) {
      if (tournament.status !== 'active') continue;

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

      if (updateError) { errors += 1; continue; }

      await assignPrizesToWinners(tournament.id, ranked);

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
  // 2. BRACKET-TURNIERE: REGISTRIERUNG ABGELAUFEN → AUTO-START
  // ============================================
  try {
    const { data: expiredBracketReg } = await supabase
      .from('tournaments')
      .select('*')
      .eq('format', 'bracket')
      .eq('status', 'registration')
      .not('play_until', 'is', null)
      .lte('play_until', nowIso);

    for (const tournament of expiredBracketReg || []) {
      const participants = deduplicateParticipants(
        Array.isArray(tournament.participants) ? tournament.participants : []
      );

      if (participants.length < 2) {
        // Zu wenig → abbrechen
        await supabase.from('tournaments')
          .update({ status: 'cancelled', participants, current_participants: participants.length })
          .eq('id', tournament.id);
        continue;
      }

      const updates = {
        participants,
        current_participants: participants.length,
        started_at: nowIso,
      };

      if (isPowerOf2(participants.length)) {
        // Direkt Bracket
        updates.status = 'active';
        updates.max_players = participants.length;
        updates.questions_per_round = tournament.questions_per_round || getDefaultQuestionsPerRound(participants.length);
      } else {
        // Qualifying
        const target = nextLowerPowerOf2(participants.length);
        const qualiQuestionCount = tournament.qualifying_question_count || tournament.question_count || 5;
        const questionIds = await fetchQuestionIds(qualiQuestionCount);

        updates.status = 'qualifying';
        updates.qualifying_target = target;
        updates.question_count = qualiQuestionCount;
        updates.questions = questionIds;
      }

      const { data: updated, error: updateError } = await supabase
        .from('tournaments')
        .update(updates)
        .eq('id', tournament.id)
        .select()
        .single();

      if (updateError) { errors += 1; continue; }

      // Bei direktem Bracket → Matches generieren
      if (updated?.status === 'active') {
        await generateBracketMatchesForTournament(updated);
      }

      bracketAutoStarted += 1;
    }
  } catch (e) {
    console.error('Bracket auto-start error:', e);
    errors += 1;
  }

  // ============================================
  // 3. QUALIFYING: AUTO-FINALISIERUNG WENN ALLE GESPIELT
  // ============================================
  try {
    const { data: qualifyingTournaments } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'qualifying');

    for (const tournament of qualifyingTournaments || []) {
      const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
      const scores = tournament.participant_scores || {};
      const normalizedParticipants = participants.map(p => (p || '').toLowerCase());

      const allPlayed = normalizedParticipants.length > 0
        && normalizedParticipants.every(p => scores[p] !== undefined && scores[p] !== null);

      if (!allPlayed) continue;

      const target = tournament.qualifying_target;
      if (!target) continue;

      const times = tournament.participant_times || {};
      const ranked = buildRankedList(participants, scores, times);
      const playedRanked = ranked.filter(r => r.played);

      // Tatsächliche Bracket-Größe: nächste kleinere 2er-Potenz
      const availablePlayers = Math.min(playedRanked.length, target);
      const bracketSize = isPowerOf2(availablePlayers) ? availablePlayers : nextLowerPowerOf2(availablePlayers);
      const qualified = playedRanked.slice(0, bracketSize).map(r => r.name);

      if (qualified.length < 2) continue;

      const { data: updated, error: updateError } = await supabase
        .from('tournaments')
        .update({
          participants: qualified,
          current_participants: qualified.length,
          max_players: bracketSize,
          status: 'active',
          participant_scores: {},
          participant_times: {},
          questions: null,
          questions_per_round: tournament.questions_per_round || getDefaultQuestionsPerRound(bracketSize),
        })
        .eq('id', tournament.id)
        .select()
        .single();

      if (updateError) { errors += 1; continue; }

      if (updated) {
        await generateBracketMatchesForTournament(updated);
      }

      qualifyingFinalized += 1;
    }
  } catch (e) {
    console.error('Qualifying finalization error:', e);
    errors += 1;
  }

  // ============================================
  // 4. BRACKET-MATCHES MIT ABGELAUFENER DEADLINE
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
        winner = match.player1;
      }

      await supabase
        .from('tournament_bracket_matches')
        .update({ status: 'finished', finished_at: nowIso, winner })
        .eq('id', match.id);

      bracketMatchesFinalized += 1;

      // Prüfen ob Runde komplett → nächste Runde vorbereiten
      const { data: allRoundMatches } = await supabase
        .from('tournament_bracket_matches')
        .select('*')
        .eq('tournament_id', match.tournament_id)
        .eq('round_name', match.round_name);

      const allDone = (allRoundMatches || []).every(m => m.status === 'finished');
      if (allDone) {
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

              const questionIds = await fetchQuestionIds(numQ);
              const isBye = (p1 && !p2) || (!p1 && p2);

              await supabase
                .from('tournament_bracket_matches')
                .update({
                  player1: p1, player2: p2,
                  questions: questionIds,
                  status: (p1 && p2) ? 'ready' : isBye ? 'finished' : 'pending',
                  winner: (p1 && !p2) ? p1 : (!p1 && p2) ? p2 : null,
                  finished_at: isBye ? nowIso : null,
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
    bracketAutoStarted,
    qualifyingFinalized,
    bracketMatchesFinalized,
    errors,
    timestamp: nowIso,
  }), { status: 200 });
});