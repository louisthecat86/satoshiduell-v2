import { createClient } from '@supabase/supabase-js';

// --- KONFIGURATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// HILFSFUNKTIONEN
// ==========================================

// 1. Hashing (SHA-256)
async function hashPin(pin) {
  const msgBuffer = new TextEncoder().encode(String(pin).trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 2. Normalisierung (Erzwingt Kleinschreibung)
const toLower = (str) => (str ? str.toLowerCase().trim() : null);


// ==========================================
// 1. SPIELER LOGIK (AUTH - PROFILES)
// ==========================================

// Profil laden
export const getPlayerByName = async (name) => {
  const cleanName = toLower(name);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', cleanName)
    .limit(1)
    .maybeSingle();
  
  return { data, error };
};

// Profil über Nostr npub laden
export const getPlayerByNpub = async (npub) => {
  const cleanNpub = toLower(npub);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('npub', cleanNpub)
    .limit(1)
    .maybeSingle();

  return { data, error };
};

// Neuen Spieler erstellen
export const createPlayer = async (name, pin) => {
  const cleanName = toLower(name); 

  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', cleanName)
    .maybeSingle();

  if (existing) {
    return { data: null, error: { code: '23505', message: 'Name bereits vergeben' } };
  }

  const hashedPin = await hashPin(pin);

  const { data, error } = await supabase
    .from('profiles')
    .insert([{ 
        username: cleanName, 
        pin: hashedPin,
        total_sats_won: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        games_played: 0,
        avatar: null
    }]) 
    .select()
    .single();

  return { data, error };
};

// Neuen Spieler mit Nostr npub erstellen (ohne PIN)
export const createPlayerWithNpub = async (name, npub) => {
  const cleanName = toLower(name);
  const cleanNpub = toLower(npub);

  const randomPin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const hashedPin = await hashPin(randomPin);

  const { data: existingName } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', cleanName)
    .maybeSingle();

  if (existingName) {
    return { data: null, error: { code: '23505', message: 'Name bereits vergeben' } };
  }

  const { data: existingNpub } = await supabase
    .from('profiles')
    .select('username')
    .eq('npub', cleanNpub)
    .maybeSingle();

  if (existingNpub) {
    return { data: null, error: { code: '23505', message: 'npub bereits verknüpft' } };
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert([{ 
        username: cleanName, 
        npub: cleanNpub,
        pin: hashedPin,
        total_sats_won: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        games_played: 0,
        avatar: null
    }]) 
    .select()
    .single();

  return { data, error };
};

// Login prüfen
export const verifyLogin = async (name, pin) => {
  const cleanName = toLower(name); 
  
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', cleanName)
    .limit(1)
    .maybeSingle();

  if (error || !user) return { data: null, error: { message: "User nicht gefunden" } };

  const inputHash = await hashPin(pin);
  
  if (user.pin === inputHash || String(user.pin) === String(pin).trim()) {
    return { data: user, error: null };
  } else {
    return { data: null, error: { message: "Falsche PIN" } };
  }
};

// ==========================================
// 2. SPIEL LOGIK (Core)
// ==========================================

// A. Neues Duell anlegen
export const createDuelEntry = async (creatorName, amount, targetPlayer = null, questionsData = null) => {
  const cleanCreator = toLower(creatorName);
  const cleanTarget = toLower(targetPlayer);

  console.log(`📝 Erstelle Duell: ${cleanCreator} vs ${cleanTarget || 'Alle'}`);

  let questions = questionsData;
  if (!questions || questions.length === 0) {
      questions = [{ q: "Error", a: ["1","2","3","4"], c: 0 }];
  }

  const { data, error } = await supabase
    .from('duels')
    .insert([{ 
      creator: cleanCreator, 
      status: 'pending_payment', 
      amount: parseInt(amount),  
      current_pot: 0,
      questions: questions,
      target_player: cleanTarget
    }])
    .select()
    .single();

  return { data, error };
};

// A2. Neues Arena-Spiel anlegen
export const createArenaEntry = async (creatorName, amount, maxPlayers = 2, questionsData = null) => {
  const cleanCreator = toLower(creatorName);

  let questions = questionsData;
  if (!questions || questions.length === 0) {
      questions = [{ q: "Error", a: ["1","2","3","4"], c: 0 }];
  }

  const { data, error } = await supabase
    .from('duels')
    .insert([{ 
      creator: cleanCreator,
      status: 'pending_payment',
      amount: parseInt(amount),
      current_pot: 0,
      questions: questions,
      target_player: null,
      mode: 'arena',
      max_players: maxPlayers,
      participants: [cleanCreator],
      participant_scores: {},
      participant_times: {}
    }])
    .select()
    .single();

  return { data, error };
};

// B. Offene Duelle laden
export const fetchOpenDuels = async (myPlayerName) => {
  const cleanMe = toLower(myPlayerName);
  
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'open')
    .neq('creator', cleanMe)
    .or(`target_player.is.null,target_player.eq.${cleanMe}`)
    .order('created_at', { ascending: false });

  return { data, error };
};

// C. Anzahl offener Duelle zählen
export const getOpenDuelCount = async (myPlayerName) => {
  const cleanMe = toLower(myPlayerName);
  
  const { count, error } = await supabase
    .from('duels')
    .select('*', { count: 'exact', head: true }) 
    .eq('status', 'open')
    .neq('creator', cleanMe)
    .is('target_player', null);

  if (error) return 0;
  return count || 0;
};

// D. Duell beitreten
export const joinDuel = async (duelId, challengerName) => {
  const cleanChallenger = toLower(challengerName);
  console.log(`⚔️ ${cleanChallenger} tritt bei.`);
  
  const { data, error } = await supabase
    .from('duels')
    .update({ 
      challenger: cleanChallenger,
      status: 'active' 
    })
    .eq('id', duelId)
    .select()
    .single();

  return { data, error };
};

// D2. Arena beitreten
export const joinArena = async (duelId, playerName) => {
  const cleanPlayer = toLower(playerName);

  const { data: game, error: loadError } = await supabase
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .single();

  if (loadError || !game) return { data: null, error: loadError };

  const participants = Array.isArray(game.participants) ? game.participants : [];
  if (participants.includes(cleanPlayer)) return { data: game, error: null };

  if (game.max_players && participants.length >= game.max_players) {
    return { data: null, error: { message: 'Arena voll' } };
  }

  const updatedParticipants = [...participants, cleanPlayer];
  const nextStatus = game.max_players && updatedParticipants.length >= game.max_players ? 'active' : game.status;

  const { data, error } = await supabase
    .from('duels')
    .update({ participants: updatedParticipants, status: nextStatus })
    .eq('id', duelId)
    .select()
    .single();

  return { data, error };
};

// E. Spiel aktivieren
export const activateDuel = async (duelId) => {
  const { data, error } = await supabase
    .from('duels')
    .update({ status: 'open' })
    .eq('id', duelId)
    .select()
    .single();

  return { data, error };
};

// F. Ergebnisse speichern
export const submitGameResult = async (gameId, role, score, time) => {
  const updateData = {};
  if (role === 'creator') {
    updateData.creator_score = score;
    updateData.creator_time = time;
  } else {
    updateData.challenger_score = score;
    updateData.challenger_time = time;
  }

  const { data: game, error } = await supabase
    .from('duels')
    .update(updateData)
    .eq('id', gameId)
    .select()
    .single();

  if (error) return { data: null, error };

  if (game.creator_score !== null && game.challenger_score !== null) {
      console.log("🏁 Spiel beendet.");
      const { data: finishedGame, error: finishError } = await supabase
        .from('duels')
        .update({ status: 'finished' })
        .eq('id', gameId)
        .select()
        .single();
      
      return { data: finishedGame, error: finishError };
  }

  return { data: game, error: null };
};

// F2. Arena-Ergebnis speichern
export const submitArenaResult = async (gameId, playerName, score, time) => {
  const cleanPlayer = toLower(playerName);

  const { data: game, error: loadError } = await supabase
    .from('duels')
    .select('*')
    .eq('id', gameId)
    .single();

  if (loadError || !game) return { data: null, error: loadError };

  const scores = { ...(game.participant_scores || {}) };
  const times = { ...(game.participant_times || {}) };

  scores[cleanPlayer] = score;
  times[cleanPlayer] = time;

  const participants = Array.isArray(game.participants) ? game.participants : [];
  const hasAllScores = participants.length > 0 && participants.every(p => scores[p] !== undefined && scores[p] !== null);

  let updatePayload = { participant_scores: scores, participant_times: times };

  if (game.max_players && participants.length >= game.max_players && hasAllScores) {
    // Winner bestimmen
    let winner = null;
    participants.forEach(p => {
      if (!winner) {
        winner = p;
        return;
      }
      const ws = scores[winner];
      const wt = times[winner];
      const cs = scores[p];
      const ct = times[p];
      if (cs > ws || (cs === ws && ct < wt)) winner = p;
    });

    updatePayload = { ...updatePayload, status: 'finished', winner };
  }

  const { data, error } = await supabase
    .from('duels')
    .update(updatePayload)
    .eq('id', gameId)
    .select()
    .single();

  return { data, error };
};

// G. Status abrufen
export const getGameStatus = async (gameId) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('id', gameId)
    .single();
  return { data, error };
};

// H. User Games laden
export const fetchUserGames = async (playerName) => {
  const cleanMe = toLower(playerName);
  const filter = `creator.eq.${cleanMe},challenger.eq.${cleanMe},target_player.eq.${cleanMe}`;

  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .or(filter)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return { data, error };

  try {
    const usernames = Array.from(new Set(data.flatMap(g => [g.creator, g.challenger]).filter(Boolean)));
    if (usernames.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('username, avatar')
        .in('username', usernames);
      
      const profileMap = {};
      profiles?.forEach(p => {
          if(p.username) profileMap[p.username.toLowerCase()] = p.avatar || null;
      });

      const enriched = data.map(g => ({
        ...g,
        creatorAvatar: profileMap[(g.creator || "").toLowerCase()] || null,
        challengerAvatar: profileMap[(g.challenger || "").toLowerCase()] || null
      }));

      return { data: enriched, error: null };
    }
  } catch (e) {
    console.error('Error enriching games:', e);
  }

  return { data, error };
};

// I. Gewinn abholen
export const markGameAsClaimed = async (gameId, payoutAmount = null, donationAmount = null) => {
  const updateData = { is_claimed: true, claimed: true };
  if (payoutAmount !== null) updateData.payout_amount = payoutAmount;
  if (donationAmount !== null) updateData.donation_amount = donationAmount;

  const { data, error } = await supabase
    .from('duels')
    .update(updateData)
    .eq('id', gameId)
    .select()
    .single();

  return { data, error };
};

// ==========================================
// 3. STATISTIK & HISTORY
// ==========================================

export const fetchUserHistory = async (username) => {
  const cleanMe = toLower(username);
  const filter = `creator.eq.${cleanMe},challenger.eq.${cleanMe}`;
  const { data: standard, error: standardError } = await supabase
    .from('duels')
    .select('*')
    .or(filter)
    .order('created_at', { ascending: false });

  const { data: arena, error: arenaError } = await supabase
    .from('duels')
    .select('*')
    .eq('mode', 'arena')
    .contains('participants', [cleanMe])
    .order('created_at', { ascending: false });

  if (standardError || arenaError) return { data: standard || arena || [], error: standardError || arenaError };

  const merged = [...(standard || []), ...(arena || [])];
  return { data: merged, error: null };
};

export const recalculateUserStats = async (username) => {
  const cleanMe = toLower(username);
  const filter = `creator.eq.${cleanMe},challenger.eq.${cleanMe}`;
  const { data: duels, error } = await supabase
    .from('duels')
    .select('*')
    .or(filter)
    .eq('status', 'finished');

  const { data: arenas, error: arenaError } = await supabase
    .from('duels')
    .select('*')
    .eq('mode', 'arena')
    .eq('status', 'finished')
    .contains('participants', [cleanMe]);

  if (error || arenaError) {
    console.error('recalculateUserStats: fetch games error', error);
    return null;
  }

  const games = [...(duels || []), ...(arenas || [])];

  let wins = 0, losses = 0, draws = 0, sats = 0;

  games.forEach(g => {
    if (g.mode === 'arena') {
      const winner = g.winner;
      const iWon = winner && winner === cleanMe;
      if (iWon) wins++; else losses++;
      const claimed = g.is_claimed === true || g.claimed === true;
      if (iWon && claimed) {
        const totalPlayers = g.max_players || (g.participants || []).length || 2;
        sats += (g.amount * totalPlayers);
      }
      return;
    }

    const isCreator = g.creator === cleanMe;
    const myScore = isCreator ? g.creator_score : g.challenger_score;
    const opScore = isCreator ? g.challenger_score : g.creator_score;
    const myTime = isCreator ? g.creator_time : g.challenger_time;
    const opTime = isCreator ? g.challenger_time : g.creator_time;

    const iWon = myScore > opScore || (myScore === opScore && myTime < opTime);
    const iLost = opScore > myScore || (myScore === opScore && opTime < myTime);
    const isDraw = myScore === opScore && myTime === opTime;

    if (iWon) wins++;
    else if (iLost) losses++;
    else if (isDraw) draws++;

    // Count sats only when the win was actually claimed
    const claimed = g.is_claimed === true || g.claimed === true;
    if (iWon && claimed) {
      if (g.payout_amount !== null && g.payout_amount !== undefined) {
        sats += g.payout_amount;
      } else {
        sats += (g.amount * 2);
      }
    }
  });

  const stats = {
      games_played: games.length,
      wins, losses, draws,
      total_sats_won: sats,
      last_updated: new Date()
  };

  const { error: updateError } = await supabase
    .from('profiles')
    .update(stats)
    .eq('username', cleanMe);
  if (updateError) {
    console.error('recalculateUserStats: update error', updateError);
    return null;
  }
  return stats;
};

export const fetchLeaderboard = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('total_sats_won', { ascending: false }) 
        .limit(50);
    return { data, error };
};

export const fetchUserProfile = async (username) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', toLower(username))
        .single();
    return { data, error };
};

export const fetchProfiles = async (usernames) => {
    if (!Array.isArray(usernames) || usernames.length === 0) return { data: [], error: null };
    const cleanNames = usernames.map(n => toLower(n));
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('username', cleanNames);
    return { data, error };
};

// ==========================================
// 4. FRAGEN & ADMIN
// ==========================================

export const fetchAllQuestions = async () => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const upsertQuestions = async (questionsArray) => {
  const { data, error } = await supabase
    .from('questions')
    .upsert(questionsArray, { onConflict: 'id' }) 
    .select();
  return { data, error };
};

export const fetchQuestions = async (limit = 500) => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data, error };
};

export const createQuestion = async ({ language = 'de', question, options = [], correct = 0, tags = [], created_at = null }) => {
  const payload = { language, question, options, correct, tags };
  if (created_at) payload.created_at = created_at;
  const { data, error } = await supabase
    .from('questions')
    .insert([payload])
    .select()
    .single();
  return { data, error };
};

export const deleteQuestion = async (id) => {
  const { data, error } = await supabase
    .from('questions')
    .delete()
    .eq('id', id);
  return { data, error };
};

export const deleteAllQuestions = async () => {
  const { data, error } = await supabase
    .from('questions')
    .delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
  return { data, error };
};

export const fetchAllDuels = async (limit = 100) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data, error };
};

export const updateQuestion = async (id, updateData) => {
  const { data, error } = await supabase
    .from('questions')
    .update(updateData)
    .eq('id', id)
    .select();
  return { data, error };
};

export const fetchQuestionById = async (id) => {
  return await supabase.from('questions').select('*').eq('id', id).single();
};

export const fetchQuestionsByCreatedAt = async (date) => {
  return await supabase.from('questions').select('*').eq('created_at', date);
};

export const findQuestionByLanguageAndQuestion = async (lang, q) => {
  return await supabase.from('questions').select('*').eq('language', lang).ilike('question_de', q).maybeSingle();
};

export const deleteQuestionsByCreatedAt = async (date) => {
  return await supabase.from('questions').delete().eq('created_at', date);
};

// ==========================================
// 5. USER SETTINGS
// ==========================================

export const updateUserPin = async (username, newPin) => {
  const hashedPin = await hashPin(newPin);
  const { error } = await supabase
    .from('profiles')
    .update({ pin: hashedPin })
    .eq('username', toLower(username))
    .select();

  return !error;
};

export const uploadUserAvatar = async (username, file) => {
  try {
    const fileExt = file.name.split('.').pop();
    const cleanUsername = toLower(username).replace(/[^a-z0-9]/g, '');
    const fileName = `${cleanUsername}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar: publicUrl })
      .eq('username', toLower(username));

    if (updateError) throw updateError;

    return publicUrl;
  } catch (error) {
    console.error("Avatar Upload Error:", error);
    return null;
  }
};

// ==========================================
// 6. GAME FRAGEN
// ==========================================
export const fetchGameQuestions = async (count = 5, lang = 'de') => {
  console.log(`🎲 Lade ${count} Fragen für Sprache '${lang}'...`);

  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .limit(100);

    if (error || !data || data.length === 0) {
      console.warn("⚠️ Keine Fragen in DB gefunden! Nutze Fallback.", error);
      return [
        { id: 'err1', q: "Fehler: Keine Fragen gefunden", a: ["Ok", "Naja", "Schlecht", "Hilfe"], c: 0 },
        { id: 'err2', q: "Bitte Admin fragen", a: ["Mach ich", "Später", "Nie", "Was?"], c: 0 },
        { id: 'err3', q: "DB leer?", a: ["Ja", "Nein", "Vielleicht", "42"], c: 0 }
      ];
    }

    const shuffled = [...data].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    const gameQuestions = selected.map(q => {
      const text = (lang === 'de' ? q.question_de : null) || 
                   (lang === 'en' ? q.question_en : null) || 
                   (lang === 'es' ? q.question_es : null) || 
                   q.question_de || "Frage ohne Text";

      const answers = [
        (lang === 'de' ? q.option_de_1 : null) || q.option_en_1 || q.option_de_1 || "A",
        (lang === 'de' ? q.option_de_2 : null) || q.option_en_2 || q.option_de_2 || "B",
        (lang === 'de' ? q.option_de_3 : null) || q.option_en_3 || q.option_de_3 || "C",
        (lang === 'de' ? q.option_de_4 : null) || q.option_en_4 || q.option_de_4 || "D"
      ];

      const rawCorrect = q.correct_index ?? 0;
      const normalizedCorrect = rawCorrect >= 0 && rawCorrect <= 3
        ? rawCorrect
        : Math.max(0, Math.min(3, rawCorrect - 1));

      return {
        id: q.id,
        q: text,
        a: answers,
        c: normalizedCorrect
      };
    });

    return gameQuestions;

  } catch (err) {
    console.error("Critical Error in fetchGameQuestions:", err);
    return [{ id: 'crash', q: "Kritischer Fehler", a: ["1", "2", "3", "4"], c: 0 }];
  }
};

// ==========================================
// 7. SUBMISSIONS (DER FEHLENDE TEIL)
// ==========================================

export const fetchSubmissions = async () => {
  const { data, error } = await supabase
    .from('question_submissions')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const createSubmission = async ({ submitter, language = 'de', question, options = [], correct = 0, comment = '' }) => {
  const answerText = Array.isArray(options) && options.length > 0
    ? (options[correct] || options[0])
    : null;

  const payload = { submitter, language, question, options, correct, answer: answerText };
  if (comment && comment.trim().length > 0) payload.comment = comment;

  const { data, error } = await supabase
    .from('question_submissions')
    .insert([payload])
    .select()
    .single();
  return { data, error };
};

export const updateSubmissionStatus = async (id, status) => {
  const { data, error } = await supabase
    .from('question_submissions')
    .update({ status, processed_at: new Date() })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
};

export const deleteSubmission = async (id) => {
  const { data, error } = await supabase
    .from('question_submissions')
    .delete()
    .eq('id', id);
  return { data, error };
};