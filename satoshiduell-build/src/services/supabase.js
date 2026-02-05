import { createClient } from '@supabase/supabase-js';

// --- KONFIGURATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// HILFSFUNKTIONEN
// ==========================================

// 1. Hashing (SHA-256)
async function hashValue(value) {
  const msgBuffer = new TextEncoder().encode(String(value).trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin) {
  return hashValue(pin);
}

async function hashToken(token) {
  return hashValue(token);
}

const generateToken = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `T-${hex}`;
};

const generateShortToken = (length = 10) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => alphabet[b % alphabet.length]).join('');
};

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
    .is('target_player', null)
    .neq('mode', 'arena');

  if (error) return 0;

  const { data: arenaData, error: arenaError } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'open')
    .eq('mode', 'arena');

  if (arenaError) return count || 0;

  const arenaCount = (arenaData || []).filter(game => {
    const participants = Array.isArray(game.participants) ? game.participants : [];
    const maxPlayers = game.max_players || 2;
    const alreadyJoined = participants.some(p => toLower(p) === cleanMe);
    const refundClaimed = game.refund_claimed || {};
    const alreadyRefunded = Boolean(refundClaimed[cleanMe]);
    return participants.length < maxPlayers && !alreadyJoined && !alreadyRefunded;
  }).length;

  return (count || 0) + arenaCount;
};

// D. Duell beitreten
export const joinDuel = async (duelId, challengerName) => {
  const cleanChallenger = toLower(challengerName);
  console.log(`⚔️ ${cleanChallenger} tritt bei.`);
  
  const { data, error } = await supabase
    .from('duels')
    .update({ 
      challenger: cleanChallenger,
      status: 'active',
      challenger_paid_at: new Date().toISOString()
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

  const refundClaimed = game.refund_claimed || {};
  if (refundClaimed[cleanPlayer]) {
    return { data: null, error: { message: 'Refund bereits gezogen' } };
  }

  if (game.max_players && participants.length >= game.max_players) {
    return { data: null, error: { message: 'Arena voll' } };
  }

  const updatedParticipants = [...participants, cleanPlayer];
  const nextStatus = game.max_players && updatedParticipants.length >= game.max_players ? 'active' : game.status;
  const paidAtMap = { ...(game.participant_paid_at || {}) };
  paidAtMap[cleanPlayer] = new Date().toISOString();

  const { data, error } = await supabase
    .from('duels')
    .update({ participants: updatedParticipants, status: nextStatus, participant_paid_at: paidAtMap })
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

export const recordCreatorPayment = async (duelId, creatorName, mode = 'duel') => {
  const timestamp = new Date().toISOString();
  if (mode === 'arena') {
    const cleanCreator = toLower(creatorName);
    const { data: game, error: loadError } = await supabase
      .from('duels')
      .select('participant_paid_at')
      .eq('id', duelId)
      .single();

    if (loadError || !game) return { data: null, error: loadError };

    const paidAtMap = { ...(game.participant_paid_at || {}) };
    paidAtMap[cleanCreator] = timestamp;

    const { data, error } = await supabase
      .from('duels')
      .update({ participant_paid_at: paidAtMap })
      .eq('id', duelId)
      .select()
      .single();

    return { data, error };
  }

  const { data, error } = await supabase
    .from('duels')
    .update({ creator_paid_at: timestamp })
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

  const { data: standard, error: standardError } = await supabase
    .from('duels')
    .select('*')
    .or(filter)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: allArena, error: arenaError } = await supabase
    .from('duels')
    .select('*')
    .eq('mode', 'arena')
    .order('created_at', { ascending: false });

  const arena = (allArena || []).filter(game => {
    const participants = game.participants || [];
    return participants.some(p => toLower(p) === cleanMe);
  });

  const merged = [...(standard || []), ...arena];
  const unique = merged.filter((game, index, self) =>
    index === self.findIndex(g => g.id === game.id)
  );

  if (standardError || arenaError) return { data: unique, error: standardError || arenaError };
  if (!unique || unique.length === 0) return { data: unique, error: null };

  try {
    const usernames = Array.from(new Set(unique.flatMap(g => [g.creator, g.challenger]).filter(Boolean)));
    if (usernames.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('username, avatar')
        .in('username', usernames);
      
      const profileMap = {};
      profiles?.forEach(p => {
          if(p.username) profileMap[p.username.toLowerCase()] = p.avatar || null;
      });

      const enriched = unique.map(g => ({
        ...g,
        creatorAvatar: profileMap[(g.creator || "").toLowerCase()] || null,
        challengerAvatar: profileMap[(g.challenger || "").toLowerCase()] || null
      }));

      return { data: enriched, error: null };
    }
  } catch (e) {
    console.error('Error enriching games:', e);
  }

  return { data: unique, error: null };
};

// I. Gewinn abholen
export const markGameAsClaimed = async (gameId, payoutAmount = null, donationAmount = null) => {
  const updateData = { is_claimed: true, claimed: true };
  if (payoutAmount !== null) updateData.payout_amount = payoutAmount;
  if (donationAmount !== null) updateData.donation_amount = donationAmount;

  console.log('markGameAsClaimed called:', { gameId, updateData });

  const { data, error } = await supabase
    .from('duels')
    .update(updateData)
    .eq('id', gameId)
    .select()
    .single();

  console.log('markGameAsClaimed result:', { data, error });

  return { data, error };
};

export const markRefundAsClaimed = async (gameId) => {
  const { data, error } = await supabase
    .from('duels')
    .update({ is_claimed: true, claimed: true })
    .eq('id', gameId)
    .select()
    .single();

  return { data, error };
};

export const markArenaRefundClaimed = async (gameId, userName) => {
  const cleanUser = toLower(userName);
  const { data: game, error: loadError } = await supabase
    .from('duels')
    .select('refund_claimed')
    .eq('id', gameId)
    .single();

  if (loadError || !game) return { data: null, error: loadError };

  const refundClaimed = { ...(game.refund_claimed || {}) };
  refundClaimed[cleanUser] = true;

  const { data, error } = await supabase
    .from('duels')
    .update({ refund_claimed: refundClaimed })
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
  
  // Standard Duels (creator oder challenger) - OHNE Arena-Spiele
  const filter = `creator.eq.${cleanMe},challenger.eq.${cleanMe}`;
  const { data: standard, error: standardError } = await supabase
    .from('duels')
    .select('*')
    .or(filter)
    .neq('mode', 'arena') // Explizit Arena-Spiele ausschließen
    .order('created_at', { ascending: false });

  // Arena Spiele - suche nach username in participants array (case-insensitive)
  const { data: allArena, error: arenaError } = await supabase
    .from('duels')
    .select('*')
    .eq('mode', 'arena')
    .order('created_at', { ascending: false });

  // Filter Arena games client-side (da PostgreSQL contains case-sensitive ist)
  const arena = (allArena || []).filter(game => {
    const participants = game.participants || [];
    return participants.some(p => toLower(p) === cleanMe);
  });

  if (standardError || arenaError) return { data: standard || arena || [], error: standardError || arenaError };

  const merged = [...(standard || []), ...arena];
  // Remove duplicates based on ID (falls doch welche durchkommen)
  const unique = merged.filter((game, index, self) => 
    index === self.findIndex(g => g.id === game.id)
  );
  
  // Sortiere nach created_at
  unique.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return { data: unique, error: null };
};

export const recalculateUserStats = async (username) => {
  const cleanMe = toLower(username);
  const filter = `creator.eq.${cleanMe},challenger.eq.${cleanMe}`;
  const { data: duels, error } = await supabase
    .from('duels')
    .select('*')
    .or(filter)
    .eq('status', 'finished');

  // Arena Spiele - alle laden und client-seitig filtern (wegen case-sensitivity)
  const { data: allArenas, error: arenaError } = await supabase
    .from('duels')
    .select('*')
    .eq('mode', 'arena')
    .eq('status', 'finished');

  // Filter Arena games client-side (case-insensitive)
  const arenas = (allArenas || []).filter(game => {
    const participants = game.participants || [];
    return participants.some(p => toLower(p) === cleanMe);
  });

  if (error || arenaError) {
    console.error('recalculateUserStats: fetch games error', error);
    return null;
  }

  const games = [...(duels || []), ...arenas];

  let wins = 0, losses = 0, draws = 0, sats = 0;

  games.forEach(g => {
    if (g.mode === 'arena') {
      const winner = g.winner;
      // Case-insensitive Vergleich für Arena-Gewinner
      const iWon = winner && toLower(winner) === cleanMe;
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

export const deleteDuel = async (id) => {
  const { data, error } = await supabase
    .from('duels')
    .delete()
    .eq('id', id)
    .select();
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

export const uploadTournamentImage = async (tournamentId, file) => {
  if (!tournamentId || !file) return { url: null, path: null };

  const fileExt = file.name.split('.').pop();
  const safeId = String(tournamentId).replace(/[^a-z0-9_-]/gi, '');
  const fileName = `tournaments/${safeId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('tournament-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('tournament-images').getPublicUrl(fileName);
  return { url: data.publicUrl, path: fileName };
};

export const getTournamentImageUrl = (imagePath) => {
  if (!imagePath) return null;
  const { data } = supabase.storage.from('tournament-images').getPublicUrl(imagePath);
  return data?.publicUrl || null;
};

export const deleteTournamentImage = async (imagePath) => {
  if (!imagePath) return;
  await supabase.storage.from('tournament-images').remove([imagePath]);
};

// ==========================================
// 6. GAME FRAGEN
// ==========================================
const QUESTION_SELECT_FIELDS = 'id, question_de, question_en, question_es, option_de_1, option_de_2, option_de_3, option_de_4, option_en_1, option_en_2, option_en_3, option_en_4, option_es_1, option_es_2, option_es_3, option_es_4, correct_index';
const mapQuestionRowToGameQuestion = (row, lang = 'de') => {
  const text = (lang === 'de' ? row.question_de : null)
    || (lang === 'en' ? row.question_en : null)
    || (lang === 'es' ? row.question_es : null)
    || row.question_de
    || row.question_en
    || row.question_es
    || 'Frage ohne Text';

  const answers = [
    (lang === 'de' ? row.option_de_1 : null)
      || (lang === 'en' ? row.option_en_1 : null)
      || (lang === 'es' ? row.option_es_1 : null)
      || row.option_de_1
      || row.option_en_1
      || row.option_es_1
      || 'A',
    (lang === 'de' ? row.option_de_2 : null)
      || (lang === 'en' ? row.option_en_2 : null)
      || (lang === 'es' ? row.option_es_2 : null)
      || row.option_de_2
      || row.option_en_2
      || row.option_es_2
      || 'B',
    (lang === 'de' ? row.option_de_3 : null)
      || (lang === 'en' ? row.option_en_3 : null)
      || (lang === 'es' ? row.option_es_3 : null)
      || row.option_de_3
      || row.option_en_3
      || row.option_es_3
      || 'C',
    (lang === 'de' ? row.option_de_4 : null)
      || (lang === 'en' ? row.option_en_4 : null)
      || (lang === 'es' ? row.option_es_4 : null)
      || row.option_de_4
      || row.option_en_4
      || row.option_es_4
      || 'D'
  ];

  const rawCorrect = row.correct_index ?? 0;
  const normalizedCorrect = rawCorrect >= 0 && rawCorrect <= 3
    ? rawCorrect
    : Math.max(0, Math.min(3, rawCorrect - 1));

  return {
    id: row.id,
    q: text,
    a: answers,
    c: normalizedCorrect
  };
};

export const fetchQuestionIds = async (count = 5) => {
  const { data, error } = await supabase
    .from('questions')
    .select('id')
    .limit(200);

  if (error || !data || data.length === 0) {
    return { data: [], error: error || new Error('Keine Fragen gefunden') };
  }

  const shuffled = [...data].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count).map(row => row.id);
  return { data: selected, error: null };
};

export const fetchQuestionsByIds = async (ids = [], lang = 'de') => {
  const cleanIds = (ids || []).filter(Boolean);
  if (cleanIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('questions')
    .select(QUESTION_SELECT_FIELDS)
    .in('id', cleanIds);

  if (error || !data) return { data: [], error };

  const byId = new Map(data.map(row => [String(row.id), row]));
  const mapped = cleanIds
    .map(id => byId.get(String(id)))
    .filter(Boolean)
    .map(row => mapQuestionRowToGameQuestion(row, lang));

  return { data: mapped, error: null };
};

export const fetchGameQuestions = async (count = 5, lang = 'de') => {
  console.log(`🎲 Lade ${count} Fragen für Sprache '${lang}'...`);

  try {
    const { data, error } = await supabase
      .from('questions')
      .select(QUESTION_SELECT_FIELDS)
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
    return selected.map(row => mapQuestionRowToGameQuestion(row, lang));

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

// ==========================================
// TOURNAMENT CREATOR PERMISSIONS
// ==========================================

export const updatePlayerCanCreateTournament = async (username, canCreate) => {
  const cleanName = toLower(username);
  const { data, error } = await supabase
    .from('profiles')
    .update({ can_create_tournaments: canCreate })
    .eq('username', cleanName)
    .select()
    .single();
  return { data, error };
};

export const fetchPlayersForTournamentPermission = async () => {
  // Fetch all players with username and handle can_create_tournaments gracefully
  const { data, error } = await supabase
    .from('profiles')
    .select('username, can_create_tournaments')
    .order('username', { ascending: true });
  
  // If error is about unknown column, return data without the column
  if (error && error.message.includes('can_create_tournaments')) {
    const { data: fallbackData } = await supabase
      .from('profiles')
      .select('username')
      .order('username', { ascending: true });
    
    // Add default can_create_tournaments as false
    return { 
      data: fallbackData?.map(p => ({ ...p, can_create_tournaments: false })) || [],
      error: null 
    };
  }
  
  return { data, error };
};

// ==========================================
// TOURNAMENT MANAGEMENT
// ==========================================

export const createTournament = async (tournamentData) => {
  const { data, error } = await supabase
    .from('tournaments')
    .insert([{
      ...tournamentData,
      status: 'registration',
      current_participants: 0,
      participants: [],
      accumulated_entry_fees: 0
    }])
    .select()
    .single();
  return { data, error };
};

export const updateTournament = async (tournamentId, updates) => {
  const { data, error } = await supabase
    .from('tournaments')
    .update(updates)
    .eq('id', tournamentId)
    .select()
    .single();
  return { data, error };
};

export const deleteTournament = async (tournamentId) => {
  const { data: tournament } = await fetchTournamentById(tournamentId);
  if (tournament?.image_path) {
    await deleteTournamentImage(tournament.image_path);
  }

  const { data, error } = await supabase
    .from('tournaments')
    .delete()
    .eq('id', tournamentId)
    .select()
    .single();
  return { data, error };
};

export const fetchTournaments = async () => {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const fetchTournamentById = async (tournamentId) => {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();
  return { data, error };
};

const shuffleArray = (items) => {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const getRoundNames = (maxPlayers) => {
  switch (maxPlayers) {
    case 2:
      return ['final'];
    case 4:
      return ['semifinals', 'final'];
    case 8:
      return ['round1', 'semifinals', 'final'];
    case 16:
      return ['round1', 'round2', 'semifinals', 'final'];
    case 32:
      return ['round1', 'round2', 'round3', 'semifinals', 'final'];
    case 64:
      return ['round1', 'round2', 'round3', 'round4', 'semifinals', 'final'];
    case 128:
      return ['round1', 'round2', 'round3', 'round4', 'round5', 'semifinals', 'final'];
    default:
      return ['round1', 'round2', 'semifinals', 'final'];
  }
};

const buildTournamentBracket = (participants, maxPlayers) => {
  const shuffled = shuffleArray(participants);
  const roundNames = getRoundNames(maxPlayers);
  const bracket = {};

  let matchCount = maxPlayers / 2;
  roundNames.forEach((roundName, idx) => {
    const matches = [];
    for (let i = 0; i < matchCount; i += 1) {
      if (idx === 0) {
        const p1 = shuffled[i * 2] || null;
        const p2 = shuffled[i * 2 + 1] || null;
        matches.push({ p1, p2, winner: null });
      } else {
        matches.push({ p1: null, p2: null, winner: null });
      }
    }
    bracket[roundName] = matches;
    matchCount = Math.max(1, Math.floor(matchCount / 2));
  });

  return bracket;
};

const determineTournamentWinner = (participants, scores, times) => {
  let winner = null;

  participants.forEach((player) => {
    const key = (player || '').toLowerCase();
    if (!winner) {
      winner = player;
      return;
    }

    const winnerKey = (winner || '').toLowerCase();
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

const isTournamentExpired = (tournament) => {
  if (!tournament?.play_until) return false;
  return new Date(tournament.play_until) <= new Date();
};

export const addTournamentParticipant = async (tournamentId, username) => {
  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  const normalizedName = (username || '').trim();
  if (!normalizedName) return { data: null, error: new Error('Ungültiger Spielername') };

  const now = new Date();
  if (tournament.play_until && new Date(tournament.play_until) <= now) {
    return { data: null, error: new Error('Turnier ist abgelaufen') };
  }

  if (!['registration', 'active'].includes(tournament.status)) {
    return { data: null, error: new Error('Turnier ist nicht offen') };
  }

  const existing = (tournament.participants || []).some(
    (p) => (p || '').toLowerCase() === normalizedName.toLowerCase()
  );
  if (existing) return { data: tournament, error: null };

  if (tournament.max_players && tournament.current_participants >= tournament.max_players) {
    return { data: null, error: new Error('Turnier ist voll') };
  }

  const updatedParticipants = [...(tournament.participants || []), normalizedName];
  const updatedEntryFees = (tournament.accumulated_entry_fees || 0) + (tournament.entry_fee || 0);

  const updates = {
    participants: updatedParticipants,
    current_participants: updatedParticipants.length,
    accumulated_entry_fees: updatedEntryFees,
  };

  if (tournament.max_players && updatedParticipants.length >= tournament.max_players && tournament.status === 'registration') {
    updates.status = 'active';
    updates.started_at = new Date().toISOString();
  }

  const { data, error } = await updateTournament(tournamentId, updates);
  return { data, error };
};

export const submitTournamentResult = async (tournamentId, username, score, timeMs) => {
  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  const normalizedName = (username || '').trim().toLowerCase();
  if (!normalizedName) return { data: null, error: new Error('Ungültiger Spielername') };

  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
  const normalizedParticipants = participants.map(p => (p || '').toLowerCase());

  if (!normalizedParticipants.includes(normalizedName)) {
    return { data: null, error: new Error('Nicht im Turnier') };
  }

  const scores = { ...(tournament.participant_scores || {}) };
  const times = { ...(tournament.participant_times || {}) };

  if (scores[normalizedName] !== undefined && scores[normalizedName] !== null) {
    return { data: tournament, error: null };
  }

  scores[normalizedName] = score;
  times[normalizedName] = timeMs;

  const updates = {
    participant_scores: scores,
    participant_times: times,
  };

  const allPlayed = normalizedParticipants.length > 0
    && normalizedParticipants.every(p => scores[p] !== undefined && scores[p] !== null);
  const hasCap = tournament.max_players && tournament.max_players > 0;
  const isFull = hasCap ? normalizedParticipants.length >= tournament.max_players : false;

  const shouldFinalize = (hasCap && isFull && allPlayed) || isTournamentExpired(tournament);
  if (shouldFinalize && tournament.status !== 'finished') {
    const winner = determineTournamentWinner(participants, scores, times);
    updates.status = 'finished';
    updates.finished_at = new Date().toISOString();
    updates.winner = winner;
    if (!tournament.winner_token) {
      updates.winner_token = `T${generateShortToken(9)}`;
      updates.winner_token_created_at = new Date().toISOString();
    }
  }

  const { data, error } = await updateTournament(tournamentId, updates);

  if (data?.status === 'finished' && data?.image_path) {
    await deleteTournamentImage(data.image_path);
    await updateTournament(tournamentId, { image_url: null, image_path: null });
  }

  return { data, error };
};

export const finalizeTournamentIfReady = async (tournamentId) => {
  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  if (tournament.status === 'finished') return { data: tournament, error: null };

  if (!isTournamentExpired(tournament)) return { data: tournament, error: null };

  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
  const normalizedParticipants = participants.map(p => (p || '').toLowerCase());
  const scores = tournament.participant_scores || {};
  const times = tournament.participant_times || {};

  if (normalizedParticipants.length === 0) return { data: tournament, error: null };

  const winner = determineTournamentWinner(participants, scores, times);
  const updates = {
    status: 'finished',
    finished_at: new Date().toISOString(),
    winner,
    winner_token: tournament.winner_token || `T${generateShortToken(9)}`,
    winner_token_created_at: tournament.winner_token_created_at || new Date().toISOString(),
  };

  const { data, error } = await updateTournament(tournamentId, updates);

  if (data?.image_path) {
    await deleteTournamentImage(data.image_path);
    await updateTournament(tournamentId, { image_url: null, image_path: null });
  }

  return { data, error };
};

export const createTournamentToken = async (tournamentId, issuedTo = null, createdBy = null) => {
  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError || new Error('Turnier nicht gefunden') };

  if (!tournament.max_players || tournament.max_players <= 0) {
    const token = generateToken();
    const tokenHash = await hashToken(token);

    const { data, error } = await supabase
      .from('tournament_tokens')
      .insert([{
        tournament_id: tournamentId,
        token_hash: tokenHash,
        issued_to: issuedTo || null,
        created_by: createdBy || null,
      }])
      .select()
      .single();

    return { data, error, token };
  }

  const { count, error: countError } = await supabase
    .from('tournament_tokens')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);

  if (countError) return { data: null, error: countError };
  if ((count || 0) >= (tournament.max_players || 0)) {
    return { data: null, error: new Error('Token-Limit erreicht') };
  }

  const token = generateToken();
  const tokenHash = await hashToken(token);

  const { data, error } = await supabase
    .from('tournament_tokens')
    .insert([{
      tournament_id: tournamentId,
      token_hash: tokenHash,
      issued_to: issuedTo || null,
      created_by: createdBy || null,
    }])
    .select()
    .single();

  return { data, error, token };
};

export const redeemTournamentToken = async (tournamentId, token, username) => {
  if (!token) return { data: null, error: new Error('Token fehlt') };

  const tokenHash = await hashToken(token);
  const { data: tokenRow, error: fetchError } = await supabase
    .from('tournament_tokens')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .maybeSingle();

  if (fetchError || !tokenRow) {
    return { data: null, error: fetchError || new Error('Token ungültig') };
  }

  const { error: updateError } = await supabase
    .from('tournament_tokens')
    .update({ used_by: username || null, used_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  if (updateError) return { data: null, error: updateError };

  return addTournamentParticipant(tournamentId, username);
};

export const removeTournamentParticipant = async (tournamentId, username) => {
  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  const updatedParticipants = tournament.participants.filter(p => p !== username);
  const updatedEntryFees = Math.max(0, tournament.accumulated_entry_fees - tournament.entry_fee);

  const { data, error } = await updateTournament(tournamentId, {
    participants: updatedParticipants,
    current_participants: updatedParticipants.length,
    accumulated_entry_fees: updatedEntryFees
  });

  return { data, error };
};

export const fetchWinningTournamentsForUser = async (username) => {
  const cleanName = toLower(username);
  if (!cleanName) return { data: [], error: null };

  const { data, error } = await supabase
    .from('tournaments')
    .select('id, name, winner, winner_token, winner_token_created_at')
    .ilike('winner', cleanName)
    .not('winner_token', 'is', null)
    .order('winner_token_created_at', { ascending: false });

  return { data, error };
};