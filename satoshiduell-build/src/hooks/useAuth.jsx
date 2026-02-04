import React, { createContext, useContext, useState, useEffect } from 'react';
// WICHTIG: 'supabase' Client mit importieren!
import { supabase, verifyLogin, createPlayer, getPlayerByNpub, createPlayerWithNpub } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingNpub, setPendingNpub] = useState(() => localStorage.getItem('satoshi_pending_npub'));

  // Beim Start: Prüfen ob User im LocalStorage ist
  useEffect(() => {
    const savedUser = localStorage.getItem('satoshi_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (name, pin) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🚀 Auth-Versuch für: ${name}`);

      // 1. VERSUCH: LOGIN
      const { data: existingUser, error: loginError } = await verifyLogin(name, pin);

      if (existingUser) {
        console.log("✅ Login erfolgreich!");
        saveUser(existingUser);
        // Nach dem Speichern direkt das Profile holen, damit z.B. das Avatar sichtbar ist
        await refreshUser(existingUser.username);
        return true;
      }

      // 2. VERSUCH: REGISTRIERUNG
      console.log("⚠️ Login ging nicht. Versuche Registrierung...");
      
      const { data: newUser, error: createError } = await createPlayer(name, pin);

      if (createError) {
        if (createError.code === '23505') {
          throw new Error("Falsche PIN (Name existiert bereits)");
        }
        throw new Error("Fehler beim Erstellen: " + createError.message);
      }

      if (newUser) {
        console.log("🎉 Neuer Spieler registriert!");
        saveUser(newUser);
        // Profile sollte beim Erstellen schon existieren (Upsert), trotzdem frisch laden
        await refreshUser(newUser.username);
        return true;
      }

      throw new Error("Konnte weder einloggen noch registrieren.");

    } catch (err) {
      console.error("Login Fehler:", err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loginWithNpub = async (npub) => {
    setLoading(true);
    setError(null);

    try {
      localStorage.setItem('satoshi_last_npub', npub);
      const { data: existingUser } = await getPlayerByNpub(npub);
      if (existingUser) {
        saveUser(existingUser);
        await refreshUser(existingUser.username);
        return { ok: true, needsSetup: false };
      }

      setPendingNpub(npub);
      localStorage.setItem('satoshi_pending_npub', npub);
      return { ok: true, needsSetup: true };
    } catch (err) {
      console.error('Nostr Login Fehler:', err);
      setError(err.message || 'Nostr Login fehlgeschlagen');
      return { ok: false, needsSetup: false };
    } finally {
      setLoading(false);
    }
  };

  const completeNpubSignup = async (username) => {
    if (!pendingNpub) return false;
    setLoading(true);
    setError(null);

    try {
      const { data: newUser, error: createError } = await createPlayerWithNpub(username, pendingNpub);

      if (createError) {
        if (createError.code === '23505') {
          throw new Error('Name vergeben');
        }
        throw new Error('Fehler beim Erstellen: ' + createError.message);
      }

      if (newUser) {
        saveUser(newUser);
        setPendingNpub(null);
        localStorage.removeItem('satoshi_pending_npub');
        await refreshUser(newUser.username);
        return true;
      }
      throw new Error('Konnte Nutzer nicht erstellen.');
    } catch (err) {
      console.error('Nostr Signup Fehler:', err);
      setError(err.message || 'Nostr Signup fehlgeschlagen');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cancelNpubSignup = () => {
    setPendingNpub(null);
    localStorage.removeItem('satoshi_pending_npub');
  };

  const logout = () => {
    setUser(null);
    setPendingNpub(null);
    localStorage.removeItem('satoshi_pending_npub');
    localStorage.removeItem('satoshi_user');
  };

  const saveUser = (userData) => {
    setUser(userData);
    localStorage.setItem('satoshi_user', JSON.stringify(userData));
  };

  // --- NEU: refreshUser Funktion ---
  // Lädt die aktuellen Daten (Avatar, etc.) aus der DB und aktualisiert den State
  // Akzeptiert optional einen username-Parameter, damit wir nach Login direkt updaten können
  const refreshUser = async (usernameParam) => {
    const usernameToFetch = usernameParam || user?.username || user?.name;
    if (!usernameToFetch) return; 

    try {
      console.log("🔄 Refresh User Data for:", usernameToFetch);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', usernameToFetch) // Wir suchen nach 'username'
        .single();

      if (data) {
        // Nutze aktuellen User-State falls vorhanden, sonst ein Minimalobjekt
        const current = user || { name: usernameToFetch };
        const updatedUser = { ...current, ...data };
        
        saveUser(updatedUser); // Speichert in State & LocalStorage
        console.log("✅ User refreshed:", updatedUser);
      } else if (error) {
        console.error("Fehler beim Refresh:", error);
      }
    } catch (e) {
      console.error("Refresh Exception:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        login, 
      loginWithNpub,
      completeNpubSignup,
      cancelNpubSignup,
      pendingNpub,
        logout, 
        loading, 
        error,
        refreshUser // <--- WICHTIG: Exportieren!
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);