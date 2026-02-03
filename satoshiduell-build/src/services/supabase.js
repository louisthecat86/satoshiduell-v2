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

  if (error) return { data, error };

  // Ensure there is a corresponding profile row so UI (avatar, stats) works reliably
  try {
    await supabase
      .from('profiles')
      .upsert({
        username: String(name).trim(),
        games_played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        total_sats_won: 0,
        last_updated: new Date()
      });
  } catch (e) {
    console.error('Profile upsert error for new player:', e);
  }

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
// WICHTIG: Nimmt jetzt targetPlayer (optional) entgegen
export const createDuelEntry = async (creatorName, amount, targetPlayer = null) => {
  console.log(`📝 Erstelle Duell Eintrag für ${creatorName} mit ${amount} Sats. Target: ${targetPlayer || 'Open'}`);

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
      questions: dummyQuestions,
      target_player: targetPlayer // <--- NEU: Speichert den Gegner (oder null)
    }])
    .select()
    .single();

  return { data, error };
};

// B. Offene Duelle laden (Lobby)
export const fetchOpenDuels = async (myPlayerName) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'open')
    .neq('creator', myPlayerName) // Nicht meine eigenen
    // WICHTIG: Zeige Public Games ODER Games an MICH
    .or(`target_player.is.null,target_player.eq.${myPlayerName},target_player.ilike.${myPlayerName}`)
    .order('created_at', { ascending: false });

  return { data, error };
};

// C. Anzahl offener Duelle zählen (FÜR DAS DASHBOARD BADGE)
export const getOpenDuelCount = async (myPlayerName) => {
  const { count, error } = await supabase
    .from('duels')
    .select('*', { count: 'exact', head: true }) 
    .eq('status', 'open')
    .neq('creator', myPlayerName)
    .is('target_player', null); // <--- Zählt keine privaten Challenges

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

// E. Spiel aktivieren (Status: pending_payment -> open)
export const activateDuel = async (duelId) => {
  console.log(`✅ Aktiviere Duell ${duelId}...`);
  
  const { data, error } = await supabase
    .from('duels')
    .update({ status: 'open' }) // <--- Geändert auf 'open' damit das Dashboard es findet
    .eq('id', duelId)
    .select()
    .single();

  return { data, error };
};

// F. Ergebnisse speichern (MIT STATUS UPDATE)
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

  // 1. Ergebnis schreiben
  const { data: game, error } = await supabase
    .from('duels')
    .update(updateData)
    .eq('id', gameId)
    .select()
    .single();

  if (error) return { data: null, error };

  // 2. Prüfen: Haben jetzt BEIDE gespielt?
  if (game.creator_score !== null && game.challenger_score !== null) {
      console.log("🏁 Beide haben gespielt -> Setze Status auf 'finished'");
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
    // Filter: Creator = ich ODER Challenger = ich ODER Target = ich
    .or(`creator.eq.${playerName},challenger.eq.${playerName},target_player.eq.${playerName}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return { data, error };

  // Enrich games with avatars from profiles (creator & challenger)
  try {
    const usernames = Array.from(new Set(data.flatMap(g => [g.creator, g.challenger]).filter(Boolean)));
    if (usernames.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('username, avatar')
        .in('username', usernames);
      const profileMap = {};
      profiles?.forEach(p => profileMap[p.username] = p.avatar || null);

      const enriched = data.map(g => ({
        ...g,
        creatorAvatar: profileMap[g.creator] || null,
        challengerAvatar: profileMap[g.challenger] || null
      }));

      return { data: enriched, error: null };
    }
  } catch (e) {
    console.error('Error enriching games with avatars:', e);
  }

  return { data, error };
};

// I. Gewinn als abgeholt markieren (ROBUSTE VERSION)
export const markGameAsClaimed = async (gameId) => {
  console.log(`💾 DB UPDATE: Setze Spiel ${gameId} auf 'claimed'...`);
  
  // Wir updaten BEIDE Spalten, um sicherzugehen
  const { data, error } = await supabase
    .from('duels')
    .update({ 
      is_claimed: true, 
      claimed: true 
    })
    .eq('id', gameId)
    .select()
    .single();

  if (error) console.error("❌ Fehler beim Speichern von claimed:", error);
  else console.log("✅ DB Update erfolgreich:", data);

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
      .eq('status', 'open') // <--- Angepasst auf 'open'
      .neq('creator', playerName) 
      .is('target_player', null) // Keine privaten Games matchen
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
        status: 'open', // <--- Angepasst auf 'open'
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

// ==========================================
// STATISTIK & HISTORY (Bereinigte Version)
// ==========================================

// 1. HISTORY: Alle Spiele eines Users laden (für die Historie-Liste)
export const fetchUserHistory = async (username) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    // Suche Spiele wo Creator ODER Challenger der Username ist
    .or(`creator.eq.${username},challenger.eq.${username}`)
    .order('created_at', { ascending: false }); // Neueste zuerst

  return { data, error };
};

// 2. STATISTIK BERECHNEN: Repariert und aktualisiert die Stats eines Users
export const recalculateUserStats = async (username) => {
  console.log(`🔄 Berechne Statistik neu für: ${username}`);

  // Nur beendete Spiele holen
  const { data: games, error } = await supabase
    .from('duels')
    .select('*')
    .or(`creator.eq.${username},challenger.eq.${username}`)
    .eq('status', 'finished');

  if (error) {
      console.error("Fehler beim Laden der Historie:", error);
      return null;
  }

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let sats = 0;

  games.forEach(g => {
    const isCreator = g.creator === username;
    const myScore = isCreator ? g.creator_score : g.challenger_score;
    const opScore = isCreator ? g.challenger_score : g.creator_score;
    const myTime = isCreator ? g.creator_time : g.challenger_time;
    const opTime = isCreator ? g.challenger_time : g.creator_time;

    // Logik: Wer hat gewonnen?
    if (myScore > opScore) {
        wins++;
        sats += (g.amount * 2); 
    } else if (opScore > myScore) {
        losses++;
    } else {
        // Bei gleichem Score entscheidet die Zeit
        if (myTime < opTime) {
            wins++;
            sats += (g.amount * 2);
        } else if (opTime < myTime) {
            losses++;
        } else {
            draws++;
        }
    }
  });

  // Ergebnis in die 'profiles' Tabelle speichern
  const stats = {
      username: username,
      games_played: games.length,
      wins,
      losses,
      draws,
      total_sats_won: sats,
      last_updated: new Date()
  };

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(stats);

  if (upsertError) console.error("Fehler beim Speichern der Stats:", upsertError);
  
  return stats;
};

// 3. BESTENLISTE LADEN (Sortiert nach SATS!)
export const fetchLeaderboard = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('total_sats_won', { ascending: false }) 
        .limit(50);
    
    return { data, error };
};

// 4. PROFIL LADEN (Für Dashboard Anzeige)
export const fetchUserProfile = async (username) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();
    
    return { data, error };
};

// 5. MULTIPLE PROFILE FETCH (Utility)
export const fetchProfiles = async (usernames) => {
    if (!Array.isArray(usernames) || usernames.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('username', usernames);
    return { data, error };
};

// --- USER & SETTINGS ---

export const updateUserPin = async (username, newPin) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ pin: newPin })
    .eq('username', username)
    .select();

  if (error) {
    console.error("Error updating PIN:", error);
    return false;
  }
  return true;
};

export const uploadUserAvatar = async (username, file) => {
  try {
    const fileExt = file.name.split('.').pop();
    
    // Dateinamen säubern (nur Buchstaben/Zahlen)
    const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `${cleanUsername}_${Date.now()}.${fileExt}`;
    
    // 1. Upload
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 2. URL holen
    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const publicUrl = data.publicUrl;

    // 3. Profil Update (HIER WAR DER FEHLER)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar: publicUrl })
      .eq('username', username); // <--- HIER stand vorher 'name', es muss 'username' heißen!

    if (updateError) throw updateError;

    return publicUrl;
  } catch (error) {
    console.error("Avatar Upload Error:", error);
    return null;
  }
};