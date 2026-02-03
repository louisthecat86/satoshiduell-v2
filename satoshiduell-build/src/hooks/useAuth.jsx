import React, { createContext, useContext, useState, useEffect } from 'react';
// WICHTIG: 'supabase' Client mit importieren!
import { supabase, verifyLogin, createPlayer } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const logout = () => {
    setUser(null);
    localStorage.removeItem('satoshi_user');
  };

  const saveUser = (userData) => {
    setUser(userData);
    localStorage.setItem('satoshi_user', JSON.stringify(userData));
  };

  // --- NEU: refreshUser Funktion ---
  // Lädt die aktuellen Daten (Avatar, etc.) aus der DB und aktualisiert den State
  const refreshUser = async () => {
    if (!user) return; 

    try {
      console.log("🔄 Refresh User Data...");
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', user.name) // Wir suchen nach 'username'
        .single();

      if (data) {
        // Wir aktualisieren den lokalen User mit den frischen Daten aus der DB
        const updatedUser = { ...user, ...data };
        
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