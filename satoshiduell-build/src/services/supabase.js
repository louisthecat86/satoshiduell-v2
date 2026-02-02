import { createClient } from '@supabase/supabase-js';

// --- KONFIGURATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// HILFSFUNKTION: Hashing (SHA-256)
// ==========================================
async function hashPin(pin) {
  const msgBuffer = new TextEncoder().encode(String(pin).trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==========================================
// 1. SPIELER LOGIK (AUTH)
// ==========================================

export const getPlayerByName = async (name) => {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .ilike('name', name.trim())
    .limit(1)
    .maybeSingle();
  
  return { data, error };
};

export const createPlayer = async (name, pin) => {
  const hashedPin = await hashPin(pin);
  const { data, error } = await supabase
    .from('players')
    .insert([{ name: name, pin: hashedPin }]) 
    .select()
    .single();
  return { data, error };
};

export const verifyLogin = async (name, pin) => {
  const { data: user, error } = await supabase
    .from('players')
    .select('*')
    .ilike('name', name.trim())
    .limit(1)
    .maybeSingle();

  if (error || !user) return { data: null, error };

  const inputHash = await hashPin(pin);
  const dbHash = user.pin;

  if (inputHash === dbHash) {
    return { data: user, error: null };
  } else {
    // Fallback: Falls alte User noch Klartext-PINs haben
    if (String(pin).trim() === String(user.pin).trim()) {
        return { data: user, error: null };
    }
    return { data: null, error: null };
  }
};

// ==========================================
// 2. SPIEL LOGIK (Core)
// ==========================================

// A. Neues Duell anlegen (Status: pending_payment)
export const createDuelEntry = async (creatorName, amount) => {
  console.log(`📝 Erstelle Duell Eintrag für ${creatorName} mit ${amount} Sats`);

  const dummyQuestions = [
      { q: "Was ist Bitcoin?", a: ["Digitales Gold", "Ein Stein", "Essen", "Auto"], c: 0 },
      { q: "Wer ist Satoshi?", a: ["Niemand", "Craig Wright", "Unbekannt", "Elon Musk"], c: 2 },
      { q: "Wann war der Genesis Block?", a: ["2008", "2009", "2010", "2011"], c: 1 },
      { q: "Was ist das Lightning Network?", a: ["Ein Wetterphänomen", "Layer 2 Lösung", "Ein Videospiel", "Eine Bank"], c: 1 },
      { q: "Wie viele Sats sind ein Bitcoin?", a: ["1000", "1 Million", "100 Millionen", "Unendlich"], c: 2 }
  ];

  const { data, error } = await supabase
    .from('duels')
    .insert([{ 
      creator: creatorName, 
      status: 'pending_payment', 
      amount: parseInt(amount),  
      current_pot: 0,
      questions: dummyQuestions
    }])
    .select()
    .single();

  return { data, error };
};

// B. Offene Duelle laden
export const fetchOpenDuels = async (myPlayerName) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'waiting') 
    .neq('creator', myPlayerName) 
    .order('created_at', { ascending: false });

  return { data, error };
};

// C. Anzahl offener Duelle zählen
export const getOpenDuelCount = async (myPlayerName) => {
  const { count, error } = await supabase
    .from('duels')
    .select('*', { count: 'exact', head: true }) 
    .eq('status', 'waiting')
    .neq('creator', myPlayerName);

  if (error) return 0;
  return count || 0;
};

// D. Duell beitreten (Status -> active)
export const joinDuel = async (duelId, challengerName) => {
  console.log(`⚔️ User ${challengerName} tritt Duell ${duelId} bei.`);
  const { data, error } = await supabase
    .from('duels')
    .update({ 
      challenger: challengerName,
      status: 'active' 
    })
    .eq('id', duelId)
    .select()
    .single();

  return { data, error };
};

// E. Spiel aktivieren (Status: pending_payment -> waiting)
export const activateDuel = async (duelId) => {
  console.log(`✅ Aktiviere Duell ${duelId} für die Lobby...`);
  
  const { data, error } = await supabase
    .from('duels')
    .update({ status: 'waiting' }) 
    .eq('id', duelId)
    .select()
    .single();

  return { data, error };
};

// F. Ergebnisse speichern
export const submitGameResult = async (gameId, role, score, time) => {
  console.log(`💾 Speichere Ergebnis für ${role}: Score ${score}, Time ${time}`);
  
  const updateData = {};
  if (role === 'creator') {
    updateData.creator_score = score;
    updateData.creator_time = time;
  } else {
    updateData.challenger_score = score;
    updateData.challenger_time = time;
  }

  const { data, error } = await supabase
    .from('duels')
    .update(updateData)
    .eq('id', gameId)
    .select()
    .single();

  return { data, error };
};

// G. Status eines Spiels abrufen
export const getGameStatus = async (gameId) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('id', gameId)
    .single();
  return { data, error };
};

// H. Alle Spiele eines Users laden (für Dashboard Liste & Active Games)
export const fetchUserGames = async (playerName) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    // Filter: Entweder ich bin Creator ODER Challenger
    .or(`creator.eq.${playerName},challenger.eq.${playerName}`)
    .order('created_at', { ascending: false }) // Neueste zuerst
    .limit(50); // Genug laden für Historie

  return { data, error };
};

// ==========================================
// 3. LEGACY / UTILS
// ==========================================

export const findOrCreateGame = async (playerName) => {
  try {
    const { data: openDuel } = await supabase
      .from('duels')
      .select('*')
      .eq('status', 'waiting')
      .neq('creator', playerName) 
      .limit(1)
      .maybeSingle();

    if (openDuel) {
      const { data: joinedDuel, error: joinError } = await supabase
        .from('duels')
        .update({ challenger: playerName, status: 'active' })
        .eq('id', openDuel.id)
        .select()
        .single();
      if (joinError) throw joinError;
      return { game: joinedDuel, role: 'challenger' };
    }

    const dummyQuestions = [
      { q: "Was ist Bitcoin?", a: ["Digitales Gold", "Ein Stein", "Essen", "Auto"], c: 0 },
      { q: "Wer ist Satoshi?", a: ["Niemand", "Craig Wright", "Unbekannt", "Elon Musk"], c: 2 },
      { q: "Wann war der Genesis Block?", a: ["2008", "2009", "2010", "2011"], c: 1 }
    ];

    const { data: newDuel, error: createError } = await supabase
      .from('duels')
      .insert([{ 
        creator: playerName, 
        status: 'waiting',
        rounds: 3, 
        amount: 21, 
        current_pot: 0, 
        questions: dummyQuestions 
      }])
      .select()
      .single();

    if (createError) throw createError;
    return { game: newDuel, role: 'creator' };

  } catch (err) {
    console.error("Matchmaking Fehler:", err);
    return { game: null, error: err };
  }
};

// ... ganz unten in supabase.js ...

// I. Gewinn als abgeholt markieren (ROBUSTE VERSION)
export const markGameAsClaimed = async (gameId) => {
  console.log(`💾 DB UPDATE: Setze Spiel ${gameId} auf 'claimed'...`);
  
  const { data, error } = await supabase
    .from('duels')
    .update({ is_claimed: true })
    .eq('id', gameId)
    .select(); // <--- WICHTIG: Stellt sicher, dass das Update durchgeht

  if (error) console.error("❌ Fehler beim Speichern von is_claimed:", error);
  else console.log("✅ DB Update erfolgreich:", data);

  return { data, error };
};