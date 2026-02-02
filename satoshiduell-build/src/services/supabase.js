// services/supabase.js

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants/config';

// Supabase Client erstellen
export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.key
);

// ============================================
// PLAYER OPERATIONS
// ============================================

/**
 * Lädt einen Spieler anhand des Namens
 */
export const getPlayerByName = async (name) => {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('name', name)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

/**
 * Lädt einen Spieler anhand der Nostr Pubkey
 */
export const getPlayerByPubkey = async (pubkey) => {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('pubkey', pubkey)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

/**
 * Erstellt einen neuen Spieler
 */
export const createPlayer = async (playerData) => {
  const { data, error } = await supabase
    .from('players')
    .insert([playerData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Aktualisiert Spieler-Daten
 */
export const updatePlayer = async (name, updates) => {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('name', name)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Lädt die Leaderboard-Daten
 */
export const getLeaderboard = async (limit = 100) => {
  const { data, error } = await supabase
    .from('players')
    .select('name, wins, losses, sats_won, avatar')
    .order('wins', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
};

// ============================================
// QUESTION OPERATIONS
// ============================================

/**
 * Lädt alle aktiven Fragen
 */
export const getActiveQuestions = async () => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('is_active', true);
  
  if (error) throw error;
  
  // Formatiere Fragen für die App
  return data.map(row => ({
    de: { q: row.question_de, options: row.options_de },
    en: { q: row.question_en, options: row.options_en },
    es: { q: row.question_es, options: row.options_es },
    correct: row.correct_index,
    db_id: row.id
  }));
};

/**
 * Lädt alle Fragen (auch inaktive) - nur für Admin
 */
export const getAllQuestions = async () => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .order('id', { ascending: false });
  
  if (error) throw error;
  return data;
};

/**
 * Erstellt eine neue Frage
 */
export const createQuestion = async (questionData) => {
  const { data, error } = await supabase
    .from('questions')
    .insert([questionData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Aktualisiert eine Frage
 */
export const updateQuestion = async (id, updates) => {
  const { data, error } = await supabase
    .from('questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Löscht eine Frage (soft delete)
 */
export const deleteQuestion = async (id) => {
  const { error } = await supabase
    .from('questions')
    .update({ is_active: false })
    .eq('id', id);
  
  if (error) throw error;
};

// ============================================
// DUEL OPERATIONS
// ============================================

/**
 * Erstellt ein neues Duel
 */
export const createDuel = async (duelData) => {
  const { data, error } = await supabase
    .from('duels')
    .insert([duelData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Aktualisiert ein Duel
 */
export const updateDuel = async (id, updates) => {
  const { data, error } = await supabase
    .from('duels')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Lädt ein einzelnes Duel
 */
export const getDuel = async (id) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Lädt öffentliche Duels
 */
export const getPublicDuels = async () => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'open')
    .is('target_player', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

/**
 * Lädt gezielte Duels für einen Spieler
 */
export const getTargetedDuels = async (playerName) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('status', 'open')
    .eq('target_player', playerName)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

/**
 * Lädt Duel-Historie eines Spielers
 */
export const getPlayerDuels = async (playerName) => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .or(`creator.eq.${playerName},challenger.eq.${playerName}`)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

/**
 * Lädt alle Duels (Admin)
 */
export const getAllDuels = async () => {
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  
  if (error) throw error;
  return data;
};

// ============================================
// STORAGE OPERATIONS
// ============================================

/**
 * Lädt ein Avatar-Bild hoch
 */
export const uploadAvatar = async (file, filename) => {
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filename, file);
  
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filename);
  
  return publicUrl;
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Abonniert Änderungen an Duels
 */
export const subscribeToDuels = (callback) => {
  return supabase
    .channel('duels_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'duels' },
      callback
    )
    .subscribe();
};

/**
 * Abonniert Änderungen an einem spezifischen Duel
 */
export const subscribeToDuel = (duelId, callback) => {
  return supabase
    .channel(`duel_${duelId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'duels', filter: `id=eq.${duelId}` },
      callback
    )
    .subscribe();
};
