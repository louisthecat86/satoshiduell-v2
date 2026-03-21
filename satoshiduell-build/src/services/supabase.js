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
  
  // NUR Hash-Vergleich – niemals Klartext-Vergleich (Sicherheit!)
  if (user.pin === inputHash) {
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
export const joinDuel = async (duelId, challengerName, paymentHash = null) => {
  const cleanChallenger = toLower(challengerName);
  console.log(`⚔️ ${cleanChallenger} tritt bei.`);
  
  const updateData = { 
    challenger: cleanChallenger,
    status: 'active',
    challenger_paid_at: new Date().toISOString()
  };
  if (paymentHash) updateData.challenger_payment_hash = paymentHash;

  const { data, error } = await supabase
    .from('duels')
    .update(updateData)
    .eq('id', duelId)
    .select()
    .single();

  return { data, error };
};

// D2. Arena beitreten
export const joinArena = async (duelId, playerName, paymentHash = null) => {
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
  const paymentHashes = { ...(game.participant_payment_hashes || {}) };
  if (paymentHash) paymentHashes[cleanPlayer] = paymentHash;

  const { data, error } = await supabase
    .from('duels')
    .update({ participants: updatedParticipants, status: nextStatus, participant_paid_at: paidAtMap, participant_payment_hashes: paymentHashes })
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

export const recordCreatorPayment = async (duelId, creatorName, mode = 'duel', paymentHash = null) => {
  const timestamp = new Date().toISOString();
  if (mode === 'arena') {
    const cleanCreator = toLower(creatorName);
    const { data: game, error: loadError } = await supabase
      .from('duels')
      .select('participant_paid_at, participant_payment_hashes')
      .eq('id', duelId)
      .single();

    if (loadError || !game) return { data: null, error: loadError };

    const paidAtMap = { ...(game.participant_paid_at || {}) };
    paidAtMap[cleanCreator] = timestamp;
    const paymentHashes = { ...(game.participant_payment_hashes || {}) };
    if (paymentHash) paymentHashes[cleanCreator] = paymentHash;

    const { data, error } = await supabase
      .from('duels')
      .update({ participant_paid_at: paidAtMap, participant_payment_hashes: paymentHashes })
      .eq('id', duelId)
      .select()
      .single();

    return { data, error };
  }

  const updateData = { creator_paid_at: timestamp };
  if (paymentHash) updateData.creator_payment_hash = paymentHash;

  const { data, error } = await supabase
    .from('duels')
    .update(updateData)
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

// ============================================================
// TOURNAMENT SERVICE FUNCTIONS (REBUILD)
// ============================================================
// Diese Funktionen ersetzen ALLE bestehenden Tournament-Funktionen
// in services/supabase.js. Die Duell/Arena/Challenge-Funktionen
// bleiben komplett unberührt.
//
// ZU ENTFERNEN aus supabase.js:
//   - buildTournamentBracket()
//   - getRoundNames()
//   - determineTournamentWinner()
//   - isTournamentExpired()
//   - removeTournamentParticipant()  (wird durch Registrations ersetzt)
//   - Alle Referenzen auf winner_token, total_prize_pool, entry_fee, etc.
//
// ZU ENTFERNENDE VIEWS:
//   - TournamentPaymentView.jsx
//   - TournamentEntryPaymentView.jsx
//   - CreateTournamentView_NEW.jsx
// ============================================================

// Vorhandene Imports nutzen (bereits in supabase.js):
// import { supabase } from './supabaseClient';
// hashToken, hashValue, generateToken, generateShortToken sind bereits definiert

// ============================================================
// TOURNAMENT CREATOR PERMISSIONS
// ============================================================

export const updatePlayerCanCreateTournament = async (username, canCreate) => {
  const cleanName = (username || '').toLowerCase().trim();
  const { data, error } = await supabase
    .from('profiles')
    .update({ can_create_tournaments: canCreate })
    .eq('username', cleanName)
    .select()
    .single();
  return { data, error };
};

export const fetchPlayersForTournamentPermission = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, can_create_tournaments')
    .order('username', { ascending: true });

  if (error && error.message.includes('can_create_tournaments')) {
    const { data: fallbackData } = await supabase
      .from('profiles')
      .select('username')
      .order('username', { ascending: true });

    return {
      data: fallbackData?.map(p => ({ ...p, can_create_tournaments: false })) || [],
      error: null
    };
  }

  return { data, error };
};

// ============================================================
// TOURNAMENT CRUD
// ============================================================

export const createTournament = async (tournamentData, prizes = []) => {
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .insert([{
      ...tournamentData,
      status: 'registration',
      current_participants: 0,
      participants: [],
      participant_scores: {},
      participant_times: {},
      invite_code: tournamentData.access_level === 'invite'
        ? generateShortToken(8)
        : null,
    }])
    .select()
    .single();

  if (error || !tournament) return { data: null, error };

  // Preise anlegen
  if (prizes.length > 0) {
    const prizeRows = prizes.map((prize, idx) => ({
      tournament_id: tournament.id,
      place: idx + 1,
      title: prize.title,
      description: prize.description || null,
    }));

    const { error: prizeError } = await supabase
      .from('tournament_prizes')
      .insert(prizeRows);

    if (prizeError) {
      console.error('Prize creation error:', prizeError);
    }
  }

  return { data: tournament, error: null };
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

export const fetchTournamentByInviteCode = async (inviteCode) => {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('invite_code', inviteCode.trim().toUpperCase())
    .single();
  return { data, error };
};

export const fetchTournamentWithDetails = async (tournamentId) => {
  const { data: tournament, error } = await fetchTournamentById(tournamentId);
  if (error || !tournament) return { data: null, error };

  const { data: prizes } = await supabase
    .from('tournament_prizes')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('place', { ascending: true });

  const { data: registrations } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('registered_at', { ascending: true });

  const { data: bracketMatches } = await supabase
    .from('tournament_bracket_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_name')
    .order('match_index');

  return {
    data: {
      ...tournament,
      prizes: prizes || [],
      registrations: registrations || [],
      bracket_matches: bracketMatches || [],
    },
    error: null,
  };
};

// ============================================================
// TOURNAMENT PRIZES
// ============================================================

export const fetchTournamentPrizes = async (tournamentId) => {
  const { data, error } = await supabase
    .from('tournament_prizes')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('place', { ascending: true });
  return { data, error };
};

export const markPrizeClaimed = async (prizeId) => {
  const { data: prize, error } = await supabase
    .from('tournament_prizes')
    .update({ claimed: true, claimed_at: new Date().toISOString() })
    .eq('id', prizeId)
    .select()
    .single();

  if (error || !prize) return { data: null, error };

  // Prüfen ob ALLE Preise dieses Turniers eingelöst sind
  const { data: allPrizes } = await supabase
    .from('tournament_prizes')
    .select('claimed')
    .eq('tournament_id', prize.tournament_id);

  const allClaimed = allPrizes && allPrizes.length > 0 && allPrizes.every(p => p.claimed);

  if (allClaimed) {
    await supabase
      .from('tournaments')
      .update({ status: 'archived' })
      .eq('id', prize.tournament_id)
      .eq('status', 'finished');
  }

  return { data: prize, error: null };
};

export const unmarkPrizeClaimed = async (prizeId) => {
  const { data, error } = await supabase
    .from('tournament_prizes')
    .update({ claimed: false, claimed_at: null })
    .eq('id', prizeId)
    .select()
    .single();
  return { data, error };
};

// ============================================================
// IDENTITY GATE & REGISTRATIONS
// ============================================================

const normalizeIdentity = (type, value) => {
  let normalized = (value || '').trim();
  if (type === 'telegram' || type === 'twitter') {
    normalized = normalized.replace(/^@/, '').toLowerCase();
  }
  if (type === 'nostr') {
    normalized = normalized.toLowerCase();
  }
  return normalized;
};

export const registerForTournament = async (tournamentId, identityType, identityValue, identityVerified = false, playerUsername = null) => {
  const normalized = normalizeIdentity(identityType, identityValue);
  if (!normalized) return { data: null, error: new Error('Identität fehlt') };

  const identHash = await hashValue(normalized);

  const { data: existing } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('identity_hash', identHash)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'rejected') {
      return { data: null, error: new Error('Registrierung wurde abgelehnt') };
    }
    return { data: existing, error: new Error('Du bist bereits registriert') };
  }

  const { data: tournament } = await fetchTournamentById(tournamentId);
  if (!tournament) return { data: null, error: new Error('Turnier nicht gefunden') };

  if (!['registration', 'active'].includes(tournament.status)) {
    return { data: null, error: new Error('Turnier ist nicht offen') };
  }

  if (tournament.play_until && new Date(tournament.play_until) <= new Date()) {
    return { data: null, error: new Error('Turnier ist abgelaufen') };
  }

  let displayName = identityValue;
  if (identityType === 'telegram') displayName = `@${normalized}`;
  if (identityType === 'twitter') displayName = `@${normalized}`;
  if (identityType === 'nostr') displayName = normalized.length > 20 ? `${normalized.slice(0, 12)}...${normalized.slice(-8)}` : normalized;

  const { data, error } = await supabase
    .from('tournament_registrations')
    .insert([{
      tournament_id: tournamentId,
      identity_type: identityType,
      identity_value: normalized,
      identity_display: displayName,
      identity_verified: identityVerified,
      identity_hash: identHash,
      token_hash: null,
      status: 'pending',
      player_username: playerUsername,
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: new Error('Du bist bereits registriert') };
    }
    return { data: null, error };
  }

  return { data, error: null };
};

// Creator genehmigt eine Registrierung
export const approveRegistration = async (registrationId) => {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('status', 'pending')
    .select()
    .single();
  return { data, error };
};

// Creator lehnt Registrierung ab
export const rejectRegistration = async (registrationId) => {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('status', 'pending')
    .select()
    .single();
  return { data, error };
};

// Token einlösen → Spieler tritt Turnier bei
export const redeemRegistrationToken = async (tournamentId, token, username) => {
  if (!token) return { data: null, error: new Error('Token fehlt') };

  const tokenHash = await hashToken(token);

  const { data: registration, error: fetchError } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('token_hash', tokenHash)
    .eq('status', 'approved')
    .maybeSingle();

  if (fetchError || !registration) {
    return { data: null, error: fetchError || new Error('Token ungültig oder nicht genehmigt') };
  }

  // Token als eingelöst markieren
  const { error: updateError } = await supabase
    .from('tournament_registrations')
    .update({
      status: 'redeemed',
      player_username: username,
      redeemed_at: new Date().toISOString(),
    })
    .eq('id', registration.id);

  if (updateError) return { data: null, error: updateError };

  // Spieler dem Turnier hinzufügen
  return addTournamentParticipant(tournamentId, username);
};

// Alle Registrierungen für ein Turnier (Admin-Ansicht)
export const fetchTournamentRegistrations = async (tournamentId) => {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('registered_at', { ascending: true });
  return { data, error };
};

// ============================================================
// PARTICIPANT MANAGEMENT
// ============================================================

export const addTournamentParticipant = async (tournamentId, username) => {
  const normalizedName = (username || '').trim();
  if (!normalizedName) return { data: null, error: new Error('Ungültiger Spielername') };

  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  if (!['registration', 'active'].includes(tournament.status)) {
    return { data: null, error: new Error('Turnier ist nicht offen') };
  }

  if (tournament.play_until && new Date(tournament.play_until) <= new Date()) {
    return { data: null, error: new Error('Turnier ist abgelaufen') };
  }

  const existing = (tournament.participants || []).some(
    p => (p || '').toLowerCase() === normalizedName.toLowerCase()
  );
  if (existing) return { data: tournament, error: null };

  if (tournament.max_players && tournament.current_participants >= tournament.max_players) {
    return { data: null, error: new Error('Turnier ist voll') };
  }

  const updatedParticipants = [...(tournament.participants || []), normalizedName];
  const updates = {
    participants: updatedParticipants,
    current_participants: updatedParticipants.length,
  };

  // Bracket: Wenn voll → active + Bracket generieren
  if (tournament.format === 'bracket'
      && tournament.max_players
      && updatedParticipants.length >= tournament.max_players) {
    updates.status = 'active';
    updates.started_at = new Date().toISOString();
  }

  // Highscore: Wenn max_players gesetzt und voll → active
  if (tournament.format === 'highscore'
      && tournament.max_players
      && updatedParticipants.length >= tournament.max_players
      && tournament.status === 'registration') {
    updates.status = 'active';
    updates.started_at = new Date().toISOString();
  }

  const { data, error } = await updateTournament(tournamentId, updates);

  // Bei Bracket: Matches generieren wenn gerade voll geworden
  if (data?.format === 'bracket' && data?.status === 'active') {
    const { data: existingMatches } = await supabase
      .from('tournament_bracket_matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .limit(1);

    if (!existingMatches || existingMatches.length === 0) {
      await generateBracketMatches(data);
    }
  }

  return { data, error };
};

// ============================================================
// HIGHSCORE GAMEPLAY
// ============================================================

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

const isTournamentExpired = (tournament) => {
  if (!tournament?.play_until) return false;
  return new Date(tournament.play_until) <= new Date();
};

export const submitTournamentResult = async (tournamentId, username, score, timeMs) => {
  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  if (tournament.format !== 'highscore') {
    return { data: null, error: new Error('Falsches Format — nutze submitBracketMatchResult für Bracket') };
  }

  const normalizedName = (username || '').trim().toLowerCase();
  if (!normalizedName) return { data: null, error: new Error('Ungültiger Spielername') };

  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
  const normalizedParticipants = participants.map(p => (p || '').toLowerCase());

  if (!normalizedParticipants.includes(normalizedName)) {
    return { data: null, error: new Error('Nicht im Turnier') };
  }

  const scores = { ...(tournament.participant_scores || {}) };
  const times = { ...(tournament.participant_times || {}) };

  // Schon gespielt → kein zweites Mal
  if (scores[normalizedName] !== undefined && scores[normalizedName] !== null) {
    return { data: tournament, error: null };
  }

  scores[normalizedName] = score;
  times[normalizedName] = Math.round(timeMs);

  const updates = { participant_scores: scores, participant_times: times };

  // Finalisierung prüfen
  const allPlayed = normalizedParticipants.length > 0
    && normalizedParticipants.every(p => scores[p] !== undefined && scores[p] !== null);
  const hasCap = tournament.max_players && tournament.max_players > 0;
  const isFull = hasCap ? normalizedParticipants.length >= tournament.max_players : false;
  const isExpired = isTournamentExpired(tournament);

  const shouldFinalize = (hasCap && isFull && allPlayed) || (isExpired && allPlayed);

  if (shouldFinalize && tournament.status !== 'finished') {
    const ranked = buildRankedList(participants, scores, times);
    if (ranked.length > 0 && ranked[0].played) {
      const winnerName = ranked[0].name;
      const { data: winnerProfile } = await supabase
        .from('profiles')
        .select('npub')
        .ilike('username', winnerName)
        .maybeSingle();

      updates.status = 'finished';
      updates.finished_at = new Date().toISOString();
      updates.winner = winnerName;
      updates.winner_npub = winnerProfile?.npub || null;
    }
  }

  const { data, error } = await updateTournament(tournamentId, updates);

  // Preise zuweisen wenn finalisiert
  if (data?.status === 'finished') {
    const ranked = buildRankedList(
      data.participants || [],
      data.participant_scores || {},
      data.participant_times || {}
    );
    await assignPrizesToWinners(tournamentId, ranked);

    if (data.image_path) {
      await deleteTournamentImage(data.image_path);
      await updateTournament(tournamentId, { image_url: null, image_path: null });
    }
  }

  return { data, error };
};

export const finalizeTournamentIfReady = async (tournamentId) => {
  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };
  if (tournament.status === 'finished') return { data: tournament, error: null };
  if (tournament.format === 'bracket') return { data: tournament, error: null };
  if (!isTournamentExpired(tournament)) return { data: tournament, error: null };

  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
  if (participants.length === 0) return { data: tournament, error: null };

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

  const updates = {
    status: 'finished',
    finished_at: new Date().toISOString(),
    winner: winnerName,
    winner_npub: winnerNpub,
  };

  const { data, error } = await updateTournament(tournamentId, updates);

  if (data) {
    await assignPrizesToWinners(tournamentId, ranked);
    if (data.image_path) {
      await deleteTournamentImage(data.image_path);
      await updateTournament(tournamentId, { image_url: null, image_path: null });
    }
  }

  return { data, error };
};

// ============================================================
// BRACKET GAMEPLAY
// ============================================================

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

export const getRoundDisplayName = (roundName) => {
  const names = {
    round_of_128: 'Runde der 128',
    round_of_64: 'Runde der 64',
    round_of_32: 'Runde der 32',
    round_of_16: 'Achtelfinale',
    quarter: 'Viertelfinale',
    semi: 'Halbfinale',
    final: 'Finale',
  };
  return names[roundName] || roundName;
};

const shuffleArray = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const generateBracketMatches = async (tournament) => {
  const participants = shuffleArray(tournament.participants || []);
  const rounds = getRoundsForSize(tournament.max_players);
  const qPerRound = tournament.questions_per_round || getDefaultQuestionsPerRound(tournament.max_players);
  const firstRound = rounds[0];
  const numFirstRoundMatches = Math.floor(participants.length / 2);
  const numQ = qPerRound[firstRound] || 5;

  // Fragen für erste Runde laden
  const totalQNeeded = numQ * numFirstRoundMatches;
  const { data: questionIds } = await fetchQuestionIds(totalQNeeded);

  const matches = [];

  // Erste Runde: Spieler zuweisen
  for (let i = 0; i < numFirstRoundMatches; i++) {
    const p1 = participants[i * 2] || null;
    const p2 = participants[i * 2 + 1] || null;
    const matchQuestions = (questionIds || []).slice(i * numQ, (i + 1) * numQ);

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

  // Spätere Runden: Leere Platzhalter
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

  const { error } = await supabase
    .from('tournament_bracket_matches')
    .insert(matches);

  if (error) {
    console.error('Bracket generation error:', error);
    return { error };
  }

  // Bracket-Summary in Tournament speichern
  await updateBracketSummary(tournament.id);
  return { error: null };
};

export const fetchBracketMatches = async (tournamentId) => {
  const { data, error } = await supabase
    .from('tournament_bracket_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_name')
    .order('match_index');
  return { data, error };
};

export const fetchMyBracketMatch = async (tournamentId, username) => {
  const normalizedName = (username || '').toLowerCase();
  const { data, error } = await supabase
    .from('tournament_bracket_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('status', ['ready', 'active'])
    .or(`player1.ilike.${normalizedName},player2.ilike.${normalizedName}`)
    .maybeSingle();
  return { data, error };
};

export const submitBracketMatchResult = async (matchId, username, score, timeMs) => {
  const { data: match, error: fetchError } = await supabase
    .from('tournament_bracket_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (fetchError || !match) return { data: null, error: fetchError };

  const normalizedName = (username || '').toLowerCase();
  const isP1 = (match.player1 || '').toLowerCase() === normalizedName;
  const isP2 = (match.player2 || '').toLowerCase() === normalizedName;

  if (!isP1 && !isP2) return { data: null, error: new Error('Nicht in diesem Match') };

  // Bereits gespielt?
  if (isP1 && match.player1_score !== null) return { data: match, error: null };
  if (isP2 && match.player2_score !== null) return { data: match, error: null };

  const updates = { status: 'active' };
  if (isP1) { updates.player1_score = score; updates.player1_time_ms = Math.round(timeMs); }
  if (isP2) { updates.player2_score = score; updates.player2_time_ms = Math.round(timeMs); }

  // Match komplett?
  const p1Done = isP1 ? true : match.player1_score !== null;
  const p2Done = isP2 ? true : match.player2_score !== null;

  if (p1Done && p2Done) {
    const s1 = isP1 ? score : match.player1_score;
    const t1 = isP1 ? timeMs : match.player1_time_ms;
    const s2 = isP2 ? score : match.player2_score;
    const t2 = isP2 ? timeMs : match.player2_time_ms;

    updates.winner = (s1 > s2 || (s1 === s2 && (t1 || Infinity) < (t2 || Infinity)))
      ? match.player1 : match.player2;
    updates.status = 'finished';
    updates.finished_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('tournament_bracket_matches')
    .update(updates)
    .eq('id', matchId)
    .select()
    .single();

  // Wenn fertig → Winner weiterleiten
  if (data?.status === 'finished' && data?.winner) {
    await advanceBracketWinner(data);
  }

  return { data, error };
};

// ============================================================
// FIX: advanceBracketWinner — mit Bye-Handling
// ============================================================
// Diese Funktion ersetzt die bestehende advanceBracketWinner
// in supabase.js. Die einzige Änderung ist der Block am Ende
// der Funktion der Bye-Matches (Spieler ohne Gegner) erkennt
// und rekursiv weiterleitet, sodass das Turnier nicht hängen bleibt.
// ============================================================

const advanceBracketWinner = async (finishedMatch) => {
  const { tournament_id, round_name, winner } = finishedMatch;

  const { data: allMatches } = await supabase
    .from('tournament_bracket_matches')
    .select('*')
    .eq('tournament_id', tournament_id)
    .order('match_index');

  if (!allMatches) return;

  const ROUND_ORDER = ['round_of_128', 'round_of_64', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'final'];
  const roundNames = [];
  const seen = new Set();
  const sortedByRound = [...allMatches].sort((a, b) => {
    const orderA = ROUND_ORDER.indexOf(a.round_name);
    const orderB = ROUND_ORDER.indexOf(b.round_name);
    if (orderA !== orderB) return orderA - orderB;
    return a.match_index - b.match_index;
  });
  sortedByRound.forEach(m => { if (!seen.has(m.round_name)) { seen.add(m.round_name); roundNames.push(m.round_name); } });

  const currentRoundIdx = roundNames.indexOf(round_name);
  const currentRoundMatches = sortedByRound.filter(m => m.round_name === round_name);
  const allCurrentDone = currentRoundMatches.every(m => m.status === 'finished');

  // Finale → Turnier beenden
  if (currentRoundIdx === roundNames.length - 1 && allCurrentDone) {
    await finalizeBracketTournament(tournament_id, winner);
    return;
  }

  if (!allCurrentDone) return;

  // Nächste Runde vorbereiten
  const nextRound = roundNames[currentRoundIdx + 1];
  const nextRoundMatches = sortedByRound.filter(m => m.round_name === nextRound);
  const winners = currentRoundMatches.map(m => m.winner);

  const { data: tournament } = await fetchTournamentById(tournament_id);
  const qPerRound = tournament?.questions_per_round || {};
  const numQ = qPerRound[nextRound] || 5;

  // Bye-Matches sammeln für rekursive Weiterleitung
  const byeMatchIds = [];

  for (let i = 0; i < nextRoundMatches.length; i++) {
    const p1 = winners[i * 2] || null;
    const p2 = winners[i * 2 + 1] || null;

    const { data: questionIds } = await fetchQuestionIds(numQ);

    const isBye = (p1 && !p2) || (!p1 && p2);

    const matchUpdates = {
      player1: p1,
      player2: p2,
      questions: questionIds,
      status: (p1 && p2) ? 'ready' : isBye ? 'finished' : 'pending',
      winner: (p1 && !p2) ? p1 : (!p1 && p2) ? p2 : null,
      deadline_at: new Date(
        Date.now() + (tournament?.round_deadline_hours || 24) * 3600000
      ).toISOString(),
    };

    if (matchUpdates.status === 'finished') {
      matchUpdates.finished_at = new Date().toISOString();
    }

    await supabase
      .from('tournament_bracket_matches')
      .update(matchUpdates)
      .eq('id', nextRoundMatches[i].id);

    // Bye-Match merken
    if (isBye) {
      byeMatchIds.push(nextRoundMatches[i].id);
    }
  }

  await updateBracketSummary(tournament_id);

  // ── NEU: Bye-Matches rekursiv weiterleiten ──
  // Ohne diesen Block bleibt das Turnier hängen wenn ein Spieler
  // in der nächsten Runde keinen Gegner hat (z.B. bei manuellem
  // Start mit weniger Spielern als max_players).
  for (const byeId of byeMatchIds) {
    const { data: byeMatch } = await supabase
      .from('tournament_bracket_matches')
      .select('*')
      .eq('id', byeId)
      .single();

    if (byeMatch?.status === 'finished' && byeMatch?.winner) {
      await advanceBracketWinner(byeMatch);
    }
  }
};

const finalizeBracketTournament = async (tournamentId, winnerName) => {
  let winnerNpub = null;
  if (winnerName) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('npub')
      .ilike('username', winnerName)
      .maybeSingle();
    winnerNpub = profile?.npub || null;
  }

  await updateTournament(tournamentId, {
    status: 'finished',
    finished_at: new Date().toISOString(),
    winner: winnerName,
    winner_npub: winnerNpub,
  });

  // Bracket-Rangliste aufbauen (alle Runden rückwärts)
  const { data: allMatches } = await supabase
    .from('tournament_bracket_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('match_index');

  if (allMatches) {
    // Einfache Rangliste: Gewinner = 1, Finalist = 2, Halbfinalisten = 3-4, etc.
    const ranked = buildBracketRanking(allMatches);
    await assignPrizesToWinners(tournamentId, ranked);
  }

  // Bild aufräumen
  const { data: t } = await fetchTournamentById(tournamentId);
  if (t?.image_path) {
    await deleteTournamentImage(t.image_path);
    await updateTournament(tournamentId, { image_url: null, image_path: null });
  }
};

const buildBracketRanking = (allMatches) => {
  // Runden identifizieren (letzte Runde = Finale)
  const roundNames = [];
  const seen = new Set();
  allMatches.forEach(m => { if (!seen.has(m.round_name)) { seen.add(m.round_name); roundNames.push(m.round_name); } });

  const ranked = [];
  const placed = new Set();

  // Rückwärts durch die Runden
  for (let r = roundNames.length - 1; r >= 0; r--) {
    const roundMatches = allMatches.filter(m => m.round_name === roundNames[r]);

    // Gewinner zuerst, dann Verlierer
    roundMatches.forEach(m => {
      if (m.winner && !placed.has(m.winner.toLowerCase())) {
        ranked.push({ name: m.winner, key: m.winner.toLowerCase(), played: true, score: null, timeMs: null });
        placed.add(m.winner.toLowerCase());
      }
    });
    roundMatches.forEach(m => {
      const loser = m.winner === m.player1 ? m.player2 : m.player1;
      if (loser && !placed.has(loser.toLowerCase())) {
        ranked.push({ name: loser, key: loser.toLowerCase(), played: true, score: null, timeMs: null });
        placed.add(loser.toLowerCase());
      }
    });
  }

  return ranked;
};

const updateBracketSummary = async (tournamentId) => {
  const { data: allMatches } = await supabase
    .from('tournament_bracket_matches')
    .select('round_name, match_index, player1, player2, winner, status')
    .eq('tournament_id', tournamentId)
    .order('match_index');

  if (!allMatches) return;

  const summary = {};
  allMatches.forEach(m => {
    if (!summary[m.round_name]) summary[m.round_name] = [];
    summary[m.round_name].push({
      p1: m.player1, p2: m.player2,
      winner: m.winner, status: m.status,
    });
  });

  await updateTournament(tournamentId, { bracket: summary });
};

// ============================================================
// PRIZE ASSIGNMENT
// ============================================================

const assignPrizesToWinners = async (tournamentId, rankedList = []) => {
  const { data: prizes } = await supabase
    .from('tournament_prizes')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('place', { ascending: true });

  if (!prizes || prizes.length === 0) return;

  for (const prize of prizes) {
    const winner = rankedList[prize.place - 1];
    if (!winner) continue;

    // Identity-Infos aus Registrierung holen
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

// ============================================================
// MY TOURNAMENT REGISTRATIONS
// ============================================================

export const fetchMyTournamentRegistrations = async (username) => {
  if (!username) return { data: [], error: null };
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('*, tournaments:tournament_id(*)')
    .ilike('player_username', username)
    .order('registered_at', { ascending: false });
  return { data: data || [], error };
};

// ============================================================
// ADMIN DASHBOARD HELPERS
// ============================================================

export const fetchTournamentAdminData = async (tournamentId) => {
  // Alle Daten die der Creator/Organisator braucht
  const [
    { data: tournament },
    { data: prizes },
    { data: registrations },
    { data: bracketMatches },
  ] = await Promise.all([
    fetchTournamentById(tournamentId),
    fetchTournamentPrizes(tournamentId),
    fetchTournamentRegistrations(tournamentId),
    fetchBracketMatches(tournamentId),
  ]);

  if (!tournament) return { data: null, error: new Error('Turnier nicht gefunden') };

  // Statistiken berechnen
  const regStats = {
    total: (registrations || []).length,
    pending: (registrations || []).filter(r => r.status === 'pending').length,
    approved: (registrations || []).filter(r => r.status === 'approved').length,
    redeemed: (registrations || []).filter(r => r.status === 'redeemed').length,
    rejected: (registrations || []).filter(r => r.status === 'rejected').length,
  };

  const participants = tournament.participants || [];
  const scores = tournament.participant_scores || {};
  const times = tournament.participant_times || {};
  const played = participants.filter(p => scores[(p || '').toLowerCase()] !== undefined).length;

  const gameStats = {
    totalParticipants: participants.length,
    played,
    notPlayed: participants.length - played,
    maxPlayers: tournament.max_players,
  };

  const ranked = buildRankedList(participants, scores, times);

  return {
    data: {
      tournament,
      prizes: prizes || [],
      registrations: registrations || [],
      bracketMatches: bracketMatches || [],
      regStats,
      gameStats,
      ranked,
    },
    error: null,
  };
};

// ============================================================
// BACKWARD COMPAT: Funktionen die in TournamentsView genutzt werden
// ============================================================

export const createTournamentToken = async (tournamentId, issuedTo = null, createdBy = null) => {
  console.log('🎫 Create Token:', { tournamentId, issuedTo, createdBy });
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/tournament-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: 'create',
        tournamentId,
        issuedTo,
        createdBy,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      return { data: null, error: new Error(result.error || 'Token-Erstellung fehlgeschlagen'), token: null };
    }

    return { data: result.data, error: null, token: result.token };
  } catch (err) {
    return { data: null, error: err, token: null };
  }
};

export const redeemTournamentToken = async (tournamentId, token, username) => {
  console.log('🔑 Redeem:', { tournamentId, token: token?.slice(0, 8) + '...', username });
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/tournament-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: 'redeem',
        tournamentId,
        token,
        username,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      return { data: null, error: new Error(result.error || 'Token ungültig') };
    }

    return { data: result.data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

// Winning tournaments für Dashboard
export const fetchWinningTournamentsForUser = async (username) => {
  const cleanName = (username || '').toLowerCase().trim();
  if (!cleanName) return { data: [], error: null };

  const { data, error } = await supabase
    .from('tournaments')
    .select('id, name, winner, winner_npub, format, finished_at')
    .ilike('winner', cleanName)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false });

  return { data, error };
};
// ============================================================
// TOURNAMENT ADMIN: DISQUALIFY / REMOVE / CLEANUP
// ============================================================
// → An das ENDE von supabase.js anhängen.
// Alle benötigten Helpers (buildRankedList, assignPrizesToWinners,
// advanceBracketWinner, updateTournament, fetchTournamentById,
// generateBracketMatches, fetchQuestionIds, deleteTournamentImage,
// supabase, toLower) sind bereits in supabase.js definiert.
// ============================================================

/**
 * Spieler disqualifizieren.
 * - Highscore: Score = 0, Zeit = MAX → rankt ganz unten, Finalisierung wird geprüft
 * - Bracket: Gegner gewinnt das aktuelle Match automatisch → Bracket läuft weiter
 */
export const disqualifyTournamentPlayer = async (tournamentId, username) => {
  const normalizedName = (username || '').trim().toLowerCase();
  if (!normalizedName) return { data: null, error: new Error('Kein Spielername') };

  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  // ── HIGHSCORE ──
  if (tournament.format === 'highscore') {
    const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
    const normalizedParticipants = participants.map(p => (p || '').toLowerCase());

    if (!normalizedParticipants.includes(normalizedName)) {
      return { data: null, error: new Error('Spieler nicht im Turnier') };
    }

    const scores = { ...(tournament.participant_scores || {}) };
    const times = { ...(tournament.participant_times || {}) };

    // DQ: Score 0, Zeit maximal → landet immer ganz unten
    scores[normalizedName] = 0;
    times[normalizedName] = 999999999;

    const updates = {
      participant_scores: scores,
      participant_times: times,
    };

    // Prüfen ob jetzt alle gespielt haben → finalisieren
    const allPlayed = normalizedParticipants.every(p => scores[p] !== undefined && scores[p] !== null);
    const hasCap = tournament.max_players && tournament.max_players > 0;
    const isFull = hasCap ? normalizedParticipants.length >= tournament.max_players : false;
    const isExpired = tournament.play_until && new Date(tournament.play_until) <= new Date();

    if (allPlayed && ((hasCap && isFull) || isExpired) && tournament.status !== 'finished') {
      const ranked = buildRankedList(participants, scores, times);
      if (ranked.length > 0 && ranked[0].played) {
        const winnerName = ranked[0].name;
        const { data: winnerProfile } = await supabase
          .from('profiles')
          .select('npub')
          .ilike('username', winnerName)
          .maybeSingle();

        updates.status = 'finished';
        updates.finished_at = new Date().toISOString();
        updates.winner = winnerName;
        updates.winner_npub = winnerProfile?.npub || null;
      }
    }

    const { data, error } = await updateTournament(tournamentId, updates);

    if (data?.status === 'finished') {
      const ranked = buildRankedList(
        data.participants || [],
        data.participant_scores || {},
        data.participant_times || {}
      );
      await assignPrizesToWinners(tournamentId, ranked);
    }

    return { data, error };
  }

  // ── BRACKET ──
  if (tournament.format === 'bracket') {
    const { data: match, error: matchError } = await supabase
      .from('tournament_bracket_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .in('status', ['ready', 'active'])
      .or(`player1.ilike.${normalizedName},player2.ilike.${normalizedName}`)
      .maybeSingle();

    if (matchError) return { data: null, error: matchError };

    if (!match) {
      return { data: null, error: new Error('Kein aktives Match für diesen Spieler') };
    }

    const isP1 = (match.player1 || '').toLowerCase() === normalizedName;
    const winner = isP1 ? match.player2 : match.player1;

    if (!winner) {
      return { data: null, error: new Error('Kein Gegner vorhanden') };
    }

    const matchUpdates = {
      status: 'finished',
      winner: winner,
      finished_at: new Date().toISOString(),
    };

    if (isP1) {
      matchUpdates.player1_score = 0;
      matchUpdates.player1_time_ms = 999999999;
      if (match.player2_score === null) {
        matchUpdates.player2_score = 999;
        matchUpdates.player2_time_ms = 0;
      }
    } else {
      matchUpdates.player2_score = 0;
      matchUpdates.player2_time_ms = 999999999;
      if (match.player1_score === null) {
        matchUpdates.player1_score = 999;
        matchUpdates.player1_time_ms = 0;
      }
    }

    const { data: updatedMatch, error: updateError } = await supabase
      .from('tournament_bracket_matches')
      .update(matchUpdates)
      .eq('id', match.id)
      .select()
      .single();

    if (updateError) return { data: null, error: updateError };

    if (updatedMatch?.status === 'finished' && updatedMatch?.winner) {
      await advanceBracketWinner(updatedMatch);
    }

    return { data: updatedMatch, error: null };
  }

  return { data: null, error: new Error('Unbekanntes Turnier-Format') };
};

/**
 * Teilnehmer aus Turnier entfernen.
 * Entfernt aus participants-Array, löscht Scores/Times, passt current_participants an.
 * Bei Bracket: NUR möglich solange status = 'registration' (vor Bracket-Generierung).
 */
export const removeTournamentParticipant = async (tournamentId, username) => {
  const normalizedName = (username || '').trim().toLowerCase();
  if (!normalizedName) return { data: null, error: new Error('Kein Spielername') };

  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  if (tournament.status === 'finished') {
    return { data: null, error: new Error('Turnier ist bereits beendet') };
  }

  if (tournament.format === 'bracket' && tournament.status !== 'registration') {
    return { data: null, error: new Error('Bracket bereits gestartet — nutze Disqualifizierung') };
  }

  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
  const updatedParticipants = participants.filter(
    p => (p || '').toLowerCase() !== normalizedName
  );

  if (updatedParticipants.length === participants.length) {
    return { data: null, error: new Error('Spieler nicht im Turnier') };
  }

  const scores = { ...(tournament.participant_scores || {}) };
  const times = { ...(tournament.participant_times || {}) };
  delete scores[normalizedName];
  delete times[normalizedName];

  const updates = {
    participants: updatedParticipants,
    current_participants: updatedParticipants.length,
    participant_scores: scores,
    participant_times: times,
  };

  if (tournament.status === 'active'
      && tournament.format === 'highscore'
      && tournament.max_players
      && updatedParticipants.length < tournament.max_players) {
    updates.status = 'registration';
    updates.started_at = null;
  }

  const { data, error } = await updateTournament(tournamentId, updates);

  // Zugehörige Registration aufräumen
  await supabase
    .from('tournament_registrations')
    .update({ status: 'removed', player_username: null })
    .eq('tournament_id', tournamentId)
    .ilike('player_username', normalizedName);

  return { data, error };
};

/**
 * Registrierung löschen (Platz freigeben).
 * Falls der Spieler bereits beigetreten ist (status = 'redeemed'),
 * wird er auch aus dem Turnier entfernt.
 */
export const deleteRegistration = async (registrationId) => {
  const { data: reg, error: fetchError } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('id', registrationId)
    .single();

  if (fetchError || !reg) return { data: null, error: fetchError };

  // Wenn schon beigetreten → auch aus Turnier entfernen
  if (reg.status === 'redeemed' && reg.player_username) {
    const removeResult = await removeTournamentParticipant(reg.tournament_id, reg.player_username);
    if (removeResult.error) {
      console.warn('Konnte Teilnehmer nicht entfernen:', removeResult.error.message);
    }
  }

  const { error } = await supabase
    .from('tournament_registrations')
    .delete()
    .eq('id', registrationId);

  return { data: reg, error };
};

/**
 * Admin: Turnier manuell starten (z.B. wenn kein max_players gesetzt).
 */
export const startTournamentManually = async (tournamentId) => {
  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  if (tournament.status !== 'registration') {
    return { data: null, error: new Error('Turnier ist nicht in der Registrierungsphase') };
  }

  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
  if (participants.length < 2) {
    return { data: null, error: new Error('Mindestens 2 Teilnehmer nötig') };
  }

  const updates = {
    status: 'active',
    started_at: new Date().toISOString(),
  };

  const { data, error } = await updateTournament(tournamentId, updates);

  if (data?.format === 'bracket') {
    const { data: existingMatches } = await supabase
      .from('tournament_bracket_matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .limit(1);

    if (!existingMatches || existingMatches.length === 0) {
      await generateBracketMatches(data);
    }
  }

  return { data, error };
};

/**
 * Admin: Turnier manuell beenden (nur Highscore).
 * Beendet das Turnier sofort mit aktuellem Stand.
 */
export const finalizeTournamentManually = async (tournamentId) => {
  const { data: tournament, error: fetchError } = await fetchTournamentById(tournamentId);
  if (fetchError || !tournament) return { data: null, error: fetchError };

  if (tournament.status === 'finished') {
    return { data: tournament, error: null };
  }

  if (tournament.format === 'bracket') {
    return { data: null, error: new Error('Bracket-Turniere können nicht manuell finalisiert werden') };
  }

  const participants = Array.isArray(tournament.participants) ? tournament.participants : [];
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

  const { data, error } = await updateTournament(tournamentId, {
    status: 'finished',
    finished_at: new Date().toISOString(),
    winner: winnerName,
    winner_npub: winnerNpub,
  });

  if (data) {
    await assignPrizesToWinners(tournamentId, ranked);
    if (data.image_path) {
      await deleteTournamentImage(data.image_path);
      await updateTournament(tournamentId, { image_url: null, image_path: null });
    }
  }

  return { data, error };
};